import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบ data_access_log.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด */
const OWNER = '00000000-0000-0000-0000-0000000000d1'; // เจ้าของข้อมูล
const EDITOR = '00000000-0000-0000-0000-0000000000d2'; // ได้รับอนุญาตให้แก้ของ OWNER
const VIEWER = '00000000-0000-0000-0000-0000000000d3'; // ดูได้ แก้ไม่ได้
const BLOCKED = '00000000-0000-0000-0000-0000000000d4'; // เจ้าของปิดการแชร์ ไม่มีสิทธิ์ใด ๆ
const HOME = '30000000-0000-0000-0000-0000000000d1';

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

const upsertHealth = (uid: string, data: unknown) =>
  as(
    uid,
    `insert into public.home_items (home_id, collection, id, data, updated_by) values ($1, 'member_health', $2, $3::jsonb, $4)
     on conflict (home_id, collection, id) do update set data = excluded.data, updated_by = excluded.updated_by`,
    [HOME, OWNER, JSON.stringify(data), uid]
  );

const allLogs = async () =>
  (await db.query<{ actor_id: string | null; action: string; keys: string[]; target_id: string }>(
    `select actor_id, action, keys, target_id from public.member_data_log order by id`
  )).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(resolve(__dirname, '../schema.sql'), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated;');
  await db.exec(readFileSync(resolve(__dirname, '../health_privacy.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../data_access_log.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../data_access_log.sql'), 'utf8')); // รันซ้ำได้
  // Supabase ให้สิทธิ์ตารางใหม่กับ authenticated โดยอัตโนมัติ (ส่วนที่คุมจริงคือ RLS) แล้วไฟล์ SQL ตัดสิทธิ์เขียนของตารางบันทึกออก
  await db.exec('grant select, insert, update, delete on public.member_data_log to authenticated;');
  await db.exec(readFileSync(resolve(__dirname, '../data_access_log.sql'), 'utf8')); // รันซ้ำ: ตัดสิทธิ์เขียนกลับอีกครั้ง
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}','o@example.com'),('${EDITOR}','e@example.com'),('${VIEWER}','v@example.com'),('${BLOCKED}','b@example.com');
    insert into public.homes (id, name, invite_code, created_by) values ('${HOME}', 'บ้านสมมติ', '11111111', '${OWNER}');
    insert into public.home_members (home_id, user_id, role) values
      ('${HOME}', '${OWNER}', 'owner'), ('${HOME}', '${EDITOR}', 'member'), ('${HOME}', '${VIEWER}', 'member'), ('${HOME}', '${BLOCKED}', 'member');
    insert into public.home_items (home_id, collection, id, data) values
      ('${HOME}', 'member_records', '${OWNER}', '{"id":"${OWNER}","age":60,"sharing":{"shareData":true,"editPolicy":"choose","allowedEditors":["${EDITOR}"],"blockedEditors":[]}}'),
      ('${HOME}', 'member_health', '${OWNER}', '{"health":{"conditions":["โรคสมมติ"]},"meds":[]}');
  `);
});

describe('บันทึกการแก้ไข', () => {
  it('เจ้าของแก้ข้อมูลตัวเอง: ไม่บันทึก', async () => {
    await upsertHealth(OWNER, { health: { conditions: ['โรคสมมติ'], note: 'เจ้าของแก้' }, meds: [] });
    expect(await allLogs()).toHaveLength(0);
  });

  it('คนอื่นที่ได้รับอนุญาตแก้: บันทึกว่าใครแก้หัวข้อไหน (ไม่เก็บค่า)', async () => {
    await upsertHealth(EDITOR, { health: { conditions: ['โรคสมมติ'], note: 'เจ้าของแก้' }, meds: [{ id: 'm1' }], vitals: [{ id: 'v1' }] });
    const logs = await allLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actor_id: EDITOR, action: 'edit', target_id: OWNER });
    expect(logs[0].keys).toEqual(['meds', 'vitals']); // health ไม่เปลี่ยน จึงไม่อยู่ในรายการ
    expect(JSON.stringify(logs)).not.toContain('โรคสมมติ');
  });

  it('ส่งค่าเดิมซ้ำ (ไม่มีอะไรเปลี่ยน): ไม่บันทึกเพิ่ม', async () => {
    await upsertHealth(EDITOR, { health: { conditions: ['โรคสมมติ'], note: 'เจ้าของแก้' }, meds: [{ id: 'm1' }], vitals: [{ id: 'v1' }] });
    expect(await allLogs()).toHaveLength(1);
  });

  it('คนที่ไม่มีสิทธิ์แก้ แก้ไม่ได้ จึงไม่มีบันทึก', async () => {
    await expect(upsertHealth(VIEWER, { health: {} })).rejects.toThrow();
    expect(await allLogs()).toHaveLength(1);
  });
});

describe('บันทึกการเข้าดู', () => {
  const view = (uid: string, target = OWNER) => as(uid, 'select public.log_member_view($1, $2)', [HOME, target]);

  it('คนที่มีสิทธิ์ดูเปิดดู: บันทึก และซ้ำภายใน 15 นาทีนับครั้งเดียว', async () => {
    await view(VIEWER);
    await view(VIEWER);
    const views = (await allLogs()).filter((l) => l.action === 'view');
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ actor_id: VIEWER, target_id: OWNER });
  });

  it('ผ่านไป 15 นาทีแล้วนับใหม่', async () => {
    await db.exec(`update public.member_data_log set at = now() - interval '16 minutes' where action = 'view'`);
    await view(VIEWER);
    expect((await allLogs()).filter((l) => l.action === 'view')).toHaveLength(2);
  });

  it('คนที่ไม่มีสิทธิ์ดู ยิงบันทึกปลอมไม่ได้', async () => {
    await db.exec(`update public.home_items set data = jsonb_set(data, '{sharing,shareData}', 'false') where collection = 'member_records' and id = '${OWNER}'`);
    const before = (await allLogs()).length;
    await view(BLOCKED);
    expect(await allLogs()).toHaveLength(before);
  });

  it('เปิดดูของตัวเองไม่บันทึก', async () => {
    const before = (await allLogs()).length;
    await view(OWNER);
    expect(await allLogs()).toHaveLength(before);
  });
});

describe('ใครอ่านและแก้บันทึกได้', () => {
  it('เจ้าของข้อมูลอ่านบันทึกของตัวเองได้', async () => {
    const rows = await as<{ action: string }>(OWNER, 'select action from public.member_data_log');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('คนอื่นอ่านบันทึกของเจ้าของไม่ได้ (เห็นว่างเปล่า)', async () => {
    expect(await as(EDITOR, 'select * from public.member_data_log')).toHaveLength(0);
    expect(await as(VIEWER, 'select * from public.member_data_log')).toHaveLength(0);
  });

  it('ใครก็แก้ ลบ หรือเขียนบันทึกเองไม่ได้ แม้เป็นเจ้าของ', async () => {
    await expect(as(OWNER, 'delete from public.member_data_log')).rejects.toThrow(/permission denied/);
    await expect(as(EDITOR, `update public.member_data_log set keys = '{}'`)).rejects.toThrow(/permission denied/);
    await expect(as(EDITOR, `insert into public.member_data_log (home_id, target_id, actor_id, action) values ('${HOME}', '${OWNER}', '${EDITOR}', 'view')`)).rejects.toThrow(/permission denied/);
  });
});
