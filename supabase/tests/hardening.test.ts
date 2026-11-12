import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบ hardening.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด */
const OWNER = '00000000-0000-0000-0000-0000000000b1';
const GUESSER = '00000000-0000-0000-0000-0000000000b2';
const FRIEND = '00000000-0000-0000-0000-0000000000b3';
const HOME = '30000000-0000-0000-0000-0000000000b1';

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

const join = (uid: string, code: string) => as<{ join_home: string | null }>(uid, 'select public.join_home($1, $2)', [code, 'ญาติ']);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(resolve(__dirname, '../schema.sql'), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  await db.exec(readFileSync(resolve(__dirname, '../hardening.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../hardening.sql'), 'utf8')); // รันซ้ำได้
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}','o@example.com'),('${GUESSER}','g@example.com'),('${FRIEND}','f@example.com');
    insert into public.homes (id, name, invite_code, created_by) values ('${HOME}', 'บ้านสมมติ', '12345678', '${OWNER}');
    insert into public.home_members (home_id, user_id, role) values ('${HOME}', '${OWNER}', 'owner');
  `);
});

describe('hardening.sql', () => {
  it('รหัสผิดคืนค่า null (แอปแปลงเป็น "ไม่พบรหัสเชิญ") และไม่ได้เข้าบ้าน', async () => {
    const rows = await join(GUESSER, '00000000');
    expect(rows[0].join_home).toBeNull();
    const n = await db.query<{ n: number }>(`select count(*)::int n from public.home_members where user_id = '${GUESSER}'`);
    expect(n.rows[0].n).toBe(0);
  });

  it('ใส่ผิดครบ 10 ครั้งใน 15 นาที ถูกระงับ แม้ครั้งต่อไปจะใส่รหัสถูก', async () => {
    for (let i = 0; i < 9; i++) await join(GUESSER, `0000000${i}`); // รวมกับข้อก่อนหน้า = ผิด 10 ครั้ง
    await expect(join(GUESSER, '12345678')).rejects.toThrow(/too_many_attempts/);
    const n = await db.query<{ n: number }>(`select count(*)::int n from public.home_members where user_id = '${GUESSER}'`);
    expect(n.rows[0].n).toBe(0);
  });

  it('ครบ 15 นาทีแล้วลองใหม่ได้', async () => {
    await db.exec(`update public.home_join_attempts set at = now() - interval '16 minutes' where user_id = '${GUESSER}'`);
    const rows = await join(GUESSER, '12345678');
    expect(rows[0].join_home).toBe(HOME);
  });

  it('คนอื่นไม่ถูกนับรวม: เพื่อนที่ใส่รหัสถูกเข้าบ้านได้ทันที', async () => {
    const rows = await join(FRIEND, '1234-5678');
    expect(rows[0].join_home).toBe(HOME);
  });

  it('ผู้ใช้อ่านหรือแก้ตารางบันทึกการลองเองไม่ได้', async () => {
    await expect(as(GUESSER, 'select * from public.home_join_attempts')).rejects.toThrow(/permission denied/);
    await expect(as(GUESSER, 'delete from public.home_join_attempts')).rejects.toThrow(/permission denied/);
  });

  it('จำกัดขนาดไฟล์แนบ 20 MB', async () => {
    const r = await db.query<{ file_size_limit: number }>(`select file_size_limit from storage.buckets where id = 'attachments'`);
    expect(Number(r.rows[0].file_size_limit)).toBe(20 * 1024 * 1024);
  });
});
