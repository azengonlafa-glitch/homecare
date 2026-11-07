/**
 * ตรรกะการส่งแจ้งเตือนนัดติดตาม แยกจาก index.ts เพื่อให้ทดสอบได้โดยไม่ต้องต่อฐานข้อมูลหรือบริการจริง
 * ข้อความอาจขึ้นบนหน้าจอล็อก จึงห้ามมีข้อมูลสุขภาพ ชื่อผู้ให้บริการ หรือเรื่องที่ปรึกษา
 */
export interface DueFollowUp {
  id: string;
  patient_id: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

export type SendResult = 'ok' | 'gone' | 'failed';

export interface ReminderDeps {
  listDue(today: string): Promise<DueFollowUp[]>;
  listSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]>;
  send(sub: PushSubscriptionRow, payload: string): Promise<SendResult>;
  deleteSubscription(endpoint: string): Promise<void>;
  markReminded(followUpId: string): Promise<void>;
}

export const reminderPayload = (followUpId: string): string =>
  JSON.stringify({
    title: 'Growa: ถึงเวลาอัปเดตอาการ',
    body: 'แตะเพื่ออัปเดตอาการตามนัดติดตามผล',
    url: `/consult/followup/${followUpId}`,
    tag: `followup-${followUpId}`,
  });

/** วันนี้ตามเวลาไทย รูปแบบ yyyy-mm-dd */
export const bangkokToday = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);

export interface ReminderSummary {
  due: number;
  reminded: number;
  noSubscription: number;
  failed: number;
  removedSubscriptions: number;
}

/**
 * ส่งแจ้งเตือนนัดที่ถึงกำหนด
 * นับว่าเตือนแล้วเมื่อส่งสำเร็จอย่างน้อย 1 เครื่อง ถ้าส่งไม่ได้หรือยังไม่ได้เปิดแจ้งเตือน จะลองใหม่ในรอบถัดไป
 */
export async function sendDueReminders(deps: ReminderDeps, today: string): Promise<ReminderSummary> {
  const summary: ReminderSummary = { due: 0, reminded: 0, noSubscription: 0, failed: 0, removedSubscriptions: 0 };
  const due = await deps.listDue(today);
  summary.due = due.length;
  if (due.length === 0) return summary;

  const subs = await deps.listSubscriptions([...new Set(due.map((f) => f.patient_id))]);
  const removed = new Set<string>();

  for (const followUp of due) {
    const mine = subs.filter((s) => s.user_id === followUp.patient_id && !removed.has(s.endpoint));
    if (mine.length === 0) {
      summary.noSubscription += 1;
      continue;
    }
    let delivered = false;
    for (const sub of mine) {
      const result = await deps.send(sub, reminderPayload(followUp.id));
      if (result === 'ok') delivered = true;
      if (result === 'gone') {
        await deps.deleteSubscription(sub.endpoint);
        removed.add(sub.endpoint);
        summary.removedSubscriptions += 1;
      }
    }
    if (delivered) {
      await deps.markReminded(followUp.id);
      summary.reminded += 1;
    } else {
      summary.failed += 1;
    }
  }
  return summary;
}
