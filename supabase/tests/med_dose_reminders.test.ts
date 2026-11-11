import { describe, expect, it } from 'vitest';
import {
  bangkokNow,
  dosePayload,
  dueDoseKeys,
  isScheduledOn,
  sendDoseReminders,
  type MedsDoc,
  type PushSubscriptionRow,
  type SendResult,
} from '../functions/med-dose-reminders/doses';

// 08:05 น. ไทย วันที่ 2026-11-11 (พุธ) = 01:05 UTC
const AT_0805 = new Date('2026-11-11T01:05:00Z');
const med = (over = {}) => ({
  id: 'm1',
  active: true,
  periods: ['morning' as const],
  times: {},
  weekdays: [] as number[],
  startDate: '2026-11-01',
  ...over,
});
const doc = (meds: unknown[], logs: unknown[] = []) => ({ meds, logs }) as MedsDoc;

describe('เวลาไทย', () => {
  it('แปลงเป็นวันที่และนาทีตามเวลาไทย', () => {
    expect(bangkokNow(AT_0805)).toEqual({ date: '2026-11-11', minutes: 8 * 60 + 5 });
    // 18:30 UTC = 01:30 ไทยของวันถัดไป
    expect(bangkokNow(new Date('2026-11-10T18:30:00Z'))).toEqual({ date: '2026-11-11', minutes: 90 });
  });
});

describe('isScheduledOn', () => {
  it('ไม่เตือนยาที่หยุดแล้ว ยังไม่ถึงวันเริ่ม ยาเมื่อจำเป็น หรือไม่ใช่วันที่ตั้งไว้', () => {
    expect(isScheduledOn(med(), '2026-11-11')).toBe(true);
    expect(isScheduledOn(med({ active: false }), '2026-11-11')).toBe(false);
    expect(isScheduledOn(med({ startDate: '2026-11-12' }), '2026-11-11')).toBe(false);
    expect(isScheduledOn(med({ asNeeded: true }), '2026-11-11')).toBe(false);
    expect(isScheduledOn(med({ stoppedAt: '2026-11-11' }), '2026-11-11')).toBe(false);
    expect(isScheduledOn(med({ durationDays: 5 }), '2026-11-11')).toBe(false);
    expect(isScheduledOn(med({ durationDays: 30 }), '2026-11-11')).toBe(true);
    // 2026-11-11 เป็นวันพุธ (3)
    expect(isScheduledOn(med({ weekdays: [1, 5] }), '2026-11-11')).toBe(false);
    expect(isScheduledOn(med({ weekdays: [3] }), '2026-11-11')).toBe(true);
  });
});

describe('dueDoseKeys', () => {
  it('เตือนเมื่อถึงเวลา (ค่ากลางเช้า 08:00) และยังไม่ได้บันทึก', () => {
    expect(dueDoseKeys(doc([med()]), AT_0805)).toEqual([{ key: '2026-11-11:morning', period: 'morning' }]);
  });
  it('ยังไม่ถึงเวลา หรือเลยหน้าต่างส่งมานานแล้ว ไม่เตือน', () => {
    expect(dueDoseKeys(doc([med()]), new Date('2026-11-11T00:55:00Z'))).toEqual([]); // 07:55
    expect(dueDoseKeys(doc([med()]), new Date('2026-11-11T01:30:00Z'))).toEqual([]); // 08:30
  });
  it('ใช้เวลาที่ตั้งเองและเวลาหน่วงรายยา', () => {
    expect(dueDoseKeys(doc([med({ times: { morning: '07:00' } })]), AT_0805)).toEqual([]);
    expect(dueDoseKeys(doc([med({ reminderDelayMin: 5 })]), AT_0805)).toHaveLength(1);
  });
  it('กินแล้วหรือบันทึกไว้แล้วไม่เตือน', () => {
    const logs = [{ date: '2026-11-11', medId: 'm1', period: 'morning' }];
    expect(dueDoseKeys(doc([med()], logs), AT_0805)).toEqual([]);
  });
  it('หลายยาในมื้อเดียวกันเตือนครั้งเดียว และข้อมูลเสียไม่ทำให้พัง', () => {
    expect(dueDoseKeys(doc([med(), med({ id: 'm2' })]), AT_0805)).toHaveLength(1);
    expect(dueDoseKeys(null, AT_0805)).toEqual([]);
    expect(dueDoseKeys({ meds: 'x' as never, logs: 5 as never }, AT_0805)).toEqual([]);
  });
});

describe('ข้อความแจ้งเตือน', () => {
  it('ไม่มีชื่อยา เพราะอาจขึ้นบนหน้าจอล็อก', () => {
    const p = JSON.parse(dosePayload('2026-11-11:morning'));
    expect(p.url).toBe('/meds');
    expect(JSON.stringify(p)).not.toMatch(/Metformin|mg/i);
  });
});

const sub = (endpoint: string, user_id: string): PushSubscriptionRow => ({ endpoint, user_id, p256dh: 'p', auth: 'a' });

type UserRow = { user_id: string; meds: MedsDoc | null; doseReminders: boolean };

function harness(users: UserRow[], subs: PushSubscriptionRow[], results: Record<string, SendResult> = {}) {
  const sent: string[] = [];
  const claimed = new Set<string>();
  const deleted: string[] = [];
  const released: string[] = [];
  const deps = {
    listUsers: async () => users,
    listSubscriptions: async (ids: string[]) => subs.filter((s) => ids.includes(s.user_id)),
    claim: async (u: string, k: string) => {
      const id = `${u}|${k}`;
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    release: async (u: string, k: string) => {
      claimed.delete(`${u}|${k}`);
      released.push(k);
    },
    send: async (s: PushSubscriptionRow) => {
      sent.push(s.endpoint);
      return results[s.endpoint] ?? 'ok';
    },
    deleteSubscription: async (e: string) => {
      deleted.push(e);
    },
  };
  return { deps, sent, deleted, released };
}

describe('sendDoseReminders', () => {
  const user: UserRow = { user_id: 'u1', meds: doc([med()]), doseReminders: true };

  it('ส่งให้ทุกเครื่องของผู้ใช้ และไม่ส่งซ้ำเมื่อ cron รอบถัดไปมาถึง', async () => {
    const h = harness([user], [sub('e1', 'u1'), sub('e2', 'u1')]);
    expect((await sendDoseReminders(h.deps, AT_0805)).sent).toBe(1);
    expect(h.sent).toEqual(['e1', 'e2']);
    const again = await sendDoseReminders(h.deps, new Date('2026-11-11T01:10:00Z'));
    expect(again.sent).toBe(0);
    expect(again.skippedDuplicate).toBe(1);
    expect(h.sent).toHaveLength(2);
  });

  it('ผู้ใช้ปิดเตือนช่วงเวลากินยา หรือไม่มีเครื่องรับ ไม่ส่ง', async () => {
    const off = harness([{ ...user, doseReminders: false }], [sub('e1', 'u1')]);
    expect((await sendDoseReminders(off.deps, AT_0805)).sent).toBe(0);
    const none = harness([user], []);
    expect((await sendDoseReminders(none.deps, AT_0805)).sent).toBe(0);
  });

  it('ส่งไม่สำเร็จทุกเครื่อง คืนการจองเพื่อลองใหม่รอบหน้า', async () => {
    const h = harness([user], [sub('e1', 'u1')], { e1: 'failed' });
    const s = await sendDoseReminders(h.deps, AT_0805);
    expect(s.failed).toBe(1);
    expect(h.released).toEqual(['2026-11-11:morning']);
    expect((await sendDoseReminders(h.deps, new Date('2026-11-11T01:10:00Z'))).failed).toBe(1);
  });

  it('เครื่องที่ยกเลิกการสมัครแล้ว (gone) ถูกลบ และไม่ส่งให้เครื่องของคนอื่น', async () => {
    const h = harness(
      [user, { user_id: 'u2', meds: doc([]), doseReminders: true }],
      [sub('e1', 'u1'), sub('e9', 'u2')],
      { e1: 'gone' }
    );
    const s = await sendDoseReminders(h.deps, AT_0805);
    expect(h.deleted).toEqual(['e1']);
    expect(s.removedSubscriptions).toBe(1);
    expect(h.sent).toEqual(['e1']);
  });
});
