import type { Channel, ConsultSession, Review } from './types';

/** สถิติหลังบ้านของร้าน คำนวณจากรายการปรึกษาและรีวิวที่โหลดมาแล้ว ไม่แตะข้อมูลสุขภาพ */

export type RangeDays = 7 | 30 | 90;

export interface DayPoint {
  /** วันที่แบบ YYYY-MM-DD ตามเวลาเครื่อง */
  date: string;
  /** คำขอที่เข้ามาในวันนั้น */
  requests: number;
  /** เคสที่ปิดจบในวันนั้น */
  completed: number;
}

export interface StaffLoad {
  name: string;
  active: number;
  completed: number;
}

export interface DashboardStats {
  days: DayPoint[];
  requests: number;
  completed: number;
  cancelled: number;
  /** ยังเปิดอยู่ (รอรับเรื่อง หรือกำลังปรึกษา) */
  open: number;
  /** สัดส่วนที่ปรึกษาจบ จากเคสที่ปิดแล้ว (จบ + ยกเลิก) null = ยังไม่มีเคสที่ปิด */
  completionRate: number | null;
  patients: number;
  /** ผู้ใช้ที่เคยปรึกษามากกว่า 1 ครั้งในรายการที่โหลดมา */
  returningPatients: number;
  /** นาทีเฉลี่ยตั้งแต่ส่งคำขอจนมีคนรับเรื่อง null = ไม่มีข้อมูล */
  avgWaitMinutes: number | null;
  /** นาทีเฉลี่ยตั้งแต่รับเรื่องจนปิดจบ */
  avgDurationMinutes: number | null;
  byChannel: Record<Channel, number>;
  /** จำนวนคำขอแยกตามชั่วโมง 0-23 */
  byHour: number[];
  peakHour: number | null;
  staff: StaffLoad[];
}

export interface ReviewStats {
  count: number;
  average: number | null;
  /** index 0 = 1 ดาว ... index 4 = 5 ดาว */
  distribution: [number, number, number, number, number];
  withComment: Review[];
}

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

export function computeStats(sessions: ConsultSession[], now: Date, range: RangeDays): DashboardStats {
  const days: DayPoint[] = [];
  const index = new Map<string, DayPoint>();
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const point: DayPoint = { date: dateKey(d), requests: 0, completed: 0 };
    days.push(point);
    index.set(point.date, point);
  }
  const startKey = days[0].date;
  const endKey = days[days.length - 1].date;
  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const key = dateKey(new Date(iso));
    return key >= startKey && key <= endKey;
  };

  const created = sessions.filter((s) => inRange(s.createdAt));
  const byChannel: Record<Channel, number> = { chat: 0, voice: 0, video: 0, appointment: 0 };
  const byHour = new Array<number>(24).fill(0);
  for (const s of created) {
    index.get(dateKey(new Date(s.createdAt)))!.requests += 1;
    byChannel[s.channel] += 1;
    byHour[new Date(s.createdAt).getHours()] += 1;
  }
  for (const s of sessions) {
    if (s.status === 'completed' && s.endedAt && inRange(s.endedAt)) index.get(dateKey(new Date(s.endedAt)))!.completed += 1;
  }

  const completed = created.filter((s) => s.status === 'completed').length;
  const cancelled = created.filter((s) => s.status === 'cancelled').length;
  const closed = completed + cancelled;

  const perPatient = new Map<string, number>();
  for (const s of sessions) perPatient.set(s.patientId, (perPatient.get(s.patientId) ?? 0) + 1);
  const patientIds = new Set(created.map((s) => s.patientId));

  const waits = created.filter((s) => s.startedAt).map((s) => Math.max(0, minutesBetween(s.createdAt, s.startedAt!)));
  const durations = created
    .filter((s) => s.status === 'completed' && s.startedAt && s.endedAt)
    .map((s) => Math.max(0, minutesBetween(s.startedAt!, s.endedAt!)));

  const load = new Map<string, StaffLoad>();
  for (const s of created) {
    if (!s.assignedName || (s.status !== 'active' && s.status !== 'completed')) continue;
    const row = load.get(s.assignedName) ?? { name: s.assignedName, active: 0, completed: 0 };
    if (s.status === 'active') row.active += 1;
    else row.completed += 1;
    load.set(s.assignedName, row);
  }

  const peak = Math.max(...byHour);

  return {
    days,
    requests: created.length,
    completed,
    cancelled,
    open: created.filter((s) => s.status === 'requested' || s.status === 'active').length,
    completionRate: closed > 0 ? completed / closed : null,
    patients: patientIds.size,
    returningPatients: [...patientIds].filter((id) => (perPatient.get(id) ?? 0) > 1).length,
    avgWaitMinutes: mean(waits),
    avgDurationMinutes: mean(durations),
    byChannel,
    byHour,
    peakHour: peak > 0 ? byHour.indexOf(peak) : null,
    staff: [...load.values()].sort((a, b) => b.completed + b.active - (a.completed + a.active)),
  };
}

export function computeReviewStats(reviews: Review[]): ReviewStats {
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.stars >= 1 && r.stars <= 5) distribution[r.stars - 1] += 1;
  return {
    count: reviews.length,
    average: mean(reviews.map((r) => r.stars)),
    distribution,
    withComment: reviews.filter((r) => r.comment.trim()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

/** ข้อความระยะเวลาแบบอ่านง่าย เช่น 45 นาที, 2 ชม. 10 นาที */
export function durationText(minutes: number | null): string {
  if (minutes === null) return 'ยังไม่มีข้อมูล';
  const m = Math.round(minutes);
  if (m < 1) return 'ไม่ถึง 1 นาที';
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} ชม. ${rest} นาที` : `${h} ชม.`;
  return `${Math.floor(h / 24)} วัน ${h % 24} ชม.`;
}
