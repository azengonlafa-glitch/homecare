import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบสิทธิ์ของ consult_v3.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด */
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const PATIENT = uid(1);
const OTHER = uid(2);
const ADMIN = uid(3);
const STAFF = uid(4);
const EXTRA = Array.from({ length: 6 }, (_, i) => uid(100 + i));
const OPEN_P = '10000000-0000-0000-0000-000000000001';
const PAUSED_P = '10000000-0000-0000-0000-000000000002';
const SHOP = '10000000-0000-0000-0000-000000000003';
const EMPTY_SHOP = '10000000-0000-0000-0000-000000000004';
const S_OPEN = '20000000-0000-0000-0000-000000000001';
const S_SHOP = '20000000-0000-0000-0000-000000000002';

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

async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}; select set_config('test.uid', '${user ?? ''}', true);`);
    return (await tx.query<T>(sql, params)).rows;
  });
}

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8');
const start = (user: string, session: string, provider: string) =>
  as(user, `select public.start_consultation($1, $2, 'chat', 'หัวข้อ', 'ผู้ทดสอบ', 'routine', null, '{}', '{}', '{symptoms}', 'v1')`, [session, provider]);
const status = async (id: string) => (await db.query<{ status: string }>('select status from public.consult_providers where id = $1', [id])).rows[0]?.status;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(read('../consult_schema.sql'));
  await db.exec(`
    insert into auth.users values ('${PATIENT}','patient@example.com'),('${OTHER}','other@example.com'),('${ADMIN}','admin@example.com'),('${STAFF}','staff@example.com');
    ${EXTRA.map((id, i) => `insert into auth.users values ('${id}','extra${i}@example.com');`).join('\n')}
    insert into public.consult_providers (id, kind, display_name, channels, active) values
      ('${OPEN_P}', 'pharmacist', 'เปิดอยู่', '{chat}', true),
      ('${PAUSED_P}', 'pharmacist', 'ปิดไว้เดิม', '{chat}', false),
      ('${SHOP}', 'clinic', 'ร้านมีประวัติ', '{chat}', true),
      ('${EMPTY_SHOP}', 'pharmacist', 'ร้านว่าง', '{chat}', true);
    insert into public.consult_staff values ('${ADMIN}', 'admin', null, now()), ('${STAFF}', 'pharmacist', '${OPEN_P}', now());
  `);
  await db.exec(read('../consult_v2.sql'));
  await db.exec(read('../consult_v3.sql'));
  await db.exec(read('../consult_v3.sql')); // รันซ้ำได้
  await start(PATIENT, S_OPEN, OPEN_P);
  await start(PATIENT, S_SHOP, SHOP);
});

describe('ย้ายข้อมูลเดิม', () => {
  it('ค่า active เดิมกลายเป็นสถานะ และคอลัมน์ active หายไป', async () => {
    expect(await status(OPEN_P)).toBe('open');
    expect(await status(PAUSED_P)).toBe('paused');
    const cols = await db.query(`select 1 from information_schema.columns where table_name = 'consult_providers' and column_name = 'active'`);
    expect(cols.rows).toHaveLength(0);
  });
});

describe('การมองเห็นของผู้ใช้', () => {
  it('ผู้ใช้ทั่วไปเห็นเฉพาะร้านที่เปิด', async () => {
    const rows = await as<{ id: string }>(OTHER, 'select id from public.consult_providers');
    expect(rows.map((r) => r.id).sort()).toEqual([OPEN_P, SHOP, EMPTY_SHOP].sort());
  });
  it('ร้านที่เคยปรึกษายังเห็นได้แม้ถูกปิด เพื่อให้ห้องและประวัติแสดงชื่อ แต่คนอื่นไม่เห็น', async () => {
    await as(ADMIN, `select public.admin_set_provider_status($1, 'paused', 'ทดสอบ')`, [SHOP]);
    expect((await as<{ id: string }>(PATIENT, 'select id from public.consult_providers where id = $1', [SHOP])).length).toBe(1);
    expect((await as<{ id: string }>(OTHER, 'select id from public.consult_providers where id = $1', [SHOP])).length).toBe(0);
  });
  it('เริ่มปรึกษากับร้านที่ปิดชั่วคราวหรือแบนไม่ได้', async () => {
    await expect(start(OTHER, '20000000-0000-0000-0000-000000000009', PAUSED_P)).rejects.toThrow('provider_unavailable');
    await expect(start(OTHER, '20000000-0000-0000-0000-000000000009', SHOP)).rejects.toThrow('provider_unavailable');
  });
});

describe('สถานะร้าน', () => {
  it('เฉพาะแอดมินเปลี่ยนสถานะ และต้องเป็นค่าที่กำหนด', async () => {
    for (const user of [PATIENT, STAFF, null]) {
      await expect(as(user, `select public.admin_set_provider_status($1, 'banned')`, [OPEN_P])).rejects.toThrow();
    }
    await expect(as(ADMIN, `select public.admin_set_provider_status($1, 'weird')`, [OPEN_P])).rejects.toThrow('invalid_status');
    await expect(as(ADMIN, `select public.admin_set_provider_status($1, 'paused')`, ['10000000-0000-0000-0000-0000000000ff'])).rejects.toThrow('provider_unavailable');
    expect(await status(OPEN_P)).toBe('open');
  });
  it('ปิดชั่วคราว: การปรึกษาที่เปิดอยู่ไม่ถูกยกเลิก ทีมงานยังเปิดรายงานได้', async () => {
    const cancelled = await as<{ n: number }>(ADMIN, `select public.admin_set_provider_status($1, 'paused', 'พักร้อน') as n`, [OPEN_P]);
    expect(cancelled[0].n).toBe(0);
    expect(await status(OPEN_P)).toBe('paused');
    const s = await db.query<{ status: string }>('select status from public.consult_sessions where id = $1', [S_OPEN]);
    expect(s.rows[0].status).toBe('requested');
    await expect(as(STAFF, 'select public.open_consult_brief($1)', [S_OPEN])).resolves.toBeTruthy();
  });
  it('เปิดใหม่ล้างบันทึกเหตุผลเดิม', async () => {
    await as(ADMIN, `select public.admin_set_provider_status($1, 'open')`, [OPEN_P]);
    const row = await db.query<{ status: string; status_note: string }>('select status, status_note from public.consult_providers where id = $1', [OPEN_P]);
    expect(row.rows[0]).toEqual({ status: 'open', status_note: '' });
  });
  it('แบน: ยกเลิกการปรึกษาที่ค้าง บันทึกลงประวัติการเข้าถึงให้ผู้ป่วยเห็น และทีมงานเข้าไม่ได้ทันที', async () => {
    const n = await as<{ n: number }>(ADMIN, `select public.admin_set_provider_status($1, 'banned', 'ผิดเงื่อนไข') as n`, [OPEN_P]);
    expect(n[0].n).toBe(1);
    const s = await db.query<{ status: string }>('select status from public.consult_sessions where id = $1', [S_OPEN]);
    expect(s.rows[0].status).toBe('cancelled');
    const log = await as<{ action: string }>(PATIENT, 'select action from public.consult_access_log where session_id = $1', [S_OPEN]);
    expect(log.map((l) => l.action)).toContain('cancelled_by_admin');
    expect(await as(STAFF, 'select public.consult_staff_provider() as p')).toEqual([{ p: null }]);
    await expect(as(STAFF, 'select public.open_consult_brief($1)', [S_OPEN])).rejects.toThrow('forbidden');
    expect(await as(STAFF, 'select 1 from public.consult_sessions')).toHaveLength(0);
  });
  it('ร้านที่ถูกแบนเลิกออนไลน์ ปรากฏให้ผู้ป่วยเดิมเห็นแต่ผู้อื่นไม่เห็น', async () => {
    const row = await db.query<{ is_online: boolean }>('select is_online from public.consult_providers where id = $1', [OPEN_P]);
    expect(row.rows[0].is_online).toBe(false);
    expect((await as(OTHER, 'select 1 from public.consult_providers where id = $1', [OPEN_P])).length).toBe(0);
    expect((await as(PATIENT, 'select 1 from public.consult_providers where id = $1', [OPEN_P])).length).toBe(1);
  });
});

describe('การลบร้าน', () => {
  it('คนอื่นลบไม่ได้', async () => {
    for (const user of [PATIENT, STAFF, null]) {
      await expect(as(user, 'select public.admin_delete_provider($1)', [EMPTY_SHOP])).rejects.toThrow();
    }
    expect(await status(EMPTY_SHOP)).toBe('open');
  });
  it('ร้านที่มีประวัติลบไม่ได้ ต้องแบนแทน', async () => {
    await expect(as(ADMIN, 'select public.admin_delete_provider($1)', [SHOP])).rejects.toThrow('provider_has_history');
    expect(await status(SHOP)).toBe('paused');
  });
  it('ร้านที่ไม่มีประวัติลบได้ พร้อมลบบัญชีทีมงานของร้าน และไม่ลบคนอื่น', async () => {
    await as(ADMIN, `select public.admin_assign_staff('extra0@example.com', $1, '0812345678')`, [EMPTY_SHOP]);
    await as(ADMIN, 'select public.admin_delete_provider($1)', [EMPTY_SHOP]);
    expect(await status(EMPTY_SHOP)).toBeUndefined();
    const staff = await db.query('select 1 from public.consult_staff where provider_id = $1', [EMPTY_SHOP]);
    expect(staff.rows).toHaveLength(0);
    expect((await db.query('select 1 from public.consult_staff where user_id = $1', [STAFF])).rows).toHaveLength(1);
    expect((await db.query('select 1 from public.consult_staff where role = $1', ['admin'])).rows).toHaveLength(1);
  });
  it('ผู้ป่วยลบประวัติของตัวเองแล้ว ร้านก็ลบได้', async () => {
    await as(PATIENT, `select public.set_consult_status($1, 'cancelled')`, [S_SHOP]).catch(() => undefined);
    await as(PATIENT, 'select public.delete_consult_session($1)', [S_SHOP]);
    await as(ADMIN, 'select public.admin_delete_provider($1)', [SHOP]);
    expect(await status(SHOP)).toBeUndefined();
  });
});

describe('ทีมงานและเบอร์โทร', () => {
  const assign = (user: string | null, email: string, provider: string, phone = '') =>
    as(user, 'select public.admin_assign_staff($1, $2, $3)', [email, provider, phone]);
  const team = '10000000-0000-0000-0000-000000000005';

  beforeAll(async () => {
    await db.exec(`insert into public.consult_providers (id, kind, display_name, channels) values ('${team}', 'pharmacist', 'ร้านทีม', '{chat}'), ('10000000-0000-0000-0000-000000000006', 'clinic', 'ร้านอื่น', '{chat}')`);
  });

  it('เฉพาะแอดมินดูและผูกทีมงานได้', async () => {
    for (const user of [PATIENT, STAFF, null]) {
      await expect(assign(user, 'extra1@example.com', team)).rejects.toThrow();
      await expect(as(user, 'select * from public.admin_list_staff()')).rejects.toThrow();
    }
  });
  it('เก็บเบอร์ในรูปตัวเลขล้วน ตัดขีดและช่องว่าง และแสดงในรายการ', async () => {
    await assign(ADMIN, 'extra1@example.com', team, '081-234 5678');
    const rows = await as<{ email: string; phone: string; role: string }>(ADMIN, 'select email, phone, role from public.admin_list_staff()');
    expect(rows.find((r) => r.email === 'extra1@example.com')).toMatchObject({ phone: '0812345678', role: 'pharmacist' });
  });
  it('เบอร์ผิดรูปแบบถูกปฏิเสธ แต่เว้นว่างได้', async () => {
    await expect(assign(ADMIN, 'extra2@example.com', team, '12345')).rejects.toThrow('invalid_phone');
    await expect(assign(ADMIN, 'extra2@example.com', team, '+66812345678')).rejects.toThrow('invalid_phone');
    await assign(ADMIN, 'extra2@example.com', team, '');
  });
  it('ผูกซ้ำเพื่อแก้เบอร์ได้ โดยไม่นับเป็นคนใหม่', async () => {
    await assign(ADMIN, 'extra1@example.com', team, '0899999999');
    const rows = await as<{ phone: string }>(ADMIN, `select phone from public.admin_list_staff() where email = 'extra1@example.com'`);
    expect(rows[0].phone).toBe('0899999999');
  });
  it('ร้านละไม่เกิน 5 คน คนที่ 6 ถูกปฏิเสธ แต่แก้เบอร์คนเดิมตอนเต็มได้', async () => {
    await assign(ADMIN, 'extra3@example.com', team);
    await assign(ADMIN, 'extra4@example.com', team);
    await assign(ADMIN, 'extra5@example.com', team);
    expect((await db.query('select 1 from public.consult_staff where provider_id = $1', [team])).rows).toHaveLength(5);
    await expect(assign(ADMIN, 'other@example.com', team)).rejects.toThrow('staff_limit');
    await assign(ADMIN, 'extra5@example.com', team, '0211111111');
    expect((await db.query('select 1 from public.consult_staff where provider_id = $1', [team])).rows).toHaveLength(5);
  });
  it('ย้ายคนข้ามร้านเงียบ ๆ ไม่ได้ ต้องถอดออกก่อน', async () => {
    await expect(assign(ADMIN, 'extra1@example.com', '10000000-0000-0000-0000-000000000006')).rejects.toThrow('staff_other_provider');
    await as(ADMIN, 'select public.admin_remove_staff($1)', [EXTRA[1]]);
    await assign(ADMIN, 'extra1@example.com', '10000000-0000-0000-0000-000000000006');
  });
  it('อีเมลที่ไม่มีบัญชี และบัญชีแอดมิน ผูกเป็นทีมงานไม่ได้', async () => {
    await expect(assign(ADMIN, 'nobody@example.com', team)).rejects.toThrow('user_not_found');
    await expect(assign(ADMIN, 'admin@example.com', team)).rejects.toThrow('target_is_admin');
  });
  it('เบอร์ทีมงานเห็นได้เฉพาะแอดมินและเจ้าของเบอร์ ผู้ป่วยอ่านตารางไม่ได้', async () => {
    expect(await as(PATIENT, 'select 1 from public.consult_staff')).toHaveLength(0);
    expect((await as(EXTRA[3], 'select phone from public.consult_staff')).length).toBe(1);
  });
});

describe('ข้อมูลร้านและรูป', () => {
  const insert = (user: string, cols: string, vals: unknown[]) =>
    as(user, `insert into public.consult_providers (kind, display_name, ${cols}) values ('clinic', 'ทดสอบ', ${vals.map((_, i) => `$${i + 1}`).join(', ')}) returning id`, vals);

  it('เฉพาะแอดมินเพิ่มร้านได้', async () => {
    await expect(insert(PATIENT, 'about', ['x'])).rejects.toThrow();
    expect(await insert(ADMIN, 'about', ['แนะนำตัวสมมติ'])).toHaveLength(1);
  });
  it('เบอร์ อีเมล เว็บไซต์ แผนที่ ต้องอยู่ในรูปแบบที่ถูกต้อง', async () => {
    await expect(insert(ADMIN, 'phone', ['abc'])).rejects.toThrow();
    await expect(insert(ADMIN, 'contact_email', ['not-an-email'])).rejects.toThrow();
    await expect(insert(ADMIN, 'website', ['http://example.com'])).rejects.toThrow();
    await expect(insert(ADMIN, 'map_url', ['javascript:alert(1)'])).rejects.toThrow();
    expect(await insert(ADMIN, 'phone, contact_email, website, map_url', ['0212345678', 'shop@example.com', 'https://example.com', 'https://maps.example.com/x'])).toHaveLength(1);
  });
  it('รูปรับเฉพาะรูปที่ย่อแล้วหรือลิงก์ https ไม่รับสคริปต์ ไฟล์อื่น หรือรูปใหญ่เกิน', async () => {
    await expect(insert(ADMIN, 'photo_url', ['data:text/html;base64,PHNjcmlwdD4='])).rejects.toThrow();
    await expect(insert(ADMIN, 'photo_url', ['data:image/svg+xml;base64,PHN2Zz4='])).rejects.toThrow();
    await expect(insert(ADMIN, 'photo_url', ['javascript:alert(1)'])).rejects.toThrow();
    await expect(insert(ADMIN, 'photo_url', [`data:image/jpeg;base64,${'A'.repeat(150_000)}`])).rejects.toThrow();
    expect(await insert(ADMIN, 'photo_url', ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='])).toHaveLength(1);
    expect(await insert(ADMIN, 'photo_url', ['https://example.com/a.jpg'])).toHaveLength(1);
  });
  it('ผู้ป่วยแก้ข้อมูลร้านหรือสถานะตรง ๆ ไม่ได้', async () => {
    expect(await as(PATIENT, `update public.consult_providers set status = 'banned' returning 1`)).toHaveLength(0);
    await expect(as(PATIENT, `delete from public.consult_providers`)).rejects.toThrow();
  });
});
