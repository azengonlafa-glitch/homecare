import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * ทดสอบ fix_member_roles.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด
 * บั๊กเดิม: ตัวกัน guard_member_update บล็อกทั้งการแก้ตรงของผู้ใช้ และฟังก์ชันของระบบ (มอบบทบาท / เปลี่ยนบทบาท)
 */
const OWNER = '00000000-0000-0000-0000-0000000000e1';
const MEMBER = '00000000-0000-0000-0000-0000000000e2';
const OTHER_OWNER = '00000000-0000-0000-0000-0000000000e3';
const HOME = '30000000-0000-0000-0000-0000000000e1';
const OTHER_HOME = '30000000-0000-0000-0000-0000000000e2';

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
  create publication supabase_realtime;
`;

async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('test.uid', '${uid}', true);`);
    return (await tx.query<T>(sql, params)).rows;
  });
}

const roleOf = async (uid: string) =>
  (await db.query<{ role: string; home_id: string }>(`select role, home_id from public.home_members where user_id = $1`, [uid])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(resolve(__dirname, '../schema.sql'), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated;');
  await db.exec(readFileSync(resolve(__dirname, '../account_delete.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../fix_member_roles.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../fix_member_roles.sql'), 'utf8')); // รันซ้ำได้
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}','o@example.com'),('${MEMBER}','m@example.com'),('${OTHER_OWNER}','x@example.com');
    insert into public.homes (id, name, invite_code, created_by) values ('${HOME}', 'บ้านสมมติ', '11111111', '${OWNER}'), ('${OTHER_HOME}', 'บ้านอื่น', '22222222', '${OTHER_OWNER}');
    insert into public.home_members (home_id, user_id, role) values ('${HOME}', '${OWNER}', 'owner'), ('${HOME}', '${MEMBER}', 'member'), ('${OTHER_HOME}', '${OTHER_OWNER}', 'owner');
  `);
});

describe('ผู้ใช้แก้แถวสมาชิกของตัวเองตรง ๆ', () => {
  it('เลื่อนตัวเองเป็นผู้ดูแลหลักไม่ได้', async () => {
    await expect(as(MEMBER, `update public.home_members set role = 'owner' where user_id = $1`, [MEMBER])).rejects.toThrow(/forbidden/);
    expect((await roleOf(MEMBER)).role).toBe('member');
  });

  it('ย้ายตัวเองเข้าบ้านอื่นโดยไม่มีรหัสเชิญไม่ได้', async () => {
    await expect(as(MEMBER, `update public.home_members set home_id = $1 where user_id = $2`, [OTHER_HOME, MEMBER])).rejects.toThrow(/forbidden/);
    expect((await roleOf(MEMBER)).home_id).toBe(HOME);
  });

  it('แก้ความสัมพันธ์ (relation) ของตัวเองได้ตามปกติ', async () => {
    await as(MEMBER, `update public.home_members set relation = 'ลูก' where user_id = $1`, [MEMBER]);
    const r = await db.query<{ relation: string }>(`select relation from public.home_members where user_id = $1`, [MEMBER]);
    expect(r.rows[0].relation).toBe('ลูก');
  });
});

describe('ฟังก์ชันของระบบ (บั๊กที่แก้)', () => {
  it('สมาชิกธรรมดาเรียกเปลี่ยนบทบาทคนอื่นไม่ได้', async () => {
    await expect(as(MEMBER, 'select public.set_member_role($1, $2, $3)', [HOME, OWNER, 'external'])).rejects.toThrow(/forbidden/);
  });

  it('ผู้ดูแลหลักเปลี่ยนบทบาทสมาชิกได้', async () => {
    await as(OWNER, 'select public.set_member_role($1, $2, $3)', [HOME, MEMBER, 'external']);
    expect((await roleOf(MEMBER)).role).toBe('external');
    await as(OWNER, 'select public.set_member_role($1, $2, $3)', [HOME, MEMBER, 'member']);
    expect((await roleOf(MEMBER)).role).toBe('member');
  });

  it('ผู้ดูแลหลักที่ยังมีสมาชิก: ลบบัญชีไม่ได้ จนกว่าจะมอบบทบาท แล้วลบได้', async () => {
    await expect(as(OWNER, 'select public.delete_my_account()')).rejects.toThrow(/owner_has_members/);
    await as(OWNER, 'select public.transfer_ownership($1, $2)', [HOME, MEMBER]);
    expect((await roleOf(MEMBER)).role).toBe('owner');
    expect((await roleOf(OWNER)).role).toBe('member');
    await as(OWNER, 'select public.delete_my_account()');
    const n = await db.query<{ n: number }>(`select count(*)::int n from auth.users where id = $1`, [OWNER]);
    expect(n.rows[0].n).toBe(0);
    expect((await roleOf(MEMBER)).role).toBe('owner');
  });
});
