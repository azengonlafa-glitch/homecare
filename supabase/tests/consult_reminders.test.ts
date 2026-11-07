import { describe, expect, it } from 'vitest';
import {
  bangkokToday,
  reminderPayload,
  sendDueReminders,
  type DueFollowUp,
  type PushSubscriptionRow,
  type SendResult,
} from '../functions/consult-followup-reminders/reminders';

const sub = (endpoint: string, user_id: string): PushSubscriptionRow => ({ endpoint, user_id, p256dh: 'p', auth: 'a' });

function harness(due: DueFollowUp[], subs: PushSubscriptionRow[], results: Record<string, SendResult> = {}) {
  const sent: { endpoint: string; payload: string }[] = [];
  const deleted: string[] = [];
  const marked: string[] = [];
  const deps = {
    listDue: async () => due,
    listSubscriptions: async (ids: string[]) => subs.filter((s) => ids.includes(s.user_id)),
    send: async (s: PushSubscriptionRow, payload: string) => {
      sent.push({ endpoint: s.endpoint, payload });
      return results[s.endpoint] ?? 'ok';
    },
    deleteSubscription: async (e: string) => void deleted.push(e),
    markReminded: async (id: string) => void marked.push(id),
  };
  return { deps, sent, deleted, marked };
}

describe('การส่งแจ้งเตือนนัดติดตาม', () => {
  it('ข้อความต้องไม่มีข้อมูลสุขภาพ มีแค่ข้อความกลางและลิงก์', () => {
    const payload = JSON.parse(reminderPayload('f1'));
    expect(Object.keys(payload).sort()).toEqual(['body', 'tag', 'title', 'url']);
    expect(payload.url).toBe('/consult/followup/f1');
  });
  it('ส่งสำเร็จแล้วทำเครื่องหมาย ไม่เตือนซ้ำ', async () => {
    const h = harness([{ id: 'f1', patient_id: 'u1' }], [sub('e1', 'u1')]);
    expect(await sendDueReminders(h.deps, '2026-01-01')).toMatchObject({ due: 1, reminded: 1, failed: 0 });
    expect(h.marked).toEqual(['f1']);
  });
  it('ส่งไปหาเฉพาะเจ้าของนัด ไม่ไปถึงคนอื่น', async () => {
    const h = harness([{ id: 'f1', patient_id: 'u1' }], [sub('e1', 'u1'), sub('e2', 'u2')]);
    await sendDueReminders(h.deps, '2026-01-01');
    expect(h.sent.map((s) => s.endpoint)).toEqual(['e1']);
  });
  it('ยังไม่เปิดแจ้งเตือน: ไม่ทำเครื่องหมาย เปิดทีหลังยังได้รับ', async () => {
    const h = harness([{ id: 'f1', patient_id: 'u1' }], []);
    expect(await sendDueReminders(h.deps, '2026-01-01')).toMatchObject({ noSubscription: 1, reminded: 0 });
    expect(h.marked).toEqual([]);
  });
  it('ส่งล้มเหลวชั่วคราว: ไม่ทำเครื่องหมาย ลองใหม่รอบหน้า และไม่ลบการสมัคร', async () => {
    const h = harness([{ id: 'f1', patient_id: 'u1' }], [sub('e1', 'u1')], { e1: 'failed' });
    expect(await sendDueReminders(h.deps, '2026-01-01')).toMatchObject({ failed: 1, reminded: 0 });
    expect(h.marked).toEqual([]);
    expect(h.deleted).toEqual([]);
  });
  it('เครื่องที่เลิกใช้ถูกลบ เครื่องที่เหลือยังได้รับ และนับว่าเตือนแล้ว', async () => {
    const h = harness([{ id: 'f1', patient_id: 'u1' }], [sub('old', 'u1'), sub('new', 'u1')], { old: 'gone' });
    expect(await sendDueReminders(h.deps, '2026-01-01')).toMatchObject({ reminded: 1, removedSubscriptions: 1 });
    expect(h.deleted).toEqual(['old']);
    expect(h.marked).toEqual(['f1']);
  });
  it('เครื่องที่ถูกลบไม่ถูกส่งซ้ำสำหรับนัดถัดไป', async () => {
    const h = harness([{ id: 'f1', patient_id: 'u1' }, { id: 'f2', patient_id: 'u1' }], [sub('old', 'u1')], { old: 'gone' });
    await sendDueReminders(h.deps, '2026-01-01');
    expect(h.sent).toHaveLength(1);
  });
  it('วันที่ใช้เวลาไทย: 18:00 UTC เป็นวันถัดไปในไทย', () => {
    expect(bangkokToday(new Date('2026-03-01T18:00:00Z'))).toBe('2026-03-02');
    expect(bangkokToday(new Date('2026-03-01T16:59:00Z'))).toBe('2026-03-01');
  });
});
