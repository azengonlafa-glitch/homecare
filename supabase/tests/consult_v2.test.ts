import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบสิทธิ์ของ consult_v2.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด */
const PATIENT = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
const STAFF = '00000000-0000-0000-0000-00000000000c';
const ADMIN = '00000000-0000-0000-0000-00000000000e';
const NEW_USER = '00000000-0000-0000-0000-00000000000f';
const PROVIDER = '10000000-0000-0000-0000-000000000001';
const CLINIC = '10000000-0000-0000-0000-000000000002';
const OPEN_SESSION = '20000000-0000-0000-0000-000000000001';
const CLOSED_SESSION = '20000000-0000-0000-0000-000000000002';

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
`;

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}; select set_config('test.uid', '${uid ?? ''}', true);`);
    return (await tx.query<T>(sql, params)).rows;
  });
}

const start = (uid: string, session: string, channel = 'chat') =>
  as(uid, `select public.start_consultation($1, $2, $3, 'หัวข้อ', 'ผู้ทดสอบ', 'routine', null, '{}', '{"safety":{"level":"none"}}', '{symptoms}', 'v1')`, [session, PROVIDER, channel]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(resolve(__dirname, '../consult_schema.sql'), 'utf8'));
  await db.exec(`
    insert into auth.users values ('${PATIENT}','patient@example.com'),('${OTHER}','other@example.com'),('${STAFF}','staff@example.com'),('${ADMIN}','admin@example.com'),('${NEW_USER}','New.User@example.com');
    insert into public.consult_providers (id, kind, display_name, channels) values
      ('${PROVIDER}', 'pharmacist', 'A', '{chat}'), ('${CLINIC}', 'clinic', 'B', '{chat}');
    insert into public.consult_staff values ('${STAFF}', 'pharmacist', '${PROVIDER}', now()), ('${ADMIN}', 'admin', null, now());
  `);
  await db.exec(readFileSync(resolve(__dirname, '../consult_v2.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../consult_v2.sql'), 'utf8')); // รันซ้ำได้
  await start(PATIENT, OPEN_SESSION);
  await start(PATIENT, CLOSED_SESSION);
  await as(PATIENT, `select public.set_consult_status($1, 'cancelled')`, [CLOSED_SESSION]);
});

describe('แอดมิน', () => {
  it('คนที่ไม่ใช่แอดมินเรียกไม่ได้ รวมถึงเภสัชกรและผู้ใช้', async () => {
    for (const uid of [PATIENT, STAFF]) {
      await expect(as(uid, 'select * from public.admin_list_staff()')).rejects.toThrow('forbidden');
      await expect(as(uid, `select public.admin_assign_staff('other@example.com', $1)`, [PROVIDER])).rejects.toThrow('forbidden');
      await expect(as(uid, 'select public.admin_remove_staff($1)', [STAFF])).rejects.toThrow('forbidden');
    }
    await expect(as(null, 'select * from public.admin_list_staff()')).rejects.toThrow();
  });
  it('ผูกบัญชีด้วยอีเมลแบบไม่สนตัวพิมพ์ บทบาทตามประเภทผู้ให้บริการ', async () => {
    await as(ADMIN, `select public.admin_assign_staff(' new.user@EXAMPLE.com ', $1)`, [CLINIC]);
    const rows = await as<{ email: string; role: string }>(ADMIN, 'select * from public.admin_list_staff()');
    expect(rows.find((r) => r.email === 'New.User@example.com')?.role).toBe('clinic');
  });
  it('อีเมลที่ไม่มีบัญชีแจ้งชัด และลดสิทธิ์แอดมินผ่านทางนี้ไม่ได้', async () => {
    await expect(as(ADMIN, `select public.admin_assign_staff('nobody@example.com', $1)`, [PROVIDER])).rejects.toThrow('user_not_found');
    await expect(as(ADMIN, `select public.admin_assign_staff('admin@example.com', $1)`, [PROVIDER])).rejects.toThrow('target_is_admin');
    await expect(as(ADMIN, 'select public.admin_remove_staff($1)', [ADMIN])).rejects.toThrow('forbidden');
  });
  it('ถอดเจ้าหน้าที่แล้วเข้าถึงคิวไม่ได้ทันที', async () => {
    expect(await as(NEW_USER, 'select public.consult_staff_provider() as p')).toEqual([{ p: CLINIC }]);
    await as(ADMIN, 'select public.admin_remove_staff($1)', [NEW_USER]);
    expect(await as(NEW_USER, 'select public.consult_staff_provider() as p')).toEqual([{ p: null }]);
  });
  it('แอดมินยังเปิดข้อมูลสุขภาพไม่ได้', async () => {
    await expect(as(ADMIN, 'select public.open_consult_brief($1)', [OPEN_SESSION])).rejects.toThrow('forbidden');
    expect(await as(ADMIN, 'select 1 from public.consult_briefs')).toHaveLength(0);
  });
});

describe('ลบข้อมูลตามคำขอ', () => {
  it('คนอื่น เภสัชกร แอดมิน ลบแทนไม่ได้', async () => {
    for (const uid of [OTHER, STAFF, ADMIN]) {
      await expect(as(uid, 'select public.delete_consult_session($1)', [CLOSED_SESSION])).rejects.toThrow('forbidden');
    }
  });
  it('ลบระหว่างที่การปรึกษายังเปิดอยู่ไม่ได้', async () => {
    await expect(as(PATIENT, 'select public.delete_consult_session($1)', [OPEN_SESSION])).rejects.toThrow('session_open');
  });
  it('เฉพาะเจ้าของลบไฟล์ได้', async () => {
    await as(PATIENT, `insert into storage.objects (bucket_id, name) values ('consult-files', $1)`, [`${CLOSED_SESSION}/f1`]);
    expect(await as(STAFF, `delete from storage.objects where bucket_id = 'consult-files' returning 1`)).toHaveLength(0);
    expect(await as(OTHER, `delete from storage.objects where bucket_id = 'consult-files' returning 1`)).toHaveLength(0);
  });
  it('มีไฟล์ค้างอยู่ลบไม่ได้ กันไฟล์กำพร้า', async () => {
    await expect(as(PATIENT, 'select public.delete_consult_session($1)', [CLOSED_SESSION])).rejects.toThrow('files_remaining');
    expect(await as(PATIENT, `delete from storage.objects where bucket_id = 'consult-files' returning 1`)).toHaveLength(1);
  });
  it('ลบแล้วข้อมูลทุกตารางหายจริง เหลือแค่หลักฐานการลบที่ไม่มีข้อมูลสุขภาพ', async () => {
    await as(PATIENT, 'select public.delete_consult_session($1)', [CLOSED_SESSION]);
    for (const [table, col] of [['consult_sessions', 'id'], ['consult_checkins', 'session_id'], ['consult_briefs', 'session_id'], ['consult_consents', 'session_id'], ['consult_messages', 'session_id'], ['consult_access_log', 'session_id']]) {
      const res = await db.query(`select 1 from public.${table} where ${col} = $1`, [CLOSED_SESSION]);
      expect(res.rows, table).toHaveLength(0);
    }
    const log = await as<Record<string, unknown>>(PATIENT, 'select * from public.consult_erasure_log');
    expect(log).toHaveLength(1);
    expect(Object.keys(log[0]).sort()).toEqual(['at', 'id', 'patient_id', 'session_id']);
    expect(await as(OTHER, 'select 1 from public.consult_erasure_log')).toHaveLength(0);
  });
  it('การปรึกษาอื่นไม่ถูกลบตาม', async () => {
    expect(await as(PATIENT, 'select 1 from public.consult_sessions where id = $1', [OPEN_SESSION])).toHaveLength(1);
  });
});

describe('เวลานัด', () => {
  const future = '2099-01-01T10:00:00Z';
  it('ทั้งผู้ใช้และเภสัชกรของการปรึกษานั้นตั้งได้', async () => {
    await as(PATIENT, 'select public.set_consult_schedule($1, $2)', [OPEN_SESSION, future]);
    await as(STAFF, 'select public.set_consult_schedule($1, $2)', [OPEN_SESSION, '2099-01-02T10:00:00Z']);
    const rows = await as<{ scheduled_at: Date }>(PATIENT, 'select scheduled_at from public.consult_sessions where id = $1', [OPEN_SESSION]);
    expect(new Date(rows[0].scheduled_at).toISOString()).toBe('2099-01-02T10:00:00.000Z');
  });
  it('คนนอกและแอดมินตั้งไม่ได้', async () => {
    for (const uid of [OTHER, ADMIN]) {
      await expect(as(uid, 'select public.set_consult_schedule($1, $2)', [OPEN_SESSION, future])).rejects.toThrow('forbidden');
    }
    await expect(as(null, 'select public.set_consult_schedule($1, $2)', [OPEN_SESSION, future])).rejects.toThrow();
  });
  it('เวลาในอดีตตั้งไม่ได้', async () => {
    await expect(as(PATIENT, 'select public.set_consult_schedule($1, $2)', [OPEN_SESSION, '2000-01-01T00:00:00Z'])).rejects.toThrow('schedule_required');
  });
});

describe('การสมัครรับแจ้งเตือน', () => {
  const save = (uid: string, endpoint = 'https://push.example.com/a') =>
    as(uid, `select public.save_push_subscription($1, 'p', 'a')`, [endpoint]);
  it('เห็นและลบได้เฉพาะของตัวเอง ใส่แถวตรง ๆ ไม่ได้', async () => {
    await save(PATIENT);
    expect(await as(OTHER, 'select 1 from public.consult_push_subscriptions')).toHaveLength(0);
    expect(await as(OTHER, 'delete from public.consult_push_subscriptions returning 1')).toHaveLength(0);
    await expect(as(OTHER, `insert into public.consult_push_subscriptions values ('https://x', $1, 'p', 'a')`, [OTHER])).rejects.toThrow();
  });
  it('เครื่องเดียวกันเปลี่ยนบัญชี แจ้งเตือนต้องย้ายมาบัญชีล่าสุด ไม่ค้างที่คนเดิม', async () => {
    await save(OTHER);
    expect(await as(PATIENT, 'select 1 from public.consult_push_subscriptions')).toHaveLength(0);
    expect(await as(OTHER, 'select 1 from public.consult_push_subscriptions')).toHaveLength(1);
  });
  it('รับเฉพาะ https และต้องเข้าสู่ระบบ', async () => {
    await expect(save(PATIENT, 'http://push.example.com/a')).rejects.toThrow();
    await expect(as(null, `select public.save_push_subscription('https://x', 'p', 'a')`)).rejects.toThrow();
  });
});
