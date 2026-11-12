import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบ account_delete.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด */
const SOLO = '00000000-0000-0000-0000-0000000000a1';
const OWNER = '00000000-0000-0000-0000-0000000000a2';
const MEMBER = '00000000-0000-0000-0000-0000000000a3';
const PATIENT = '00000000-0000-0000-0000-0000000000a4';
const BYSTANDER = '00000000-0000-0000-0000-0000000000a5';
const SOLO_HOME = '30000000-0000-0000-0000-000000000001';
const FAMILY_HOME = '30000000-0000-0000-0000-000000000002';
const PROVIDER = '10000000-0000-0000-0000-000000000001';
const SESSION = '20000000-0000-0000-0000-000000000001';

let db: PGlite;

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert, delete on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
  create publication supabase_realtime;
`;

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}; select set_config('test.uid', '${uid ?? ''}', true);`);
    return (await tx.query<T>(sql, params)).rows;
  });
}

/** อ่านด้วยสิทธิ์เจ้าของฐานข้อมูล (ไม่ติด RLS) เพื่อตรวจว่าข้อมูลหายจริง */
const count = async (sql: string, params: unknown[] = []) => Number((await db.query<{ n: number }>(sql, params)).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  // pglite ไม่มีส่วนขยาย pgcrypto: ตัดบรรทัดประกาศออกเฉพาะในเทสต์ (gen_random_uuid มีในตัว Postgres อยู่แล้ว)
  await db.exec(readFileSync(resolve(__dirname, '../schema.sql'), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  await db.exec(readFileSync(resolve(__dirname, '../consult_schema.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../consult_v2.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../account_delete.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../account_delete.sql'), 'utf8')); // รันซ้ำได้

  await db.exec(`
    insert into auth.users (id, email) values
      ('${SOLO}','solo@example.com'),('${OWNER}','owner@example.com'),('${MEMBER}','member@example.com'),
      ('${PATIENT}','patient@example.com'),('${BYSTANDER}','bystander@example.com');
    insert into public.homes (id, name, invite_code, created_by) values
      ('${SOLO_HOME}', 'บ้านคนเดียว', 'AAAAAAAA', '${SOLO}'), ('${FAMILY_HOME}', 'บ้านครอบครัว', 'BBBBBBBB', '${OWNER}');
    insert into public.home_members (home_id, user_id, role) values
      ('${SOLO_HOME}', '${SOLO}', 'owner'), ('${FAMILY_HOME}', '${OWNER}', 'owner'), ('${FAMILY_HOME}', '${MEMBER}', 'member');
    insert into public.home_items (home_id, collection, id, data) values
      ('${SOLO_HOME}', 'journal', 'p1', '{}'),
      ('${FAMILY_HOME}', 'member_records', '${MEMBER}', '{}'),
      ('${FAMILY_HOME}', 'member_records', '${OWNER}', '{}'),
      ('${FAMILY_HOME}', 'journal', 'p2', '{}');
    insert into public.user_docs (user_id, key, data) values
      ('${SOLO}', 'meds', '{}'), ('${MEMBER}', 'meds', '{}'), ('${OWNER}', 'meds', '{}'), ('${BYSTANDER}', 'meds', '{}');
    insert into public.consult_providers (id, kind, display_name, channels) values ('${PROVIDER}', 'pharmacist', 'A', '{chat}');
  `);
  await as(
    PATIENT,
    `select public.start_consultation($1, $2, 'chat', 'หัวข้อ', 'ผู้ทดสอบ', 'routine', null, '{}', '{"safety":{"level":"none"}}', '{symptoms}', 'v1')`,
    [SESSION, PROVIDER]
  );
});

describe('ลบบัญชีของฉัน', () => {
  it('ต้องล็อกอินก่อน คนที่ไม่ได้ล็อกอินเรียกไม่ได้', async () => {
    await expect(as(null, 'select public.delete_my_account()')).rejects.toThrow();
  });

  it('ผู้ดูแลหลักที่ยังมีคนอื่นในบ้านลบบัญชีไม่ได้ และไม่มีอะไรหาย', async () => {
    await expect(as(OWNER, 'select public.delete_my_account()')).rejects.toThrow('owner_has_members');
    expect(await count(`select count(*) n from auth.users where id = '${OWNER}'`)).toBe(1);
    expect(await count(`select count(*) n from public.homes where id = '${FAMILY_HOME}'`)).toBe(1);
    expect(await count(`select count(*) n from public.home_members where home_id = '${FAMILY_HOME}'`)).toBe(2);
  });

  it('ผู้ดูแลหลักที่อยู่คนเดียว: ลบบัญชี บ้าน และข้อมูลของบ้านทั้งหมด', async () => {
    await as(SOLO, 'select public.delete_my_account()');
    expect(await count(`select count(*) n from auth.users where id = '${SOLO}'`)).toBe(0);
    expect(await count(`select count(*) n from public.homes where id = '${SOLO_HOME}'`)).toBe(0);
    expect(await count(`select count(*) n from public.home_items where home_id = '${SOLO_HOME}'`)).toBe(0);
    expect(await count(`select count(*) n from public.user_docs where user_id = '${SOLO}'`)).toBe(0);
  });

  it('สมาชิกทั่วไป: บัญชีและข้อมูลส่วนตัวหาย ข้อมูลสมาชิกที่เผยแพร่ถูกถอน แต่บ้านและคนอื่นไม่กระทบ', async () => {
    await as(MEMBER, 'select public.delete_my_account()');
    expect(await count(`select count(*) n from auth.users where id = '${MEMBER}'`)).toBe(0);
    expect(await count(`select count(*) n from public.user_docs where user_id = '${MEMBER}'`)).toBe(0);
    expect(await count(`select count(*) n from public.home_members where user_id = '${MEMBER}'`)).toBe(0);
    expect(await count(`select count(*) n from public.home_items where collection = 'member_records' and id = '${MEMBER}'`)).toBe(0);
    // ของคนอื่นและของบ้านยังอยู่
    expect(await count(`select count(*) n from public.home_items where collection = 'member_records' and id = '${OWNER}'`)).toBe(1);
    expect(await count(`select count(*) n from public.home_items where collection = 'journal' and id = 'p2'`)).toBe(1);
    expect(await count(`select count(*) n from public.homes where id = '${FAMILY_HOME}'`)).toBe(1);
    expect(await count(`select count(*) n from public.user_docs where user_id = '${OWNER}'`)).toBe(1);
  });

  it('ลบการปรึกษาและรายงานสุขภาพของผู้ป่วยตามไปด้วย', async () => {
    expect(await count(`select count(*) n from public.consult_sessions where patient_id = '${PATIENT}'`)).toBe(1);
    expect(await count(`select count(*) n from public.consult_briefs where patient_id = '${PATIENT}'`)).toBe(1);
    await as(PATIENT, 'select public.delete_my_account()');
    expect(await count(`select count(*) n from auth.users where id = '${PATIENT}'`)).toBe(0);
    expect(await count(`select count(*) n from public.consult_sessions where patient_id = '${PATIENT}'`)).toBe(0);
    expect(await count(`select count(*) n from public.consult_briefs where patient_id = '${PATIENT}'`)).toBe(0);
    expect(await count(`select count(*) n from public.consult_consents where patient_id = '${PATIENT}'`)).toBe(0);
  });

  it('ลบได้เฉพาะบัญชีของตัวเอง: คนที่ไม่เกี่ยวข้องไม่ถูกแตะ', async () => {
    expect(await count(`select count(*) n from auth.users where id = '${BYSTANDER}'`)).toBe(1);
    expect(await count(`select count(*) n from public.user_docs where user_id = '${BYSTANDER}'`)).toBe(1);
  });
});
