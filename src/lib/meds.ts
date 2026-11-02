import type { Attachment } from './onboarding';
import { addDays, parseKey } from './calendar';

const MEDS_KEY = 'growa_meds_v1';
/** แจ้งส่วนอื่นของแอป (เช่น กระดิ่งแจ้งเตือน) ว่าข้อมูลยาเปลี่ยน */
export const MEDS_CHANGED_EVENT = 'growa-meds-changed';

/** ช่วงเวลาของวัน (ยืดหยุ่น ไม่ต้องระบุนาที) */
export type DosePeriod = 'morning' | 'noon' | 'evening' | 'bedtime';
export type MealTiming = 'before' | 'after' | 'with' | 'any';
export type MedForm = 'tablet' | 'capsule' | 'liquid' | 'injection' | 'topical' | 'drops' | 'spray' | 'other';
export type DoseStatus = 'taken' | 'missed' | 'skipped';

export interface Medication {
  id: string;
  /** ชื่อยาและขนาด เช่น Metformin 500 mg */
  name: string;
  form: MedForm;
  /** รูปแบบอื่น ๆ ที่ผู้ใช้ระบุเองเมื่อ form === 'other' */
  customForm?: string;
  /** ใช้ครั้งละกี่หน่วย */
  perDose: number;
  unit: string;
  meal: MealTiming;
  periods: DosePeriod[];
  /** เวลาเป๊ะของแต่ละช่วง HH:mm (ไม่บังคับ ใช้เตือนลืมกินยา ถ้าไม่ตั้งใช้ค่ากลางของช่วง) */
  times: Partial<Record<DosePeriod, string>>;
  /** วันที่ใช้ในสัปดาห์ 0 = อาทิตย์ … 6 = เสาร์ (ว่าง = ทุกวัน) */
  weekdays: number[];
  /** วันที่เริ่มใช้ yyyy-mm-dd (รายงานนับตั้งแต่วันนี้) */
  startDate: string;
  /** ใช้กี่วัน (null = ใช้ต่อเนื่อง) */
  durationDays: number | null;
  /** กำลังใช้ยานี้อยู่ (false = หยุดใช้แล้ว ไม่ขึ้นในตารางและไม่เตือน) */
  active: boolean;
  /** วันที่หยุดใช้ yyyy-mm-dd (ไม่นับประวัติตั้งแต่วันนี้) */
  stoppedAt: string | null;
  /** จำนวนคงเหลือ (นับจากของจริง) */
  remaining: number;
  /** เตือนเมื่อพอกินอีกไม่เกินกี่วัน */
  lowStockDays: number;
  /** วันที่รับ/เติมยาล่าสุด yyyy-mm-dd */
  lastRefillDate: string;
  /** เติมยาได้อีกกี่ครั้งตามใบสั่ง (null = ไม่ระบุ) */
  refillsRemaining: number | null;
  /** โรคหรืออาการที่เกี่ยวข้อง */
  condition: string;
  /** เหตุผลที่ใช้ยานี้ */
  reason: string;
  /** รหัสยาในฐานข้อมูลยา (ว่าง = ไม่เชื่อม) */
  drugRef: string;
  pillPhoto: Attachment | null;
  labelPhoto: Attachment | null;
  note: string;
  /** เวลาที่กด “ขอเติมยา” ล่าสุด */
  refillRequestedAt: string | null;
  createdAt: string;
}

export interface DoseLog {
  /** yyyy-mm-dd */
  date: string;
  medId: string;
  period: DosePeriod;
  status: DoseStatus;
  /** เวลาที่บันทึก (ISO) */
  at: string;
  byId: string;
  byName: string;
}

export interface MedsState {
  meds: Medication[];
  logs: DoseLog[];
}

export const PERIODS: { value: DosePeriod; label: string }[] = [
  { value: 'morning', label: 'เช้า' },
  { value: 'noon', label: 'กลางวัน' },
  { value: 'evening', label: 'เย็น' },
  { value: 'bedtime', label: 'ก่อนนอน' },
];

export const PERIOD_LABEL: Record<DosePeriod, string> = {
  morning: 'เช้า',
  noon: 'กลางวัน',
  evening: 'เย็น',
  bedtime: 'ก่อนนอน',
};

export const MEAL_OPTIONS: { value: MealTiming; label: string }[] = [
  { value: 'before', label: 'ก่อนอาหาร' },
  { value: 'after', label: 'หลังอาหาร' },
  { value: 'with', label: 'พร้อมอาหาร' },
  { value: 'any', label: 'ไม่ระบุ' },
];

export const FORM_OPTIONS: { value: MedForm; label: string; unit: string }[] = [
  { value: 'tablet', label: 'ยาเม็ด', unit: 'เม็ด' },
  { value: 'capsule', label: 'แคปซูล', unit: 'แคปซูล' },
  { value: 'liquid', label: 'ยาน้ำ', unit: 'ช้อนชา' },
  { value: 'injection', label: 'ยาฉีด', unit: 'ยูนิต' },
  { value: 'topical', label: 'ยาทา/ครีม', unit: 'ครั้ง' },
  { value: 'drops', label: 'ยาหยอด', unit: 'หยด' },
  { value: 'spray', label: 'ยาพ่น', unit: 'พ่น' },
  { value: 'other', label: 'อื่น ๆ', unit: 'ชิ้น' },
];

export const formatMedForm = (m: { form: MedForm; customForm?: string }): string => {
  if (m.form === 'other' && m.customForm && m.customForm.trim()) {
    return m.customForm.trim();
  }
  return FORM_OPTIONS.find((f) => f.value === m.form)?.label ?? 'อื่น ๆ';
};

export const UNIT_OPTIONS = [
  'เม็ด',
  'แคปซูล',
  'ช้อนชา',
  'ช้อนโต๊ะ',
  'มล.',
  'หยด',
  'พ่น',
  'เข็ม',
  'ยูนิต',
  'หลอด',
  'ซอง',
  'แผ่น',
  'ชิ้น',
  'ครั้ง',
  'โดส',
].map((u) => ({ value: u, label: u }));

export const DOSE_STATUS_LABEL: Record<DoseStatus, string> = {
  taken: 'กินแล้ว',
  missed: 'พลาดมื้อนี้',
  skipped: 'งดตามแพทย์สั่ง',
};

export const WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

const MEAL_LABEL: Record<MealTiming, string> = {
  before: 'ก่อนอาหาร',
  after: 'หลังอาหาร',
  with: 'พร้อมอาหาร',
  any: '',
};

/** เก็บประวัติการกินยาย้อนหลังสูงสุดกี่วัน (รายงานดูได้ตั้งแต่เริ่มใช้ยา) */
const LOG_KEEP_DAYS = 730;

// ---------- วันที่ ----------

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** ช่วงของวันตามเวลาตอนนี้ */
export function currentPeriod(d = new Date()): DosePeriod {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'noon';
  if (h >= 15 && h < 19) return 'evening';
  return 'bedtime';
}

export const thaiDate = (key: string, style: 'long' | 'medium' = 'long') =>
  key ? parseKey(key).toLocaleDateString('th-TH', { dateStyle: style }) : '-';

// ---------- คำนวณจำนวนยา ----------

/** ข้อมูลขั้นต่ำที่ใช้คำนวณจำนวนยาคงเหลือ */
export interface StockInput {
  perDose: number;
  periods: DosePeriod[];
  remaining: number;
  lowStockDays: number;
  weekdays?: number[];
}

/** จำนวนหน่วยที่ใช้เฉลี่ยต่อวัน (คิดวันที่ใช้ในสัปดาห์ด้วย) */
export const dosesPerDay = (m: Pick<StockInput, 'perDose' | 'periods' | 'weekdays'>) => {
  const daysPerWeek = m.weekdays && m.weekdays.length > 0 ? m.weekdays.length : 7;
  return (Math.max(0, m.perDose) * m.periods.length * daysPerWeek) / 7;
};

/** พอกินอีกกี่วัน (ปัดลง) ถ้าคำนวณไม่ได้คืน null */
export function daysLeft(m: StockInput): number | null {
  const perDay = dosesPerDay(m);
  if (perDay <= 0) return null;
  return Math.max(0, Math.floor(m.remaining / perDay));
}

export type StockLevel = 'good' | 'low' | 'critical';

/** เขียว = พอ, เหลือง = ใกล้หมด (ถึงเกณฑ์เตือน), แดง = ใกล้หมดมากหรือหมดแล้ว */
export function stockLevel(m: StockInput): StockLevel {
  const days = daysLeft(m);
  if (days === null) return 'good';
  const critical = Math.min(3, Math.floor(m.lowStockDays / 2));
  if (days <= critical) return 'critical';
  if (days <= m.lowStockDays) return 'low';
  return 'good';
}

/** วันที่คาดว่ายาจะหมด */
export function runOutDate(m: StockInput, from = new Date()): Date | null {
  const days = daysLeft(m);
  return days === null ? null : addDays(from, days);
}

export const formatQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** วิธีกินแบบอ่านง่าย เช่น "1 เม็ด · หลังอาหาร" */
export function instructionText(m: Pick<Medication, 'perDose' | 'unit' | 'meal'>): string {
  const meal = MEAL_LABEL[m.meal];
  return [`${formatQty(m.perDose)} ${m.unit}`, meal].filter(Boolean).join(' · ');
}

export function periodsText(periods: DosePeriod[]): string {
  return PERIODS.filter((p) => periods.includes(p.value))
    .map((p) => p.label)
    .join(' · ');
}

export function weekdaysText(weekdays: number[]): string {
  if (weekdays.length === 0 || weekdays.length === 7) return 'ทุกวัน';
  return [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(' ');
}

// ---------- ตารางตามวัน ----------

const DEFAULT_TIMES: Record<DosePeriod, string> = {
  morning: '08:00',
  noon: '12:00',
  evening: '18:00',
  bedtime: '21:00',
};

/** ผ่อนผันหลังถึงเวลา (นาที) ก่อนนับว่าลืมกินยา */
export const MISSED_GRACE_MIN = 90;

/** เวลาของช่วงนั้นสำหรับยานี้ (ถ้าไม่ได้ตั้งเอง ใช้ค่ากลางของช่วง) */
export const periodTime = (m: Pick<Medication, 'times'>, p: DosePeriod) => m.times[p] || DEFAULT_TIMES[p];

const minutesOf = (hhmm: string) => {
  const [h, mi] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (mi || 0);
};

/** มื้อนี้เลยกำหนด (บวกเวลาผ่อนผัน) แล้วหรือยัง */
export function isDue(m: Pick<Medication, 'times'>, p: DosePeriod, now = new Date()): boolean {
  return now.getHours() * 60 + now.getMinutes() >= minutesOf(periodTime(m, p)) + MISSED_GRACE_MIN;
}

/** ยานี้ต้องกินในวันนั้นไหม (คิดวันเริ่ม วันหยุดใช้ จำนวนวัน และวันในสัปดาห์) */
export function isScheduledOn(m: Medication, key: string): boolean {
  if (key < m.startDate) return false;
  if (m.stoppedAt && key >= m.stoppedAt) return false;
  if (!m.active && !m.stoppedAt) return false;
  if (m.durationDays && key >= todayKey(addDays(parseKey(m.startDate), m.durationDays))) return false;
  if (m.weekdays.length > 0 && !m.weekdays.includes(parseKey(key).getDay())) return false;
  return true;
}

/** วันสุดท้ายที่ต้องใช้ยา (ถ้ากำหนดจำนวนวัน) */
export function endDateOf(m: Pick<Medication, 'startDate' | 'durationDays'>): string | null {
  return m.durationDays ? todayKey(addDays(parseKey(m.startDate), m.durationDays - 1)) : null;
}

// ---------- บันทึกการกินยา ----------

export const findLog = (logs: DoseLog[], date: string, medId: string, period: DosePeriod) =>
  logs.find((l) => l.date === date && l.medId === medId && l.period === period);

/**
 * บันทึก/แก้สถานะมื้อยา (status = null คือล้างบันทึก)
 * จำนวนคงเหลือลดเมื่อ “กินแล้ว” และคืนให้เมื่อแก้เป็นสถานะอื่นหรือล้างบันทึก
 */
export function applyDoseStatus(
  state: MedsState,
  med: Medication,
  period: DosePeriod,
  status: DoseStatus | null,
  by: { id: string; name: string },
  date = todayKey()
): MedsState {
  const previous = findLog(state.logs, date, med.id, period);
  const others = state.logs.filter((l) => l !== previous);
  const wasTaken = previous?.status === 'taken';
  const nowTaken = status === 'taken';

  let remaining = med.remaining;
  if (nowTaken && !wasTaken) remaining = Math.max(0, remaining - med.perDose);
  if (!nowTaken && wasTaken) remaining = remaining + med.perDose;

  const logs: DoseLog[] = status
    ? [...others, { date, medId: med.id, period, status, at: new Date().toISOString(), byId: by.id, byName: by.name }]
    : others;

  return {
    meds: state.meds.map((m) => (m.id === med.id ? { ...m, remaining } : m)),
    logs,
  };
}

// ---------- สถิติและรายงาน ----------

export interface MedStats {
  /** จำนวนมื้อที่ควรกินแล้วจนถึงตอนนี้ */
  expected: number;
  taken: number;
  missed: number;
  skipped: number;
  /** เลยกำหนดแล้วแต่ไม่ได้บันทึก */
  unrecorded: number;
  /** เปอร์เซ็นต์กินตามนัด (ไม่นับมื้อที่งดตามแพทย์สั่ง) null = ยังไม่มีข้อมูล */
  adherence: number | null;
  /** กินครบติดต่อกันกี่วัน */
  streak: number;
  /** ปริมาณที่กินไปทั้งหมดในช่วงนี้ (หน่วยของยา) */
  totalUnits: number;
  /** วันที่เริ่มนับ */
  from: string;
}

const logMap = (logs: DoseLog[], medId: string) => {
  const map = new Map<string, DoseLog>();
  for (const l of logs) if (l.medId === medId) map.set(`${l.date}|${l.period}`, l);
  return map;
};

/**
 * สถิติการกินยาของยาตัวหนึ่ง นับตั้งแต่วันเริ่มใช้ (หรือย้อนหลัง sinceDays วัน ถ้าระบุ) จนถึงตอนนี้
 * มื้อของวันนี้นับเมื่อเลยกำหนดแล้ว หรือบันทึกไปแล้ว
 */
export function medStats(
  med: Medication,
  logs: DoseLog[],
  opts: { sinceDays?: number | null; now?: Date } = {}
): MedStats {
  const now = opts.now ?? new Date();
  const today = todayKey(now);
  let from = med.startDate;
  if (opts.sinceDays) {
    const f = todayKey(addDays(now, -(opts.sinceDays - 1)));
    if (f > from) from = f;
  }
  const mine = logMap(logs, med.id);

  let expected = 0;
  let taken = 0;
  let missed = 0;
  let skipped = 0;
  let unrecorded = 0;
  const days: { ok: boolean; slots: number; isToday: boolean }[] = [];

  for (let d = parseKey(from), i = 0; todayKey(d) <= today && i < 800; d = addDays(d, 1), i++) {
    const key = todayKey(d);
    if (!isScheduledOn(med, key)) continue;
    let slots = 0;
    let ok = true;
    for (const p of med.periods) {
      const log = mine.get(`${key}|${p}`);
      if (!(key < today || log || isDue(med, p, now))) continue;
      slots++;
      expected++;
      if (log?.status === 'taken') taken++;
      else if (log?.status === 'skipped') skipped++;
      else {
        ok = false;
        if (log?.status === 'missed') missed++;
        else unrecorded++;
      }
    }
    days.push({ ok, slots, isToday: key === today });
  }

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (day.slots === 0) continue;
    if (!day.ok) {
      if (day.isToday) continue; // วันนี้ยังไม่จบ ไม่ตัดสถิติ
      break;
    }
    streak++;
  }

  const denominator = expected - skipped;
  return {
    expected,
    taken,
    missed,
    skipped,
    unrecorded,
    adherence: denominator > 0 ? Math.round((taken / denominator) * 100) : null,
    streak,
    totalUnits: taken * med.perDose,
    from,
  };
}

export type DayState = 'none' | 'all' | 'partial' | 'missed' | 'pending';

/** สถานะรายวันย้อนหลัง (เก่า → ใหม่) ใช้วาดแถบสรุปรายวัน */
export function dayStates(med: Medication, logs: DoseLog[], days = 30, now = new Date()) {
  const today = todayKey(now);
  const mine = logMap(logs, med.id);
  const out: { date: string; state: DayState }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = todayKey(addDays(now, -i));
    if (!isScheduledOn(med, key)) {
      out.push({ date: key, state: 'none' });
      continue;
    }
    let slots = 0;
    let done = 0;
    let takenCount = 0;
    for (const p of med.periods) {
      const log = mine.get(`${key}|${p}`);
      if (!(key < today || log || isDue(med, p, now))) continue;
      slots++;
      if (log?.status === 'taken') takenCount++;
      if (log?.status === 'taken' || log?.status === 'skipped') done++;
    }
    let state: DayState;
    if (slots === 0) state = 'pending';
    else if (done === slots) state = 'all';
    else if (takenCount > 0) state = 'partial';
    else state = 'missed';
    out.push({ date: key, state });
  }
  return out;
}

/** ประวัติการบันทึกของยาตัวหนึ่ง ใหม่ → เก่า */
export const historyOf = (logs: DoseLog[], medId: string) =>
  logs
    .filter((l) => l.medId === medId)
    .sort((a, b) => (a.date === b.date ? b.at.localeCompare(a.at) : b.date.localeCompare(a.date)));

// ---------- เก็บข้อมูล ----------

/** เติมค่าเริ่มต้นให้ยาที่บันทึกไว้แบบเก่า (ก่อนมีรายละเอียดเพิ่ม) */
export function normalizeMed(raw: Partial<Medication> & { id: string; name: string }): Medication {
  const created = raw.createdAt ?? new Date().toISOString();
  const active = raw.active !== false;
  return {
    id: raw.id,
    name: raw.name,
    form: raw.form ?? 'tablet',
    customForm: typeof raw.customForm === 'string' ? raw.customForm : undefined,
    perDose: raw.perDose ?? 1,
    unit: raw.unit ?? 'เม็ด',
    meal: raw.meal ?? 'any',
    periods: Array.isArray(raw.periods) && raw.periods.length > 0 ? raw.periods : ['morning'],
    times: raw.times ?? {},
    weekdays: Array.isArray(raw.weekdays) ? raw.weekdays : [],
    startDate: raw.startDate || todayKey(new Date(created)),
    durationDays: raw.durationDays ?? null,
    active,
    stoppedAt: active ? null : (raw.stoppedAt ?? todayKey()),
    remaining: raw.remaining ?? 0,
    lowStockDays: raw.lowStockDays ?? 7,
    lastRefillDate: raw.lastRefillDate ?? '',
    refillsRemaining: raw.refillsRemaining ?? null,
    condition: raw.condition ?? '',
    reason: raw.reason ?? '',
    drugRef: raw.drugRef ?? '',
    pillPhoto: raw.pillPhoto ?? null,
    labelPhoto: raw.labelPhoto ?? null,
    note: raw.note ?? '',
    refillRequestedAt: raw.refillRequestedAt ?? null,
    createdAt: created,
  };
}

export const emptyMeds = (): MedsState => ({ meds: [], logs: [] });

export function loadMeds(): MedsState {
  try {
    const raw = localStorage.getItem(MEDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { meds?: Medication[]; logs?: DoseLog[] };
      return {
        meds: Array.isArray(parsed.meds) ? parsed.meds.filter((m) => m?.id && m.name).map(normalizeMed) : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    }
  } catch {
    // ข้อมูลเสีย: เริ่มใหม่
  }
  return emptyMeds();
}

export function saveMeds(state: MedsState): void {
  const oldest = new Date();
  oldest.setDate(oldest.getDate() - LOG_KEEP_DAYS);
  const cutoff = todayKey(oldest);
  try {
    localStorage.setItem(
      MEDS_KEY,
      JSON.stringify({ meds: state.meds, logs: state.logs.filter((l) => l.date >= cutoff) })
    );
  } catch (err) {
    console.error('Failed to save medications to localStorage', err);
  }
  window.dispatchEvent(new Event(MEDS_CHANGED_EVENT));
}

export function clearMeds(): void {
  try {
    localStorage.removeItem(MEDS_KEY);
  } catch {
    // ข้ามได้
  }
  window.dispatchEvent(new Event(MEDS_CHANGED_EVENT));
}
