import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

/**
 * ตรวจว่าไฟล์รวม RUN_ALL_AFTER_MERGE.sql (วางครั้งเดียวใน SQL Editor) รันได้จริงและรันซ้ำได้
 * บนฐานข้อมูลที่มีสคีมาเดิมครบ (ตัดบรรทัด cron ท้ายไฟล์ออก เพราะ pglite ไม่มี pg_cron)
 * และตรวจว่าเนื้อหาเท่ากับ 4 ไฟล์ต้นทางต่อกันตามลำดับ ไม่ตกหล่น
 */
const read = (f: string) => readFileSync(resolve(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');

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
  create publication supabase_realtime;
`;

describe('RUN_ALL_AFTER_MERGE.sql', () => {
  const all = read('RUN_ALL_AFTER_MERGE.sql');
  const cronLine = "select cron.alter_job((select jobid from cron.job where jobname = 'med-dose-reminders'), schedule := '* * * * *');";

  it('มี 4 ไฟล์ต้นทางครบตามลำดับ และจบด้วยบรรทัดเปลี่ยนรอบเช็คยา', () => {
    let at = 0;
    for (const f of ['account_delete', 'hardening', 'health_privacy', 'data_access_log']) {
      const body = read(`${f}.sql`).trimEnd();
      const found = all.indexOf(body, at);
      expect(found, `${f}.sql ไม่อยู่ในไฟล์รวม หรืออยู่ผิดลำดับ ให้สร้างไฟล์รวมใหม่`).toBeGreaterThanOrEqual(0);
      at = found + body.length;
    }
    expect(all.trimEnd().endsWith(cronLine)).toBe(true);
  });

  it('รันบนสคีมาเดิมได้ไม่ error และรันซ้ำได้', async () => {
    const db = new PGlite();
    await db.exec(STUBS);
    await db.exec(read('schema.sql').replace('create extension if not exists pgcrypto;', ''));
    await db.exec(read('consult_schema.sql'));
    await db.exec(read('consult_v2.sql'));
    const withoutCron = all.replace(cronLine, '');
    await db.exec(withoutCron);
    await db.exec(withoutCron);
    const r = await db.query<{ n: number }>(
      `select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname in ('delete_my_account', 'join_home', 'home_items_guard', 'log_member_view', 'log_health_edit')`
    );
    expect(r.rows[0].n).toBe(5);
  });
});
