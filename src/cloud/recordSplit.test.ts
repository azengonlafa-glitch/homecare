import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HEALTH_KEYS, HIDDEN_FLAG, itemKey, mergeRecord, parseItemKey, splitRecord } from './recordSplit';

const full = {
  id: 'u1',
  age: 70,
  gender: 'female',
  photo: '',
  sharing: { shareData: false, editPolicy: 'choose', allowedEditors: [], blockedEditors: [] },
  health: { conditions: ['โรคสมมติ'] },
  meds: [{ id: 'm1' }],
  vitals: [],
  doseLogs: [],
  heightCm: 150,
  weightKg: 50,
  caregiverId: 'u2',
};

describe('แยก/รวมข้อมูลสมาชิก', () => {
  it('ส่วนที่ทุกคนเห็นไม่มีข้อมูลสุขภาพหลุดไป', () => {
    const { pub, health } = splitRecord(full);
    for (const k of HEALTH_KEYS) expect(pub).not.toHaveProperty(k);
    expect(pub).toMatchObject({ age: 70, sharing: full.sharing, caregiverId: 'u2' });
    expect(health).toEqual({ health: full.health, meds: full.meds, vitals: [], doseLogs: [], heightCm: 150, weightKg: 50 });
  });

  it('รวมกลับได้เหมือนเดิม', () => {
    const { pub, health } = splitRecord(full);
    expect(mergeRecord('u1', pub, health!, 'me')).toEqual(full);
  });

  it('ไม่ได้รับส่วนสุขภาพของคนอื่น = ติดป้ายซ่อน และตอนส่งกลับจะไม่ส่งส่วนสุขภาพ (กันค่าว่างทับของจริง)', () => {
    const { pub } = splitRecord(full);
    const merged = mergeRecord('u1', pub, undefined, 'me');
    expect(merged[HIDDEN_FLAG]).toBe(true);
    const again = splitRecord({ ...merged, health: { conditions: [] } });
    expect(again.health).toBeNull();
    expect(again.pub).not.toHaveProperty(HIDDEN_FLAG);
  });

  it('ข้อมูลของตัวเองไม่ถูกติดป้ายซ่อน แม้ยังไม่มีแถวสุขภาพบนเซิร์ฟเวอร์', () => {
    expect(mergeRecord('me', { age: 1 }, undefined, 'me')).not.toHaveProperty(HIDDEN_FLAG);
  });

  it('รหัสรายการแปลงไปกลับได้ แม้ id มีเครื่องหมาย :', () => {
    expect(parseItemKey(itemKey('member_health', 'a:b'))).toEqual({ collection: 'member_health', id: 'a:b' });
  });

  it('รายชื่อฟิลด์สุขภาพตรงกับฝั่งฐานข้อมูล', () => {
    const sql = readFileSync(new URL('../../supabase/health_privacy.sql', import.meta.url), 'utf8');
    const m = sql.match(/health_keys constant text\[\] := array\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    const fromSql = m![1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(fromSql).toEqual([...HEALTH_KEYS]);
  });
});
