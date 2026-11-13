import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * ทดสอบ health_privacy.sql กับ Postgres จำลองในหน่วยความจำ ไม่แตะฐานข้อมูลจริง บัญชีเป็นข้อมูลสมมติทั้งหมด
 * บ้านเดียว: OWNER (ผู้ดูแลหลัก), PRIVATE (ปิดการแชร์), OPEN (เปิดการแชร์), HELPER (สมาชิกอีกคน) และ OUTSIDER (คนละบ้าน)
 */
const OWNER = '00000000-0000-0000-0000-0000000000c1';
const PRIVATE = '00000000-0000-0000-0000-0000000000c2';
const OPEN = '00000000-0000-0000-0000-0000000000c3';
const HELPER = '00000000-0000-0000-0000-0000000000c4';
const OUTSIDER = '00000000-0000-0000-0000-0000000000c5';
const HOME = '30000000-0000-0000-0000-0000000000c1';
const OTHER_HOME = '30000000-0000-0000-0000-0000000000c2';

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

const sharing = (o: Partial<{ shareData: boolean; editPolicy: string; allowedEditors: string[]; blockedEditors: string[] }>) =>
  JSON.stringify({ shareData: true, editPolicy: 'choose', allowedEditors: [], blockedEditors: [], ...o });

/** อ่านแถวสุขภาพของ target ในสายตาของ viewer */
const readHealth = (viewer: string, target: string) =>
  as<{ data: Record<string, unknown> }>(viewer, `select data from public.home_items where home_id = $1 and collection = 'member_health' and id = $2`, [HOME, target]);

/** upsert แบบเดียวกับที่แอปส่งขึ้นเซิร์ฟเวอร์ */
const upsert = (uid: string, collection: string, id: string, data: unknown, home = HOME) =>
  as(
    uid,
    `insert into public.home_items (home_id, collection, id, data, updated_by) values ($1, $2, $3, $4::jsonb, $5)
     on conflict (home_id, collection, id) do update set data = excluded.data, updated_by = excluded.updated_by`,
    [home, collection, id, JSON.stringify(data), uid]
  );

const raw = async (collection: string, id: string) =>
  (await db.query<{ data: Record<string, unknown> }>(`select data from public.home_items where home_id = $1 and collection = $2 and id = $3`, [HOME, collection, id])).rows[0]?.data;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(readFileSync(resolve(__dirname, '../schema.sql'), 'utf8').replace('create extension if not exists pgcrypto;', ''));
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}','o@example.com'),('${PRIVATE}','p@example.com'),('${OPEN}','s@example.com'),('${HELPER}','h@example.com'),('${OUTSIDER}','x@example.com');
    insert into public.homes (id, name, invite_code, created_by) values ('${HOME}', 'บ้านสมมติ', '11111111', '${OWNER}'), ('${OTHER_HOME}', 'บ้านอื่น', '22222222', '${OUTSIDER}');
    insert into public.home_members (home_id, user_id, role) values
      ('${HOME}', '${OWNER}', 'owner'), ('${HOME}', '${PRIVATE}', 'member'), ('${HOME}', '${OPEN}', 'member'), ('${HOME}', '${HELPER}', 'member'),
      ('${OTHER_HOME}', '${OUTSIDER}', 'owner');
    -- ข้อมูลแบบเดิม (ก่อนแยก): ส่วนสุขภาพอยู่ในแถวเดียวกับค่าความเป็นส่วนตัว
    insert into public.home_items (home_id, collection, id, data) values
      ('${HOME}', 'member_records', '${PRIVATE}', '{"id":"${PRIVATE}","age":70,"sharing":${sharing({ shareData: false })},"health":{"conditions":["โรคสมมติ"]},"meds":[{"name":"ยาสมมติ"}],"heightCm":150}'),
      ('${HOME}', 'member_records', '${OPEN}', '{"id":"${OPEN}","age":40,"sharing":${sharing({})},"health":{"conditions":["โรคสมมติ 2"]},"vitals":[{"id":"v1"}]}'),
      ('${HOME}', 'member_records', '${OWNER}', '{"id":"${OWNER}","age":50,"sharing":${sharing({})},"health":{"conditions":["older"]}}');
    -- ช่วงก่อนรัน SQL แอปใหม่อาจเขียนแถวสุขภาพไว้แล้ว: OPEN มีฉบับที่เก่ากว่า (ต้องถูกแทน) OWNER มีฉบับที่ใหม่กว่า (ต้องเก็บไว้)
    update public.home_items set updated_at = '2026-01-01' where collection = 'member_records' and id = '${OWNER}';
    insert into public.home_items (home_id, collection, id, data, updated_at) values
      ('${HOME}', 'member_health', '${OPEN}', '{"health":{"conditions":["stale"]}}', '2020-01-01'),
      ('${HOME}', 'member_health', '${OWNER}', '{"health":{"conditions":["newer"]}}', now());
  `);
  // Supabase ให้สิทธิ์ระดับตารางกับ authenticated เป็นค่าเริ่มต้น (ส่วนที่คุมจริงคือ RLS)
  await db.exec('grant select, insert, update, delete on all tables in schema public to authenticated;');
  // รันไฟล์จริง 2 รอบ เพื่อยืนยันว่ารันซ้ำได้
  await db.exec(readFileSync(resolve(__dirname, '../health_privacy.sql'), 'utf8'));
  await db.exec(readFileSync(resolve(__dirname, '../health_privacy.sql'), 'utf8'));
});

describe('ย้ายข้อมูลเดิม', () => {
  it('ส่วนสุขภาพถูกย้ายออกจากแถวที่ทุกคนเห็น ไปอยู่แถวสุขภาพ ครบไม่หาย', async () => {
    const pub = await raw('member_records', PRIVATE);
    expect(pub).toMatchObject({ age: 70 });
    for (const k of ['health', 'meds', 'heightCm']) expect(pub, k).not.toHaveProperty(k);
    expect(await raw('member_health', PRIVATE)).toEqual({ health: { conditions: ['โรคสมมติ'] }, meds: [{ name: 'ยาสมมติ' }], heightCm: 150 });
    expect(await raw('member_health', OPEN)).toEqual({ health: { conditions: ['โรคสมมติ 2'] }, vitals: [{ id: 'v1' }] });
    // มีแถวสุขภาพที่ใหม่กว่าอยู่แล้ว: เก็บของใหม่ ไม่เอาข้อมูลเก่าจากแถวเดิมมาทับ
    expect(await raw('member_health', OWNER)).toEqual({ health: { conditions: ['newer'] } });
    expect(await raw('member_records', OWNER)).not.toHaveProperty('health');
    expect(await raw('member_health', HELPER)).toBeUndefined(); // ไม่มีข้อมูลสุขภาพ ไม่สร้างแถวว่าง
  });
});

describe('การดูข้อมูลสุขภาพ', () => {
  it('คนที่ปิดการแชร์: คนอื่นในบ้าน (รวมผู้ดูแลหลัก) มองไม่เห็นแถวสุขภาพ แต่ยังเห็นอายุและค่าความเป็นส่วนตัว', async () => {
    expect(await readHealth(OWNER, PRIVATE)).toHaveLength(0);
    expect(await readHealth(HELPER, PRIVATE)).toHaveLength(0);
    const pub = await as<{ data: { age: number; sharing: { shareData: boolean } } }>(OWNER, `select data from public.home_items where collection = 'member_records' and id = $1`, [PRIVATE]);
    expect(pub[0].data.age).toBe(70);
    expect(pub[0].data.sharing.shareData).toBe(false);
  });

  it('เจ้าของเห็นข้อมูลของตัวเองเสมอ', async () => {
    expect(await readHealth(PRIVATE, PRIVATE)).toHaveLength(1);
  });

  it('คนที่เปิดการแชร์: คนในบ้านเห็น แต่คนต่างบ้านไม่เห็น', async () => {
    expect(await readHealth(HELPER, OPEN)).toHaveLength(1);
    expect(await readHealth(OUTSIDER, OPEN)).toHaveLength(0);
  });
});

describe('การแก้ไขข้อมูลสุขภาพ', () => {
  it('ไม่มีสิทธิ์แก้ = แก้ไม่ได้ แม้จะเห็นข้อมูล', async () => {
    await expect(upsert(HELPER, 'member_health', OPEN, { health: { conditions: [] } })).rejects.toThrow();
    expect(await raw('member_health', OPEN)).toMatchObject({ health: { conditions: ['โรคสมมติ 2'] } });
  });

  it('เจ้าของอนุญาตรายคน (allowedEditors) = แก้ได้ และดูได้แม้ปิดการแชร์', async () => {
    await upsert(PRIVATE, 'member_records', PRIVATE, { id: PRIVATE, age: 70, sharing: JSON.parse(sharing({ shareData: false, allowedEditors: [HELPER] })) });
    expect(await readHealth(HELPER, PRIVATE)).toHaveLength(1);
    await upsert(HELPER, 'member_health', PRIVATE, { health: { conditions: ['โรคสมมติ'], note: 'แก้โดยผู้ช่วย' } });
    expect(await raw('member_health', PRIVATE)).toMatchObject({ health: { note: 'แก้โดยผู้ช่วย' } });
    expect(await readHealth(OWNER, PRIVATE)).toHaveLength(0); // คนอื่นที่ไม่ได้รับอนุญาตยังมองไม่เห็น
  });

  it('คนที่ถูกห้าม (blockedEditors) แก้ไม่ได้เด็ดขาด แม้ editPolicy = all', async () => {
    await upsert(OPEN, 'member_records', OPEN, { id: OPEN, age: 40, sharing: JSON.parse(sharing({ editPolicy: 'all', blockedEditors: [HELPER] })) });
    await expect(upsert(HELPER, 'member_health', OPEN, { health: {} })).rejects.toThrow();
    await upsert(OWNER, 'member_health', OPEN, { health: { conditions: ['โรคสมมติ 2'], note: 'ผู้ดูแลหลักแก้ได้เพราะ all' } });
    expect(await raw('member_health', OPEN)).toMatchObject({ health: { note: 'ผู้ดูแลหลักแก้ได้เพราะ all' } });
  });

  it('ลบแถวสุขภาพของคนอื่นไม่ได้', async () => {
    await as(OWNER, `delete from public.home_items where collection = 'member_health' and id = $1`, [OPEN]);
    expect(await raw('member_health', OPEN)).toBeDefined();
  });
});

describe('ค่าความเป็นส่วนตัว', () => {
  it('คนอื่นเปลี่ยนค่าความเป็นส่วนตัวของเจ้าของไม่ได้ (คนมีสิทธิ์แก้ก็เปลี่ยนไม่ได้ ค่าเดิมคงอยู่)', async () => {
    // OPEN ตั้ง editPolicy = all ไว้ OWNER จึงแก้แถวได้ แต่พยายามเปิดการแชร์/เพิ่มตัวเองไม่สำเร็จ
    await upsert(OWNER, 'member_records', OPEN, { id: OPEN, age: 41, sharing: JSON.parse(sharing({ editPolicy: 'all', blockedEditors: [] })) });
    const pub = (await raw('member_records', OPEN)) as { age: number; sharing: { blockedEditors: string[] } };
    expect(pub.age).toBe(41);
    expect(pub.sharing.blockedEditors).toEqual([HELPER]);
  });

  it('คนไม่มีสิทธิ์แก้ แก้แถวของคนอื่นไม่ได้เลย', async () => {
    await expect(upsert(OWNER, 'member_records', PRIVATE, { id: PRIVATE, age: 99, sharing: JSON.parse(sharing({})) })).rejects.toThrow(/forbidden/);
    expect(((await raw('member_records', PRIVATE)) as { age: number }).age).toBe(70);
  });

  it('สร้างแถวให้สมาชิกที่ยังไม่มีแถวได้ แต่ค่าความเป็นส่วนตัวถูกบังคับเป็นค่าเริ่มต้น', async () => {
    await upsert(OWNER, 'member_records', HELPER, { id: HELPER, age: 30, sharing: JSON.parse(sharing({ shareData: false, editPolicy: 'all', allowedEditors: [OWNER] })) });
    const pub = (await raw('member_records', HELPER)) as { sharing: { shareData: boolean; editPolicy: string; allowedEditors: string[] } };
    // ค่าเริ่มต้น = ทุกคนในบ้านดูได้ แต่ต้องขออนุญาตก่อนแก้ (คนสร้างแถวให้คนอื่นตั้งค่าเองไม่ได้)
    expect(pub.sharing.shareData).toBe(true);
    expect(pub.sharing.editPolicy).toBe('choose');
    expect(pub.sharing.allowedEditors).toEqual([]);
  });
});

describe('แท็บเก่าที่ยังส่งข้อมูลสุขภาพมาในแถวที่ทุกคนเห็น', () => {
  it('ข้อมูลสุขภาพถูกตัดออก และย้ายไปแถวสุขภาพของเจ้าของ', async () => {
    await upsert(PRIVATE, 'member_records', PRIVATE, {
      id: PRIVATE,
      age: 70,
      sharing: JSON.parse(sharing({ shareData: false, allowedEditors: [HELPER] })),
      health: { conditions: ['โรคใหม่'] },
      meds: [],
    });
    expect(await raw('member_records', PRIVATE)).not.toHaveProperty('health');
    expect(await raw('member_health', PRIVATE)).toMatchObject({ health: { conditions: ['โรคใหม่'] }, meds: [] });
    expect(await readHealth(OWNER, PRIVATE)).toHaveLength(0);
  });

  it('ถ้าคนส่งไม่มีสิทธิ์แก้ ข้อมูลสุขภาพถูกทิ้ง ไม่ย้ายไปไหน', async () => {
    // HELPER สร้างแถวใหม่ให้ OUTSIDER-like id ไม่ได้ในบ้านนี้ ใช้ OWNER (ไม่มีสิทธิ์แก้ PRIVATE) ลองแทรกแถวใหม่ของคนที่ยังไม่มีแถว
    await db.exec(`delete from public.home_items where collection in ('member_records','member_health') and id = '${HELPER}'`);
    await db.exec(`update public.home_items set data = jsonb_set(data, '{sharing,blockedEditors}', '["${OWNER}"]') where collection = 'member_records' and id = '${OPEN}'`);
    await upsert(OWNER, 'member_records', HELPER, { id: HELPER, age: 30, health: { conditions: ['ปลอม'] } });
    expect(await raw('member_records', HELPER)).not.toHaveProperty('health');
    expect(await raw('member_health', HELPER)).toBeUndefined();
  });
});

describe('คำขออนุญาต', () => {
  const req = (o: Record<string, unknown>) => ({
    id: 'r1', requesterId: OWNER, targetId: PRIVATE, scope: 'view', message: '', decision: 'pending', createdAt: '2026-11-13T00:00:00Z', decidedAt: null, usedAt: null, ...o,
  });

  it('ผู้ขออนุมัติให้ตัวเองตั้งแต่ตอนสร้างไม่ได้ และสร้างคำขอในนามคนอื่นไม่ได้', async () => {
    await expect(upsert(OWNER, 'access', 'r0', req({ id: 'r0', decision: 'always' }))).rejects.toThrow(/forbidden/);
    await expect(upsert(OWNER, 'access', 'r0', req({ id: 'r0', requesterId: HELPER }))).rejects.toThrow(/forbidden/);
  });

  it('ผู้ขอเปลี่ยนคำขอของตัวเองเป็น "อนุญาต" ไม่ได้', async () => {
    await upsert(OWNER, 'access', 'r1', req({}));
    await expect(upsert(OWNER, 'access', 'r1', req({ decision: 'always' }))).rejects.toThrow(/forbidden/);
    expect(await readHealth(OWNER, PRIVATE)).toHaveLength(0);
  });

  it('คนที่สามแก้คำขอของคนอื่นไม่ได้', async () => {
    await expect(upsert(HELPER, 'access', 'r1', req({ decision: 'always' }))).rejects.toThrow(/forbidden/);
  });

  it('เจ้าของข้อมูลอนุมัติ "อนุญาตตลอด" แล้วผู้ขอเห็นข้อมูล', async () => {
    await upsert(PRIVATE, 'access', 'r1', req({ decision: 'always', decidedAt: '2026-11-13T01:00:00Z' }));
    expect(await readHealth(OWNER, PRIVATE)).toHaveLength(1);
  });

  it('"อนุญาตครั้งนี้" ให้แก้ได้ครั้งเดียว: ผู้ขอบันทึกว่าใช้แล้วได้ และหลังจากนั้นแก้ไม่ได้อีก', async () => {
    await upsert(OWNER, 'access', 'r2', req({ id: 'r2', scope: 'edit' }));
    await upsert(PRIVATE, 'access', 'r2', req({ id: 'r2', scope: 'edit', decision: 'once', decidedAt: '2026-11-13T01:00:00Z' }));
    await upsert(OWNER, 'member_health', PRIVATE, { health: { conditions: ['แก้ครั้งเดียว'] } });
    await upsert(OWNER, 'access', 'r2', req({ id: 'r2', scope: 'edit', decision: 'once', decidedAt: '2026-11-13T01:00:00Z', usedAt: '2026-11-13T02:00:00Z' }));
    await expect(upsert(OWNER, 'member_health', PRIVATE, { health: { conditions: ['แก้ซ้ำ'] } })).rejects.toThrow();
    // ผู้ขอล้าง usedAt เพื่อใช้สิทธิ์ซ้ำไม่ได้
    await expect(upsert(OWNER, 'access', 'r2', req({ id: 'r2', scope: 'edit', decision: 'once', decidedAt: '2026-11-13T01:00:00Z', usedAt: null }))).rejects.toThrow(/forbidden/);
  });

  it('คนที่สามลบคำขอของคนอื่นไม่ได้', async () => {
    await as(HELPER, `delete from public.home_items where collection = 'access' and id = 'r1'`);
    expect(await raw('access', 'r1')).toBeDefined();
  });
});

describe('ออกจากบ้าน', () => {
  it('remove_member ลบทั้งแถวที่ทุกคนเห็นและแถวสุขภาพ', async () => {
    await as(PRIVATE, 'select public.remove_member($1, $2)', [HOME, PRIVATE]);
    expect(await raw('member_records', PRIVATE)).toBeUndefined();
    expect(await raw('member_health', PRIVATE)).toBeUndefined();
  });
});
