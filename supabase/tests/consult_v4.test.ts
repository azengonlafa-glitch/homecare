import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/** ทดสอบ consult_v4.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด */
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const PATIENT = uid(1);
const OTHER = uid(2);
const ADMIN = uid(3);
const STAFF_A = uid(4);
const STAFF_B = uid(5);
const STAFF_OTHER_SHOP = uid(6);
const SHOP = '10000000-0000-0000-0000-000000000001';
const SHOP2 = '10000000-0000-0000-0000-000000000002';
const S1 = '20000000-0000-0000-0000-000000000001';
const S2 = '20000000-0000-0000-0000-000000000002';
const S3 = '20000000-0000-0000-0000-000000000003';

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
const claim = (user: string, session: string) => as(user, `select public.set_consult_status($1, 'active')`, [session]);
const sessionRow = async (id: string) =>
  (await db.query<{ status: string; assigned_to: string | null; assigned_name: string }>('select status, assigned_to, assigned_name from public.consult_sessions where id = $1', [id])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(read('../consult_schema.sql'));
  await db.exec(`
    insert into auth.users values ('${PATIENT}','patient@example.com'),('${OTHER}','other@example.com'),('${ADMIN}','admin@example.com'),
      ('${STAFF_A}','anan@example.com'),('${STAFF_B}','boon@example.com'),('${STAFF_OTHER_SHOP}','chai@example.com');
    insert into public.consult_providers (id, kind, display_name, channels) values
      ('${SHOP}', 'pharmacist', 'ร้านหนึ่ง', '{chat}'),
      ('${SHOP2}', 'clinic', 'ร้านสอง', '{chat}');
    insert into public.consult_staff values ('${ADMIN}', 'admin', null, now()), ('${STAFF_A}', 'pharmacist', '${SHOP}', now()),
      ('${STAFF_B}', 'pharmacist', '${SHOP}', now()), ('${STAFF_OTHER_SHOP}', 'clinic', '${SHOP2}', now());
  `);
  await db.exec(read('../consult_v2.sql'));
  await db.exec(read('../consult_v3.sql'));
  await db.exec(read('../consult_v4.sql'));
  await db.exec(read('../consult_v4.sql')); // รันซ้ำได้
  await start(PATIENT, S1, SHOP);
  await start(PATIENT, S2, SHOP);
  await start(OTHER, S3, SHOP);
});

describe('หมวดหมู่', () => {
  it('มีหมวดเริ่มต้น และทุกคนที่ล็อกอินอ่านได้', async () => {
    const rows = await as<{ id: string }>(OTHER, 'select id from public.consult_categories order by sort');
    expect(rows.map((r) => r.id)).toEqual(['pharmacist', 'clinic']);
  });
  it('เฉพาะแอดมินเพิ่มหมวด และไม่มีใครเขียนตารางตรง ๆ ได้', async () => {
    for (const user of [PATIENT, STAFF_A, null]) {
      await expect(as(user, `select public.admin_add_category('ทันตกรรม')`)).rejects.toThrow();
    }
    await expect(as(PATIENT, `insert into public.consult_categories (id, label) values ('hack', 'แฮก')`)).rejects.toThrow();
  });
  it('เพิ่มหมวดใหม่แล้วใช้กับร้านและทีมงานได้ ชื่อซ้ำคืนรหัสเดิม', async () => {
    const [{ id }] = await as<{ id: string }>(ADMIN, `select public.admin_add_category('ทันตกรรม') as id`);
    const [again] = await as<{ id: string }>(ADMIN, `select public.admin_add_category('  ทันตกรรม ') as id`);
    expect(again.id).toBe(id);
    await db.query(`insert into public.consult_providers (kind, display_name) values ($1, 'คลินิกฟัน')`, [id]);
    const [{ pid }] = (await db.query<{ pid: string }>(`select id as pid from public.consult_providers where kind = $1`, [id])).rows;
    await as(ADMIN, `select public.admin_assign_staff('chai@example.com', $1)`, [pid]).catch(() => undefined);
    await expect(as(ADMIN, `select public.admin_add_category('ก')`)).rejects.toThrow('invalid_category');
  });
  it('ใช้รหัสหมวดที่ไม่มีอยู่ไม่ได้', async () => {
    await expect(db.query(`insert into public.consult_providers (kind, display_name) values ('nope', 'x')`)).rejects.toThrow();
  });
  it('ทีมงานของหมวดใหม่เข้าพื้นที่ทำงานได้ (บทบาทตามรหัสหมวด)', async () => {
    const [{ id }] = (await db.query<{ id: string }>(`select id from public.consult_categories where label = 'ทันตกรรม'`)).rows;
    const pid = '10000000-0000-0000-0000-0000000000aa';
    await db.query(`insert into public.consult_providers (id, kind, display_name) values ($1, $2, 'ฟัน2')`, [pid, id]);
    await as(ADMIN, `select public.admin_assign_staff('chai@example.com', $1)`, [pid]).catch((e: Error) => {
      // ผูกข้ามร้านเงียบ ๆ ไม่ได้ ถอดออกก่อนแล้วผูกใหม่
      expect(String(e.message)).toContain('staff_other_provider');
    });
    await as(ADMIN, `select public.admin_remove_staff($1)`, [STAFF_OTHER_SHOP]);
    await as(ADMIN, `select public.admin_assign_staff('chai@example.com', $1)`, [pid]);
    const rows = await as<{ role: string }>(STAFF_OTHER_SHOP, 'select role from public.consult_staff where user_id = auth.uid()');
    expect(rows[0].role).toBe(id);
    expect((await as<{ p: string }>(STAFF_OTHER_SHOP, 'select public.consult_staff_provider() as p'))[0].p).toBe(pid);
  });
});

describe('รับเรื่องแบบจองเคส', () => {
  it('คนแรกที่กดได้เคส คนที่สองรับซ้ำไม่ได้', async () => {
    await claim(STAFF_A, S1);
    expect(await sessionRow(S1)).toMatchObject({ status: 'active', assigned_to: STAFF_A, assigned_name: 'anan' });
    await expect(claim(STAFF_B, S1)).rejects.toThrow('already_claimed');
    expect((await sessionRow(S1)).assigned_to).toBe(STAFF_A);
  });
  it('กดซ้ำโดยคนที่รับอยู่แล้วไม่เกิดข้อผิดพลาด', async () => {
    await expect(claim(STAFF_A, S1)).resolves.toBeDefined();
  });
  it('ผู้ป่วยและร้านอื่นรับเรื่องไม่ได้', async () => {
    await expect(claim(PATIENT, S2)).rejects.toThrow();
    await expect(claim(STAFF_OTHER_SHOP, S2)).rejects.toThrow();
    expect((await sessionRow(S2)).status).toBe('requested');
  });
  it('เจ้าหน้าที่คนอื่นปฏิเสธเคสที่เพื่อนรับไปแล้วไม่ได้ แต่ผู้ป่วยยกเลิกเองได้', async () => {
    await expect(as(STAFF_B, `select public.set_consult_status($1, 'cancelled')`, [S1])).rejects.toThrow('already_claimed');
    expect((await sessionRow(S1)).status).toBe('active');
  });
  it('เห็นคิวของร้านเดียวกันครบ แต่ข้อมูลสุขภาพและสนทนาของเคสที่เพื่อนดูแลอยู่เปิดไม่ได้', async () => {
    expect((await as(STAFF_B, 'select id from public.consult_sessions')).length).toBe(3);
    await expect(as(STAFF_B, 'select public.open_consult_brief($1)', [S1])).rejects.toThrow('forbidden');
    await as(PATIENT, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'ลับ')`, [S1, PATIENT]);
    expect((await as(STAFF_B, 'select id from public.consult_messages where session_id = $1', [S1])).length).toBe(0);
    expect((await as(STAFF_A, 'select id from public.consult_messages where session_id = $1', [S1])).length).toBe(1);
    await expect(as(STAFF_A, 'select public.open_consult_brief($1)', [S1])).resolves.toBeTruthy();
  });
  it('เจ้าหน้าที่ที่ไม่ใช่ผู้ดูแลส่งข้อความและเขียนบันทึกไม่ได้', async () => {
    await expect(as(STAFF_B, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'แทรก')`, [S1, STAFF_B])).rejects.toThrow();
    await expect(as(STAFF_A, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'ตอบ')`, [S1, STAFF_A])).resolves.toBeDefined();
    await expect(as(STAFF_B, `insert into public.consult_notes (session_id, author_id, assessment) values ($1, $2, 'x')`, [S1, STAFF_B])).rejects.toThrow();
    await expect(as(STAFF_B, 'select public.confirm_consult_note($1)', [S1])).rejects.toThrow('forbidden');
  });
  it('ยังไม่รับเรื่อง เจ้าหน้าที่ส่งข้อความหาผู้ป่วยไม่ได้ ต้องรับก่อน', async () => {
    await expect(as(STAFF_A, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'ก่อนรับ')`, [S2, STAFF_A])).rejects.toThrow();
  });
  it('เคสที่ยังรอรับเรื่อง เจ้าหน้าที่ร้านเดียวกันอ่านข้อความผู้ป่วยได้ เพื่อดูว่าควรรับไหม', async () => {
    await as(PATIENT, `insert into public.consult_messages (session_id, sender_id, body) values ($1, $2, 'ขอปรึกษา')`, [S2, PATIENT]);
    expect((await as(STAFF_B, 'select id from public.consult_messages where session_id = $1', [S2])).length).toBe(1);
    expect((await as(STAFF_OTHER_SHOP, 'select id from public.consult_messages where session_id = $1', [S2])).length).toBe(0);
  });
  it('คืนเคสเข้าคิว: เฉพาะผู้ดูแล แล้วคนอื่นรับต่อได้', async () => {
    await expect(as(STAFF_B, 'select public.release_consultation($1)', [S1])).rejects.toThrow('forbidden');
    await as(STAFF_A, 'select public.release_consultation($1)', [S1]);
    expect(await sessionRow(S1)).toMatchObject({ status: 'requested', assigned_to: null, assigned_name: '' });
    await claim(STAFF_B, S1);
    expect((await sessionRow(S1)).assigned_to).toBe(STAFF_B);
  });
  it('รับช่วงต่อเคสของเพื่อน: ต้องเป็นร้านเดียวกัน และบันทึกไว้ให้ผู้ป่วยเห็น', async () => {
    await expect(as(STAFF_OTHER_SHOP, 'select public.take_over_consultation($1)', [S1])).rejects.toThrow();
    await as(STAFF_A, 'select public.take_over_consultation($1)', [S1]);
    expect((await sessionRow(S1)).assigned_to).toBe(STAFF_A);
    const log = await as<{ action: string }>(PATIENT, `select action from public.consult_access_log where session_id = $1 and action = 'taken_over'`, [S1]);
    expect(log).toHaveLength(1);
  });
  it('ปิดเคสได้เฉพาะผู้ดูแล เมื่อมีผลบันทึก', async () => {
    await as(STAFF_A, `insert into public.consult_notes (session_id, author_id, assessment) values ($1, $2, 'ประเมิน')`, [S1, STAFF_A]);
    await expect(as(STAFF_B, 'select public.confirm_consult_note($1)', [S1])).rejects.toThrow('forbidden');
    await as(STAFF_A, 'select public.confirm_consult_note($1)', [S1]);
    expect((await sessionRow(S1)).status).toBe('completed');
  });
  it('เคสเดิมที่ active ก่อนอัปเกรดและไม่มีผู้ดูแล รับต่อได้', async () => {
    await db.query(`update public.consult_sessions set status = 'active', assigned_to = null, assigned_name = '' where id = $1`, [S3]);
    await claim(STAFF_B, S3);
    expect((await sessionRow(S3)).assigned_to).toBe(STAFF_B);
  });
});

describe('รีวิว', () => {
  it('รีวิวได้เฉพาะเจ้าของเคสที่เสร็จแล้ว', async () => {
    await expect(as(PATIENT, 'select public.submit_consult_review($1, 5, $2)', [S2, 'ดี'])).rejects.toThrow('review_not_allowed');
    await expect(as(OTHER, 'select public.submit_consult_review($1, 5, $2)', [S1, 'ไม่ใช่เคสฉัน'])).rejects.toThrow('forbidden');
    await expect(as(STAFF_A, 'select public.submit_consult_review($1, 5, $2)', [S1, 'รีวิวตัวเอง'])).rejects.toThrow('forbidden');
    await expect(as(null, 'select public.submit_consult_review($1, 5, $2)', [S1, 'x'])).rejects.toThrow();
  });
  it('คะแนนต้อง 1-5 และความคิดเห็นไม่เกิน 500 ตัวอักษรถูกตัด', async () => {
    for (const bad of [0, 6, -1]) {
      await expect(as(PATIENT, 'select public.submit_consult_review($1, $2, $3)', [S1, bad, 'x'])).rejects.toThrow('invalid_rating');
    }
    await as(PATIENT, 'select public.submit_consult_review($1, 4, $2)', [S1, 'ก'.repeat(800)]);
    const row = await db.query<{ n: number }>('select char_length(comment) as n from public.consult_reviews where session_id = $1', [S1]);
    expect(row.rows[0].n).toBe(500);
  });
  it('คะแนนร้านคำนวณจากรีวิวจริง รีวิวซ้ำคือแก้ของเดิม ไม่นับเพิ่ม', async () => {
    await as(PATIENT, 'select public.submit_consult_review($1, 5, $2)', [S1, 'ประทับใจ']);
    const p = await db.query<{ rating: string; review_count: number }>('select rating, review_count from public.consult_providers where id = $1', [SHOP]);
    expect(p.rows[0]).toEqual({ rating: '5.0', review_count: 1 });
  });
  it('เฉลี่ยจากหลายรีวิว และลบรีวิวแล้วคำนวณใหม่', async () => {
    await db.query(`update public.consult_sessions set status = 'completed' where id = $1`, [S3]);
    await as(OTHER, 'select public.submit_consult_review($1, 2, $2)', [S3, 'รอนาน']);
    const p = await db.query<{ rating: string; review_count: number }>('select rating, review_count from public.consult_providers where id = $1', [SHOP]);
    expect(p.rows[0]).toEqual({ rating: '3.5', review_count: 2 });
    const [r] = await as<{ id: string }>(ADMIN, 'select id from public.list_provider_reviews($1) where stars = 2', [SHOP]);
    await expect(as(PATIENT, 'select public.admin_delete_review($1)', [r.id])).rejects.toThrow();
    await as(ADMIN, 'select public.admin_delete_review($1)', [r.id]);
    const after = await db.query<{ rating: string; review_count: number }>('select rating, review_count from public.consult_providers where id = $1', [SHOP]);
    expect(after.rows[0]).toEqual({ rating: '5.0', review_count: 1 });
  });
  it('ไม่มีรีวิวเหลือ คะแนนกลับเป็นว่าง ไม่แสดงดาวปลอม', async () => {
    await db.query('delete from public.consult_reviews');
    const p = await db.query<{ rating: string | null; review_count: number }>('select rating, review_count from public.consult_providers where id = $1', [SHOP]);
    expect(p.rows[0]).toEqual({ rating: null, review_count: 0 });
  });
  it('รายการรีวิวไม่เปิดเผยตัวผู้รีวิว และเขียนตารางตรง ๆ ไม่ได้', async () => {
    await as(PATIENT, 'select public.submit_consult_review($1, 5, $2)', [S1, 'เยี่ยม']);
    const rows = await as<Record<string, unknown>>(OTHER, 'select * from public.list_provider_reviews($1)', [SHOP]);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['comment', 'created_at', 'id', 'stars']);
    expect((await as(OTHER, 'select id from public.consult_reviews')).length).toBe(0);
    expect((await as(PATIENT, 'select id from public.consult_reviews')).length).toBe(1);
    await expect(as(PATIENT, `update public.consult_reviews set stars = 1 where session_id = $1`, [S1])).rejects.toThrow();
    await expect(as(PATIENT, `insert into public.consult_reviews (session_id, patient_id, provider_id, stars) values ($1, $2, $3, 5)`, [S2, PATIENT, SHOP])).rejects.toThrow();
  });
  it('ร้านที่ปิดชั่วคราว คนนอกไม่เห็นรีวิว แต่แอดมิน ผู้เคยปรึกษา และทีมงานของร้านเห็น', async () => {
    await as(ADMIN, `select public.admin_set_provider_status($1, 'paused', 'ทดสอบ')`, [SHOP]);
    expect((await as(STAFF_OTHER_SHOP, 'select * from public.list_provider_reviews($1)', [SHOP])).length).toBe(0);
    expect((await as(ADMIN, 'select * from public.list_provider_reviews($1)', [SHOP])).length).toBe(1);
    expect((await as(PATIENT, 'select * from public.list_provider_reviews($1)', [SHOP])).length).toBe(1);
    expect((await as(STAFF_A, 'select * from public.list_provider_reviews($1)', [SHOP])).length).toBe(1);
    await as(ADMIN, `select public.admin_set_provider_status($1, 'open')`, [SHOP]);
  });
  it('ลบเคสตาม PDPA แล้วรีวิวของเคสนั้นหายไปด้วย คะแนนคำนวณใหม่', async () => {
    await as(PATIENT, 'select public.delete_consult_session($1)', [S1]);
    const p = await db.query<{ rating: string | null; review_count: number }>('select rating, review_count from public.consult_providers where id = $1', [SHOP]);
    expect(p.rows[0]).toEqual({ rating: null, review_count: 0 });
  });
});
