import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * ทดสอบสิทธิ์ของ consult_schema.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง
 * ตั้งชื่อบัญชีเป็นข้อมูลสมมติทั้งหมด
 */
const PATIENT = '00000000-0000-0000-0000-00000000000a';
const OTHER_PATIENT = '00000000-0000-0000-0000-00000000000b';
const STAFF_A = '00000000-0000-0000-0000-00000000000c';
const STAFF_B = '00000000-0000-0000-0000-00000000000d';
const ADMIN = '00000000-0000-0000-0000-00000000000e';
const HOUSEMATE = '00000000-0000-0000-0000-00000000000f';
const PROVIDER_A = '10000000-0000-0000-0000-000000000001';
const PROVIDER_B = '10000000-0000-0000-0000-000000000002';
const SESSION = '20000000-0000-0000-0000-000000000001';

let db: PGlite;

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select, insert on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
  create publication supabase_realtime;
`;

/** รันคำสั่งในฐานะผู้ใช้คนหนึ่ง คืนค่าแถวผลลัพธ์ */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}; select set_config('test.uid', '${uid ?? ''}', true);`);
    const res = await tx.query<T>(sql, params);
    return res.rows;
  });
}

const start = (uid: string, session = SESSION, provider = PROVIDER_A, scopes = ['symptoms', 'allergies'], level = 'none') =>
  as(uid, `select public.start_consultation($1, $2, 'chat', 'หัวข้อ', 'ผู้ทดสอบ', 'routine', null, $3, $4, $5, 'v1')`, [
    session,
    provider,
    JSON.stringify({ severity: 3 }),
    JSON.stringify({ safety: { level }, symptoms: { severity: 3 } }),
    scopes,
  ]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(resolve(__dirname, '../consult_schema.sql'), 'utf8'));
  await db.exec(`
    insert into auth.users values ('${PATIENT}'),('${OTHER_PATIENT}'),('${STAFF_A}'),('${STAFF_B}'),('${ADMIN}'),('${HOUSEMATE}');
    insert into public.consult_providers (id, kind, display_name, channels) values
      ('${PROVIDER_A}', 'pharmacist', 'A', '{chat}'), ('${PROVIDER_B}', 'clinic', 'B', '{chat}');
    insert into public.consult_staff values
      ('${STAFF_A}', 'pharmacist', '${PROVIDER_A}', now()), ('${STAFF_B}', 'clinic', '${PROVIDER_B}', now()), ('${ADMIN}', 'admin', null, now());
  `);
  await start(PATIENT);
});

describe('การเริ่มปรึกษา', () => {
  it('ผู้ไม่ได้เข้าสู่ระบบเรียกไม่ได้', async () => {
    await expect(start(null as unknown as string, '20000000-0000-0000-0000-000000000099')).rejects.toThrow();
  });
  it('ไม่รับกรณีฉุกเฉินเข้าคิว', async () => {
    await expect(start(PATIENT, '20000000-0000-0000-0000-000000000002', PROVIDER_A, ['symptoms'], 'emergency')).rejects.toThrow('emergency_not_queued');
  });
  it('ต้องยินยอมเรื่องอาการเป็นอย่างน้อย', async () => {
    await expect(start(PATIENT, '20000000-0000-0000-0000-000000000003', PROVIDER_A, ['overview'])).rejects.toThrow('consent_required');
  });
  it('เรียกซ้ำด้วยรหัสเดิมไม่สร้างซ้ำ และคนอื่นแอบใช้รหัสเดิมไม่ได้', async () => {
    await start(PATIENT);
    const rows = await as(PATIENT, 'select id from public.consult_sessions where id = $1', [SESSION]);
    expect(rows).toHaveLength(1);
    await expect(start(OTHER_PATIENT)).rejects.toThrow('forbidden');
  });
  it('ผู้ใช้สร้างแถวตรง ๆ โดยไม่ผ่านความยินยอมไม่ได้', async () => {
    await expect(
      as(PATIENT, `insert into public.consult_sessions (id, patient_id, provider_id, channel) values (gen_random_uuid(), $1, $2, 'chat')`, [PATIENT, PROVIDER_A])
    ).rejects.toThrow();
  });
});

describe('การแยกข้อมูล', () => {
  it('ผู้ใช้คนอื่นและคนในบ้านเดียวกันมองไม่เห็น', async () => {
    for (const uid of [OTHER_PATIENT, HOUSEMATE]) {
      expect(await as(uid, 'select 1 from public.consult_sessions')).toHaveLength(0);
      expect(await as(uid, 'select 1 from public.consult_checkins')).toHaveLength(0);
      expect(await as(uid, 'select 1 from public.consult_briefs')).toHaveLength(0);
      expect(await as(uid, 'select 1 from public.consult_messages')).toHaveLength(0);
    }
  });
  it('anon อ่านตารางไม่ได้เลย', async () => {
    await expect(as(null, 'select 1 from public.consult_briefs')).rejects.toThrow();
    await expect(as(null, 'select 1 from public.consult_providers')).rejects.toThrow();
  });
  it('เจ้าหน้าที่ของผู้ให้บริการอื่นเห็นการปรึกษาไม่ได้', async () => {
    expect(await as(STAFF_B, 'select 1 from public.consult_sessions')).toHaveLength(0);
    await expect(as(STAFF_B, 'select public.open_consult_brief($1)', [SESSION])).rejects.toThrow('forbidden');
  });
  it('เจ้าหน้าที่ที่ถูกเลือกเห็น session แต่อ่านตาราง brief/checkin ตรง ๆ ไม่ได้', async () => {
    expect(await as(STAFF_A, 'select 1 from public.consult_sessions')).toHaveLength(1);
    expect(await as(STAFF_A, 'select 1 from public.consult_briefs')).toHaveLength(0);
    expect(await as(STAFF_A, 'select 1 from public.consult_checkins')).toHaveLength(0);
  });
  it('แอดมินอ่านข้อมูลสุขภาพไม่ได้', async () => {
    expect(await as(ADMIN, 'select 1 from public.consult_sessions')).toHaveLength(0);
    expect(await as(ADMIN, 'select 1 from public.consult_briefs')).toHaveLength(0);
    await expect(as(ADMIN, 'select public.open_consult_brief($1)', [SESSION])).rejects.toThrow('forbidden');
  });
  it('ผู้ใช้ตั้งตัวเองเป็นเจ้าหน้าที่ไม่ได้', async () => {
    await expect(as(PATIENT, `insert into public.consult_staff values ($1, 'admin', null, now())`, [PATIENT])).rejects.toThrow();
  });
  it('ผู้ใช้ทั่วไปเพิ่มหรือแก้ผู้ให้บริการไม่ได้', async () => {
    await expect(as(PATIENT, `insert into public.consult_providers (kind, display_name) values ('clinic', 'X')`)).rejects.toThrow();
    expect(await as(PATIENT, `update public.consult_providers set rating = 5 returning id`)).toHaveLength(0);
  });
  it('แอดมินจัดการผู้ให้บริการได้', async () => {
    expect(await as(ADMIN, `update public.consult_providers set hours = '9-17' where id = $1 returning id`, [PROVIDER_B])).toHaveLength(1);
  });
});

describe('ข้อความ', () => {
  it('แอบอ้างเป็นเจ้าหน้าที่ไม่ได้ ระบบกำหนดบทบาทเอง', async () => {
    const rows = await as<{ sender_role: string }>(
      PATIENT,
      `insert into public.consult_messages (session_id, sender_id, sender_role, body) values ($1, $2, 'staff', 'สวัสดี') returning sender_role`,
      [SESSION, PATIENT]
    );
    expect(rows[0].sender_role).toBe('patient');
  });
  it('แอบส่งในนามคนอื่นหรือส่งเข้าห้องคนอื่นไม่ได้', async () => {
    await expect(as(PATIENT, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'x')`, [SESSION, STAFF_A])).rejects.toThrow();
    await expect(as(OTHER_PATIENT, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'x')`, [SESSION, OTHER_PATIENT])).rejects.toThrow();
  });
  it('แก้หรือลบข้อความไม่ได้', async () => {
    await expect(as(PATIENT, `update public.consult_messages set body = 'แก้'`)).rejects.toThrow();
    await expect(as(PATIENT, `delete from public.consult_messages`)).rejects.toThrow();
  });
});

describe('ไฟล์แนบ', () => {
  const canInsert = (uid: string) =>
    as(uid, `insert into storage.objects (bucket_id, name) values ('consult-files', $1) returning name`, [`${SESSION}/f1`]);
  it('เฉพาะผู้เกี่ยวข้องอัปโหลดได้', async () => {
    expect(await canInsert(PATIENT)).toHaveLength(1);
    expect(await canInsert(STAFF_A)).toHaveLength(1);
    await expect(canInsert(OTHER_PATIENT)).rejects.toThrow();
    await expect(canInsert(STAFF_B)).rejects.toThrow();
  });
  it('คนอื่นอ่านไฟล์ไม่ได้', async () => {
    expect(await as(OTHER_PATIENT, `select 1 from storage.objects where bucket_id = 'consult-files'`)).toHaveLength(0);
    expect((await as(PATIENT, `select 1 from storage.objects where bucket_id = 'consult-files'`)).length).toBeGreaterThan(0);
  });
});

describe('บันทึกผลและการปิดงาน', () => {
  it('ผู้ใช้เขียนบันทึกแทนเภสัชกร หรือรับเรื่องเองไม่ได้', async () => {
    await expect(as(PATIENT, `insert into public.consult_notes (session_id, author_id, assessment) values ($1, $2, 'x')`, [SESSION, PATIENT])).rejects.toThrow();
    await expect(as(PATIENT, `select public.set_consult_status($1, 'active')`, [SESSION])).rejects.toThrow('invalid_transition');
  });
  it('เจ้าหน้าที่รับเรื่องได้ และเปิด Brief ได้พร้อมบันทึกการเข้าถึง', async () => {
    await as(STAFF_A, `select public.set_consult_status($1, 'active')`, [SESSION]);
    const rows = await as<{ b: { symptoms: { severity: number } } }>(STAFF_A, 'select public.open_consult_brief($1) as b', [SESSION]);
    expect(rows[0].b.symptoms.severity).toBe(3);
    const log = await as<{ action: string }>(PATIENT, 'select action from public.consult_access_log where session_id = $1', [SESSION]);
    expect(log.map((l) => l.action)).toContain('brief_opened');
  });
  it('ผู้ใช้ปลอมสถานะด้วยการอัปเดตตรง ๆ ไม่ได้', async () => {
    await expect(as(PATIENT, `update public.consult_sessions set status = 'completed'`)).rejects.toThrow();
    await expect(as(STAFF_A, `insert into public.consult_access_log (session_id, action) values ($1, 'fake')`, [SESSION])).rejects.toThrow();
  });
  it('ปิดงานโดยไม่มีบันทึกไม่ได้', async () => {
    await expect(as(STAFF_A, 'select public.confirm_consult_note($1)', [SESSION])).rejects.toThrow('note_required');
  });
  it('ผู้ใช้ยังไม่เห็นบันทึกจนกว่าจะยืนยัน หลังยืนยันเห็นและแก้ไม่ได้ พร้อมสร้างนัดติดตาม', async () => {
    await as(STAFF_A, `insert into public.consult_notes (session_id, author_id, recommendation, follow_up_plan, follow_up_due) values ($1, $2, 'คำแนะนำ', 'ติดตาม', '2030-01-01')`, [SESSION, STAFF_A]);
    expect(await as(PATIENT, 'select 1 from public.consult_notes')).toHaveLength(0);
    await as(STAFF_A, 'select public.confirm_consult_note($1)', [SESSION]);
    expect(await as(PATIENT, 'select 1 from public.consult_notes')).toHaveLength(1);
    expect(await as(STAFF_A, `update public.consult_notes set recommendation = 'แก้' returning 1`)).toHaveLength(0);
    const fu = await as<{ id: string }>(PATIENT, 'select id from public.consult_followups');
    expect(fu).toHaveLength(1);
    await expect(as(OTHER_PATIENT, `select public.respond_consult_followup($1, '{}')`, [fu[0].id])).rejects.toThrow('forbidden');
    await as(PATIENT, `select public.respond_consult_followup($1, '{"severity": 2}')`, [fu[0].id]);
    const seen = await as<{ response: { severity: number } }>(STAFF_A, 'select response from public.consult_followups');
    expect(seen[0].response.severity).toBe(2);
    await as(STAFF_A, 'select public.review_consult_followup($1)', [fu[0].id]);
  });
});

describe('การถอนความยินยอม', () => {
  it('หลังถอนแล้วเจ้าหน้าที่เปิด Brief ไม่ได้ แต่ผู้ใช้ยังดูของตัวเองได้ และคนอื่นถอนแทนไม่ได้', async () => {
    await expect(as(OTHER_PATIENT, 'select public.revoke_consult_consent($1)', [SESSION])).rejects.toThrow('forbidden');
    await as(PATIENT, 'select public.revoke_consult_consent($1)', [SESSION]);
    await expect(as(STAFF_A, 'select public.open_consult_brief($1)', [SESSION])).rejects.toThrow('consent_revoked');
    expect(await as(PATIENT, 'select 1 from public.consult_briefs')).toHaveLength(1);
  });
});
