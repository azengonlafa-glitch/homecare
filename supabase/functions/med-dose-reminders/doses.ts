/**
 * ตรรกะเตือนกินยาฝั่งเซิร์ฟเวอร์ แยกจาก index.ts เพื่อทดสอบได้โดยไม่ต้องต่อฐานข้อมูลหรือบริการจริง
 * ข้อความแจ้งเตือนอาจขึ้นบนหน้าจอล็อก จึงห้ามมีชื่อยา ขนาดยา หรือข้อมูลสุขภาพ
 */
export type DosePeriod = 'morning' | 'noon' | 'evening' | 'bedtime';

export interface MedLite {
  id: string;
  active?: boolean;
  asNeeded?: boolean;
  periods?: DosePeriod[];
  times?: Partial<Record<DosePeriod, string>>;
  weekdays?: number[];
  startDate?: string;
  durationDays?: number | null;
  stoppedAt?: string | null;
  reminderDelayMin?: number;
  /** รูปแบบยา (tablet / capsule / liquid / drops / injection ...) ไม่มี = ยากิน */
  form?: string;
}

export interface LogLite {
  date: string;
  medId: string;
  period: DosePeriod;
}

export interface MedsDoc {
  meds?: MedLite[];
  logs?: LogLite[];
}

/** ค่าเดียวกับ DEFAULT_TIMES ใน src/lib/meds.ts */
export const DEFAULT_TIMES: Record<DosePeriod, string> = {
  morning: '08:00',
  noon: '12:00',
  evening: '18:00',
  bedtime: '21:00',
};

/**
 * เตือนได้หลังถึงเวลา (บวกเวลาที่ตั้งรายยา) ไม่เกินกี่นาที
 * ตั้งไว้เกินรอบของ cron (5 นาที) เพื่อให้รอบที่พลาดไปยังตามส่งทัน ไม่เตือนมื้อที่ผ่านมานานแล้ว
 */
export const SEND_WINDOW_MIN = 20;

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** วันที่และนาทีของวันตามเวลาไทย */
export function bangkokNow(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const addDaysKey = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** ยานี้ต้องกินในวันนั้นไหม (เหมือน isScheduledOn ใน src/lib/meds.ts) */
export function isScheduledOn(m: MedLite, key: string): boolean {
  if (m.asNeeded) return false;
  if (!m.startDate || key < m.startDate) return false;
  if (m.stoppedAt && key >= m.stoppedAt) return false;
  if (!m.active && !m.stoppedAt) return false;
  if (m.durationDays && key >= addDaysKey(m.startDate, m.durationDays)) return false;
  const weekdays = m.weekdays ?? [];
  if (weekdays.length > 0 && !weekdays.includes(new Date(`${key}T00:00:00Z`).getUTCDay())) return false;
  return true;
}

/** ยากิน (เม็ด แคปซูล ยาน้ำ ผง เม็ดฟู่ วิตามิน สมุนไพร) ตรงกับ oral ใน WORD_TABLE ของ src/lib/meds.ts ไม่ระบุรูปแบบ = ยากิน */
const ORAL_FORMS = new Set(['tablet', 'capsule', 'liquid', 'powder', 'effervescent', 'supplement', 'herbal']);
const isOral = (m: MedLite) => !m.form || ORAL_FORMS.has(m.form);

/**
 * มื้อที่ถึงเวลาเตือนตอนนี้และยังไม่ได้บันทึก รหัสเป็น yyyy-mm-dd:ช่วงเวลา (หลายยาในมื้อเดียวกันเตือนครั้งเดียว)
 * oral = ยาในมื้อนั้นเป็นยากินทั้งหมด (ใช้เลือกคำ "กินยา" หรือ "ใช้ยา")
 */
export function dueDoseKeys(doc: MedsDoc | null | undefined, now = new Date()): { key: string; period: DosePeriod; oral: boolean }[] {
  const { date, minutes } = bangkokNow(now);
  const logs = Array.isArray(doc?.logs) ? doc!.logs! : [];
  const meds = Array.isArray(doc?.meds) ? doc!.meds! : [];
  const found = new Map<string, { period: DosePeriod; oral: boolean }>();

  for (const med of meds) {
    if (!med?.id || !isScheduledOn(med, date)) continue;
    for (const period of med.periods ?? []) {
      if (!(period in DEFAULT_TIMES)) continue;
      if (logs.some((l) => l.date === date && l.medId === med.id && l.period === period)) continue;
      const first = minutesOf(med.times?.[period] || DEFAULT_TIMES[period]) + Math.max(0, med.reminderDelayMin ?? 0);
      if (minutes >= first && minutes < first + SEND_WINDOW_MIN) {
        const key = `${date}:${period}`;
        const prev = found.get(key);
        found.set(key, { period, oral: (prev?.oral ?? true) && isOral(med) });
      }
    }
  }
  return [...found.entries()].map(([key, v]) => ({ key, period: v.period, oral: v.oral }));
}

/**
 * ข้อความขึ้นหน้าจอล็อก จึงไม่ระบุชนิดยา: ยากินทั้งหมด = "กินยา" ถ้ามียาแบบอื่นปน (ฉีด หยอด ทา พ่น ฯลฯ) = "ใช้ยา"
 * (ไม่เขียน "ฉีดยา" ตรง ๆ เพราะเผยข้อมูลสุขภาพของเจ้าของเครื่อง)
 */
export const dosePayload = (key: string, oral = true): string =>
  JSON.stringify({
    title: oral ? 'Growa: ถึงเวลากินยา' : 'Growa: ถึงเวลาใช้ยา',
    body: 'แตะเพื่อเปิดตารางยาของวันนี้',
    url: '/meds',
    tag: `dose-${key}`,
  });

export interface PushSubscriptionRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

export type SendResult = 'ok' | 'gone' | 'failed';

export interface DoseDeps {
  /** ผู้ใช้ที่มีเครื่องรับแจ้งเตือน พร้อมเอกสารยาและการตั้งค่าเตือน */
  listUsers(): Promise<{ user_id: string; meds: MedsDoc | null; doseReminders: boolean }[]>;
  listSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]>;
  /** จองรหัสมื้อ คืน false ถ้าเคยส่งไปแล้ว (กันส่งซ้ำ) */
  claim(userId: string, key: string): Promise<boolean>;
  /** คืนการจอง เมื่อส่งไม่สำเร็จสักเครื่อง เพื่อให้รอบถัดไปลองใหม่ */
  release(userId: string, key: string): Promise<void>;
  send(sub: PushSubscriptionRow, payload: string): Promise<SendResult>;
  deleteSubscription(endpoint: string): Promise<void>;
}

export interface DoseSummary {
  users: number;
  sent: number;
  skippedDuplicate: number;
  failed: number;
  removedSubscriptions: number;
}

export async function sendDoseReminders(deps: DoseDeps, now = new Date()): Promise<DoseSummary> {
  const summary: DoseSummary = { users: 0, sent: 0, skippedDuplicate: 0, failed: 0, removedSubscriptions: 0 };
  const users = await deps.listUsers();
  summary.users = users.length;
  const subs = await deps.listSubscriptions(users.map((u) => u.user_id));
  const removed = new Set<string>();

  for (const user of users) {
    if (!user.doseReminders) continue;
    const due = dueDoseKeys(user.meds, now);
    if (due.length === 0) continue;
    const mine = subs.filter((s) => s.user_id === user.user_id);
    if (mine.length === 0) continue;

    for (const { key, oral } of due) {
      if (!(await deps.claim(user.user_id, key))) {
        summary.skippedDuplicate += 1;
        continue;
      }
      let delivered = false;
      for (const sub of mine) {
        if (removed.has(sub.endpoint)) continue;
        const result = await deps.send(sub, dosePayload(key, oral));
        if (result === 'ok') delivered = true;
        if (result === 'gone') {
          await deps.deleteSubscription(sub.endpoint);
          removed.add(sub.endpoint);
          summary.removedSubscriptions += 1;
        }
      }
      if (delivered) {
        summary.sent += 1;
      } else {
        await deps.release(user.user_id, key);
        summary.failed += 1;
      }
    }
  }
  return summary;
}
