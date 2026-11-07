import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบ consult_v5.sql (สิทธิ์ช่องสัญญาณโทร) กับ Postgres จำลองในหน่วยความจำ บัญชีเป็นข้อมูลสมมติทั้งหมด */
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const PATIENT = uid(1);
const OTHER = uid(2);
const ADMIN = uid(3);
const STAFF_A = uid(4);
const STAFF_B = uid(5);
const SHOP = '10000000-0000-0000-0000-000000000001';
const ACTIVE = '20000000-0000-0000-0000-000000000001';
const WAITING = '20000000-0000-0000-0000-000000000002';
const DONE = '20000000-0000-0000-0000-000000000003';

let db: PGlite;

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
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
  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb);
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  alter table realtime.messages enable row level security;
  grant usage on schema realtime to authenticated, anon;
  grant select, insert on realtime.messages to authenticated, anon;
  grant usage, select on sequence realtime.messages_id_seq to authenticated, anon;
  grant execute on function realtime.topic() to authenticated, anon;
`;

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');
const topic = (sid: string) => `consult-call:${sid}`;

/** ลองส่ง (insert) หรืออ่าน (select) ข้อความบนช่องที่ระบุ ในฐานะผู้ใช้ที่ระบุ */
async function insertSignal(user: string | null, t: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}; select set_config('test.uid', '${user ?? ''}', true); select set_config('realtime.topic', '${t}', true);`);
    await tx.query(`insert into realtime.messages (topic, extension, payload) values ($1, 'broadcast', '{}')`, [t]);
  });
}
async function canRead(user: string | null, t: string): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}; select set_config('test.uid', '${user ?? ''}', true); select set_config('realtime.topic', '${t}', true);`);
    return (await tx.query(`select 1 from realtime.messages where topic = $1`, [t])).rows.length;
  });
}
async function as<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('test.uid', '${user}', true);`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const start = (user: string, session: string) =>
  as(user, `select public.start_consultation($1, $2, 'chat', 'หัวข้อ', 'ผู้ทดสอบ', 'routine', null, '{}', '{}', '{symptoms}', 'v1')`, [session, SHOP]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(read('../consult_schema.sql'));
  await db.exec(`
    insert into auth.users values ('${PATIENT}','patient@example.com'),('${OTHER}','other@example.com'),('${ADMIN}','admin@example.com'),
      ('${STAFF_A}','anan@example.com'),('${STAFF_B}','boon@example.com');
    insert into public.consult_providers (id, kind, display_name, channels) values ('${SHOP}', 'pharmacist', 'ร้านหนึ่ง', '{chat,voice,video}');
    insert into public.consult_staff values ('${ADMIN}', 'admin', null, now()), ('${STAFF_A}', 'pharmacist', '${SHOP}', now()), ('${STAFF_B}', 'pharmacist', '${SHOP}', now());
  `);
  await db.exec(read('../consult_v2.sql'));
  await db.exec(read('../consult_v3.sql'));
  await db.exec(read('../consult_v4.sql'));
  await db.exec(read('../consult_v5.sql'));
  await db.exec(read('../consult_v5.sql')); // รันซ้ำได้
  await start(PATIENT, ACTIVE);
  await start(PATIENT, WAITING);
  await start(PATIENT, DONE);
  await as(STAFF_A, `select public.set_consult_status($1, 'active')`, [ACTIVE]);
  await as(STAFF_A, `select public.set_consult_status($1, 'active')`, [DONE]);
  await as(STAFF_A, `select public.set_consult_status($1, 'completed')`, [DONE]).catch(() => undefined);
  await db.query(`update public.consult_sessions set status = 'completed' where id = $1`, [DONE]);
});

describe('ช่องสัญญาณโทร', () => {
  it('ผู้ป่วยเจ้าของเคส และเจ้าหน้าที่ที่รับเรื่อง ส่งสัญญาณในเคสที่กำลังปรึกษาได้', async () => {
    await insertSignal(PATIENT, topic(ACTIVE));
    await insertSignal(STAFF_A, topic(ACTIVE));
  });

  it('ฟังสัญญาณได้เฉพาะสองฝ่ายนี้', async () => {
    expect(await canRead(PATIENT, topic(ACTIVE))).toBeGreaterThan(0);
    expect(await canRead(STAFF_A, topic(ACTIVE))).toBeGreaterThan(0);
    for (const user of [OTHER, STAFF_B, ADMIN, null]) expect(await canRead(user, topic(ACTIVE))).toBe(0);
  });

  it('เพื่อนร่วมงานที่ไม่ใช่ผู้ดูแล แอดมิน ผู้ป่วยคนอื่น และคนไม่ล็อกอิน ส่งสัญญาณไม่ได้', async () => {
    for (const user of [OTHER, STAFF_B, ADMIN, null]) await expect(insertSignal(user, topic(ACTIVE))).rejects.toThrow();
  });

  it('เคสที่ยังรอรับเรื่อง หรือปิดแล้ว ส่งสัญญาณไม่ได้ แม้เป็นเจ้าของเคส', async () => {
    await expect(insertSignal(PATIENT, topic(WAITING))).rejects.toThrow();
    await expect(insertSignal(PATIENT, topic(DONE))).rejects.toThrow();
    await expect(insertSignal(STAFF_A, topic(DONE))).rejects.toThrow();
  });

  it('คืนเคสเข้าคิวแล้ว ผู้ดูแลเดิมส่งสัญญาณไม่ได้อีก', async () => {
    const S = '20000000-0000-0000-0000-0000000000ff';
    await start(PATIENT, S);
    await as(STAFF_A, `select public.set_consult_status($1, 'active')`, [S]);
    await insertSignal(STAFF_A, topic(S));
    await as(STAFF_A, `select public.release_consultation($1)`, [S]);
    await expect(insertSignal(STAFF_A, topic(S))).rejects.toThrow();
    await expect(insertSignal(PATIENT, topic(S))).rejects.toThrow();
  });

  it('ชื่อช่องที่ผิดรูปแบบถูกปฏิเสธ ไม่ใช่เกิดข้อผิดพลาดภายใน', async () => {
    for (const t of ['consult-call:not-a-uuid', 'consult-call:', `other:${ACTIVE}`, `consult-call:${ACTIVE}x`, `CONSULT-CALL:${ACTIVE}`]) {
      await expect(insertSignal(PATIENT, t)).rejects.toThrow(/row-level security|violates/i);
    }
  });

  it('ฟังก์ชันตรวจสิทธิ์เรียกโดยผู้ไม่ล็อกอินไม่ได้', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.exec(`set local role anon`);
      await tx.query(`select public.consult_can_signal('consult-call:${ACTIVE}')`);
    })).rejects.toThrow();
  });
});
