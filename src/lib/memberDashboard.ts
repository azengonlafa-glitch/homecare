import type { OnboardingProfile } from './onboarding';
import type { GlucoseTiming, MemberMed, MemberRecord, VitalReading } from './members';
import type { HouseholdMember } from './settings';
import type { JournalPost } from './journal';
import {
  addDays,
  addMonths,
  dateKey,
  eventsByDay,
  parseKey,
  type CalendarEvent,
  type Occurrence,
} from './calendar';
import {
  FORM_OPTIONS,
  PERIOD_LABEL,
  daysLeft,
  commonDoseWords,
  daysToExpiry,
  doseWords,
  findLog,
  isDue,
  isOverdue,
  isScheduledOn,
  periodTime,
  stockLevel,
  todayKey,
  type DoseLog,
  type DosePeriod,
  type MedForm,
  type Medication,
} from './meds';
import { BMI_GAUGE, zoneOf, type Tone } from './healthAnalysis';
import { MONTHS } from '../data/onboardingOptions';

/**
 * ตรรกะของหน้า "แดชบอร์ดสุขภาพของสมาชิก"
 * ทุกฟังก์ชันรับข้อมูลเข้ามาตรง ๆ (ไม่อ่าน localStorage เอง) เพื่อให้ทดสอบได้
 *
 * หมายเหตุ: สถานะ "ปกติ / ต้องติดตาม / ควรตรวจสอบเร่งด่วน" เป็นเพียงตัวช่วยจัดลำดับความสำคัญ
 * ไม่ใช่การวินิจฉัยโรค
 */

// ---------- ค่าคงที่ ----------

/** ความดัน/น้ำตาลที่เกินเกณฑ์ จะแจ้งเตือนเมื่อวัดไว้ไม่เกินกี่วัน */
export const VITAL_FRESH_DAYS = 7;
/** ไม่ได้วัดความดัน/น้ำตาลนานกว่านี้ (สำหรับคนที่มีโรคที่ต้องติดตาม) ถือว่าไม่ได้บันทึกตามแผน */
export const VITAL_MISSING_DAYS = 7;
/** อาการที่บันทึกไว้ภายในกี่ชั่วโมง ถือว่าเป็นอาการล่าสุดที่ต้องจับตา */
export const SYMPTOM_FRESH_HOURS = 24;
/** น้ำหนักเปลี่ยนเร็ว: เปลี่ยนตั้งแต่กี่กก. ภายในกี่วัน */
export const WEIGHT_SHIFT_KG = 2.5;
export const WEIGHT_SHIFT_DAYS = 7;

/** อาการที่คำอธิบายทางการแพทย์ระบุว่าเป็นสัญญาณอันตราย/ควรพบแพทย์ทันที */
export const URGENT_SYMPTOMS = new Set([
  'เจ็บหน้าอก',
  'หายใจลำบาก',
  'ไอเป็นเลือด',
  'อาเจียนเป็นเลือด',
  'ถ่ายเป็นเลือด',
  'ถ่ายอุจจาระสีดำ',
  'ปัสสาวะเป็นเลือด',
  'ปัสสาวะไม่ออก',
  'อ่อนแรงครึ่งซีก',
  'พูดไม่ชัด',
  'ปากเบี้ยว',
  'มองเห็นภาพซ้อน',
  'ชัก',
  'เป็นลม',
  'แพ้ยา',
  'น้ำตาลในเลือดต่ำ',
]);

const APPOINTMENT_WORDS = [
  'นัด',
  'หมอ',
  'แพทย์',
  'โรงพยาบาล',
  'รพ.',
  'คลินิก',
  'ตรวจ',
  'วัคซีน',
  'เจาะเลือด',
  'กายภาพ',
  'ทำแผล',
  'ฟอกไต',
  'ทันตกรรม',
  'ทำฟัน',
];

// ---------- ตัวช่วยทั่วไป ----------

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** yyyy-mm-dd (เวลาท้องถิ่น) ของเวลา ISO */
export const keyOfIso = (iso: string): string => dateKey(new Date(iso));

export const parseBp = (text: string): { sys: number; dia: number } | null => {
  const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(text ?? '');
  if (!m) return null;
  return { sys: Number(m[1]), dia: Number(m[2]) };
};

export const hasDiabetes = (conditions: string[]): boolean => conditions.some((c) => c.includes('เบาหวาน'));
export const hasHypertension = (conditions: string[]): boolean => conditions.some((c) => c.includes('ความดัน'));

// ---------- ข้อมูลพื้นฐาน ----------

export type BirthDate = { day: number | null; month: number | null; yearBE: number };

/** วันเกิดจากข้อมูลพื้นฐานที่กรอกไว้ (เดือน/วันไม่บังคับ) */
export function birthFromProfile(
  p: Pick<OnboardingProfile, 'birthDay' | 'birthMonth' | 'birthYear'>
): BirthDate | null {
  if (!/^\d{4}$/.test(p.birthYear ?? '')) return null;
  const day = Number(p.birthDay);
  const month = Number(p.birthMonth);
  return {
    yearBE: Number(p.birthYear),
    day: day >= 1 && day <= 31 ? day : null,
    month: month >= 1 && month <= 12 ? month : null,
  };
}

export function birthLabel(b: BirthDate | null | undefined): string | null {
  if (!b) return null;
  const month = b.month ? MONTHS[b.month - 1]?.label : '';
  if (b.day && month) return `${b.day} ${month} ${b.yearBE}`;
  if (month) return `${month} ${b.yearBE}`;
  return `พ.ศ. ${b.yearBE}`;
}

export function ageFromBirth(b: BirthDate | null | undefined, now = new Date()): number | null {
  if (!b) return null;
  const yearCE = b.yearBE - 543;
  let age = now.getFullYear() - yearCE;
  if (b.month) {
    const day = b.day ?? 1;
    const before = now.getMonth() + 1 < b.month || (now.getMonth() + 1 === b.month && now.getDate() < day);
    if (before) age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

export const bmiOfValues = (heightCm: number | null, weightKg: number | null): number | null => {
  if (!heightCm || !weightKg || heightCm < 30) return null;
  return round1(weightKg / (heightCm / 100) ** 2);
};

export interface BodyInfo {
  age: number | null;
  birthLabel: string | null;
  heightCm: number | null;
  weightKg: number | null;
  /** วันที่ชั่งน้ำหนักล่าสุด (null = ไม่ทราบวันที่) */
  weightAt: string | null;
  bmi: number | null;
  bmiLabel: string | null;
  bmiTone: Tone | null;
}

/** อายุ วันเกิด น้ำหนัก ส่วนสูง BMI ล่าสุด (own = ข้อมูลพื้นฐานของตัวเอง ใช้เมื่อดูโปรไฟล์ตัวเอง) */
export function bodyInfo(record: MemberRecord, own: OnboardingProfile | null, now = new Date()): BodyInfo {
  const birth = (own && birthFromProfile(own)) || record.birthDate || null;
  const age = ageFromBirth(birth, now) ?? record.age ?? null;
  const heightCm = (own && num(own.heightCm)) || num(record.heightCm);
  const reading = sortedReadings(record.vitals).find((r) => r.weightKg != null);
  const weightKg = reading?.weightKg ?? (own && num(own.weightKg)) ?? num(record.weightKg);
  const bmi = bmiOfValues(heightCm, weightKg);
  const zone = bmi === null ? null : zoneOf(BMI_GAUGE, bmi);
  return {
    age,
    birthLabel: birthLabel(birth),
    heightCm,
    weightKg,
    weightAt: reading?.at ?? null,
    bmi,
    bmiLabel: zone?.label ?? null,
    bmiTone: zone?.tone ?? null,
  };
}

/** ผู้ดูแลหลักของสมาชิก: ที่เลือกไว้ ถ้ายังไม่เลือกใช้ผู้ดูแลหลักของบ้าน (ถ้าไม่ใช่ตัวเขาเอง) */
export function caregiverOf(
  record: Pick<MemberRecord, 'caregiverId'>,
  member: Pick<HouseholdMember, 'id'>,
  members: HouseholdMember[]
): { member: HouseholdMember | null; chosen: boolean } {
  const chosen = record.caregiverId ? members.find((m) => m.id === record.caregiverId) : undefined;
  if (chosen) return { member: chosen, chosen: true };
  const owner = members.find((m) => m.role === 'owner' && m.id !== member.id);
  return { member: owner ?? null, chosen: false };
}

// ---------- ค่าสุขภาพ ----------

export const sortedReadings = (list: VitalReading[] | undefined): VitalReading[] =>
  [...(list ?? [])].sort((a, b) => b.at.localeCompare(a.at));

export type Severity = 'ok' | 'watch' | 'urgent';
export interface Classified {
  severity: Severity;
  tone: Tone;
  label: string;
}

/** ความดัน: เกณฑ์สากลทั่วไป (ใช้จัดลำดับความสำคัญเท่านั้น ผู้ที่ได้รับยาควรใช้เป้าหมายของแพทย์) */
export function classifyBp(sys: number, dia: number): Classified {
  if (sys >= 180 || dia >= 120) return { severity: 'urgent', tone: 'bad', label: 'สูงมาก' };
  if (sys >= 140 || dia >= 90) return { severity: 'watch', tone: 'bad', label: 'สูง' };
  if (sys < 90 || dia < 60) return { severity: 'watch', tone: 'warn', label: 'ต่ำ' };
  if (sys >= 120 || dia >= 80) return { severity: 'ok', tone: 'warn', label: 'เริ่มสูง' };
  return { severity: 'ok', tone: 'good', label: 'ปกติ' };
}

/** น้ำตาล: ผู้ที่เป็นเบาหวานใช้เกณฑ์เตือนที่หลวมกว่า เพราะเป้าหมายตามแพทย์กำหนด */
export function classifyGlucose(value: number, timing: GlucoseTiming | undefined, diabetic: boolean): Classified {
  if (value < 54 || value >= 300) return { severity: 'urgent', tone: 'bad', label: value < 54 ? 'ต่ำมาก' : 'สูงมาก' };
  if (value < 70) return { severity: 'watch', tone: 'warn', label: 'ต่ำ' };
  if (diabetic) {
    if (value >= 180) return { severity: 'watch', tone: 'bad', label: 'สูง' };
    return { severity: 'ok', tone: 'good', label: 'ในเกณฑ์' };
  }
  if (timing === 'fasting') {
    if (value >= 126) return { severity: 'watch', tone: 'bad', label: 'สูง' };
    if (value >= 100) return { severity: 'ok', tone: 'warn', label: 'เสี่ยงเบาหวาน' };
    return { severity: 'ok', tone: 'good', label: 'ปกติ' };
  }
  if (value >= 200) return { severity: 'watch', tone: 'bad', label: 'สูง' };
  return { severity: 'ok', tone: 'good', label: 'ปกติ' };
}

export const GLUCOSE_TIMING_LABEL: Record<GlucoseTiming, string> = {
  fasting: 'ตอนอดอาหาร',
  'after-meal': 'หลังอาหาร',
  unknown: 'ไม่ระบุช่วง',
};

export interface LatestVitals {
  bp: { sys: number; dia: number; at: string | null } | null;
  glucose: { value: number; timing: GlucoseTiming; at: string | null } | null;
  weight: { kg: number; at: string | null } | null;
}

/** ค่าล่าสุด: ใช้ค่าที่บันทึกพร้อมวันที่ก่อน ถ้าไม่มีใช้ค่าตั้งต้น (ไม่ทราบวันที่) */
export function latestVitals(record: MemberRecord, own: OnboardingProfile | null): LatestVitals {
  const readings = sortedReadings(record.vitals);
  const bpReading = readings.find((r) => r.systolic != null && r.diastolic != null);
  const gluReading = readings.find((r) => r.glucose != null);
  const wReading = readings.find((r) => r.weightKg != null);

  let bp: LatestVitals['bp'] = null;
  if (bpReading) bp = { sys: bpReading.systolic as number, dia: bpReading.diastolic as number, at: bpReading.at };
  else {
    const base =
      (own && num(own.systolic) && num(own.diastolic)
        ? { sys: num(own.systolic) as number, dia: num(own.diastolic) as number }
        : null) ?? parseBp(record.health.bloodPressure);
    if (base) bp = { ...base, at: null };
  }

  let glucose: LatestVitals['glucose'] = null;
  if (gluReading) {
    glucose = { value: gluReading.glucose as number, timing: gluReading.glucoseTiming ?? 'unknown', at: gluReading.at };
  } else {
    const v = (own && num(own.fastingGlucose)) ?? num(record.health.bloodSugar);
    if (v !== null) glucose = { value: v, timing: 'fasting', at: null };
  }

  let weight: LatestVitals['weight'] = null;
  if (wReading) weight = { kg: wReading.weightKg as number, at: wReading.at };
  else {
    const w = (own && num(own.weightKg)) ?? num(record.weightKg);
    if (w !== null) weight = { kg: w, at: null };
  }

  return { bp, glucose, weight };
}

/** น้ำหนักเปลี่ยนเร็ว (เทียบค่าล่าสุดกับค่าก่อนหน้าภายใน WEIGHT_SHIFT_DAYS วัน) */
export function weightShift(
  list: VitalReading[] | undefined
): { deltaKg: number; days: number } | null {
  const weights = sortedReadings(list).filter((r) => r.weightKg != null);
  if (weights.length < 2) return null;
  const latest = weights[0];
  const latestTime = new Date(latest.at).getTime();
  for (const prev of weights.slice(1)) {
    const days = (latestTime - new Date(prev.at).getTime()) / 86_400_000;
    if (days <= 0) continue;
    if (days > WEIGHT_SHIFT_DAYS) break;
    const delta = round1((latest.weightKg as number) - (prev.weightKg as number));
    if (Math.abs(delta) >= WEIGHT_SHIFT_KG) return { deltaKg: delta, days: Math.max(1, Math.round(days)) };
  }
  return null;
}

// ---------- ยาของสมาชิก ----------

/** แปลงรายการยาที่สมาชิกแชร์ไว้เป็นข้อมูลยาเต็ม (ถ้าไม่มีรายละเอียด เริ่มนับตั้งแต่บันทึกแรก ไม่เดาวันเริ่ม) */
export function medFromMember(m: MemberMed, logs: DoseLog[] = []): Medication {
  const base = { id: m.id, stoppedAt: null, createdAt: '' };
  if (m.detail) return { ...base, ...m.detail };
  const match = /^([\d.]+)\s*(.*)$/.exec(m.dose.trim());
  const form = FORM_OPTIONS.find((f) => f.label === m.form);
  const firstLog = logs
    .filter((l) => l.medId === m.id)
    .map((l) => l.date)
    .sort()[0];
  return {
    ...base,
    name: m.name,
    form: form?.value ?? 'tablet',
    perDose: match ? parseFloat(match[1]) || 1 : 1,
    unit: match?.[2] || form?.unit || 'เม็ด',
    meal: 'after',
    periods: m.periods,
    times: m.times,
    weekdays: [],
    startDate: firstLog && firstLog < todayKey() ? firstLog : todayKey(),
    durationDays: null,
    active: true,
    remaining: 0,
    lowStockDays: 3,
    lastRefillDate: '',
    refillsRemaining: null,
    condition: m.condition ?? '',
    reason: '',
    drugRef: '',
    pillPhoto: null,
    labelPhoto: null,
    note: '',
  };
}

export type DoseState = 'taken' | 'missed' | 'skipped' | 'unconfirmed';

/** ป้ายสถานะของมื้อยา คำตามรูปแบบยา (กินแล้ว / ฉีดแล้ว / หยอดแล้ว ...) */
export const doseStateLabel = (state: DoseState, form?: MedForm | null): string => {
  const w = doseWords(form);
  return state === 'taken' ? w.done : state === 'missed' ? w.notDone : state === 'skipped' ? 'ข้าม (งดตามแพทย์สั่ง)' : 'ยังไม่ยืนยัน';
};

export interface DoseItem {
  key: string;
  med: Medication;
  period: DosePeriod;
  time: string;
  log?: DoseLog;
  state: DoseState;
  /** เลยเวลาที่ควรกินแล้ว (ตามเวลาเตือนของยานั้น) */
  overdue: boolean;
  /** เลยเวลาผ่อนผันแล้ว (ถือว่าตกหล่นถ้ายังไม่ยืนยัน) */
  late: boolean;
}

const stateOf = (log: DoseLog | undefined): DoseState => (log ? log.status : 'unconfirmed');

/** มื้อยาของวันนี้ทั้งหมด เรียงตามเวลา */
export function todayDoses(meds: Medication[], logs: DoseLog[], now = new Date()): DoseItem[] {
  const today = todayKey(now);
  const items: DoseItem[] = [];
  for (const med of meds) {
    if (med.active === false) continue;
    if (!isScheduledOn(med, today)) continue;
    for (const period of med.periods) {
      const log = findLog(logs, today, med.id, period);
      const state = stateOf(log);
      items.push({
        key: `${med.id}|${period}`,
        med,
        period,
        time: periodTime(med, period),
        log,
        state,
        overdue: state === 'unconfirmed' && isOverdue(med, period, now),
        late: state === 'unconfirmed' && isDue(med, period, now),
      });
    }
  }
  return items.sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name, 'th'));
}

export interface DoseSummary {
  total: number;
  taken: number;
  skipped: number;
  missed: number;
  unconfirmed: number;
  /** ยังไม่ยืนยันและเลยเวลาผ่อนผันแล้ว */
  late: number;
}

export function doseSummary(items: DoseItem[]): DoseSummary {
  const s: DoseSummary = { total: items.length, taken: 0, skipped: 0, missed: 0, unconfirmed: 0, late: 0 };
  for (const i of items) {
    s[i.state] += 1;
    if (i.late) s.late += 1;
  }
  return s;
}

export interface DoseEntry {
  med: Medication;
  period: DosePeriod;
  state: DoseState;
  log?: DoseLog;
}
export interface DayDoseRow {
  date: string;
  entries: DoseEntry[];
}
export interface DoseReport {
  from: string;
  to: string;
  /** ใหม่ → เก่า เฉพาะวันที่มีมื้อยา */
  days: DayDoseRow[];
  totals: { expected: number; taken: number; skipped: number; missed: number; unconfirmed: number };
  /** % กินตามนัด (ไม่นับมื้อที่งดตามแพทย์สั่ง) null = ยังไม่มีข้อมูล */
  adherence: number | null;
}

/** รายงานการกินยาในช่วงวันที่ (มื้อที่ยังไม่ถึงเวลาไม่นับ) */
export function rangeDoseReport(
  meds: Medication[],
  logs: DoseLog[],
  from: string,
  to: string,
  now = new Date()
): DoseReport {
  const today = todayKey(now);
  const end = to > today ? today : to;
  const days: DayDoseRow[] = [];
  const totals = { expected: 0, taken: 0, skipped: 0, missed: 0, unconfirmed: 0 };

  if (from <= end) {
    for (let d = parseKey(from), i = 0; dateKey(d) <= end && i < 400; d = addDays(d, 1), i++) {
      const key = dateKey(d);
      const entries: DoseEntry[] = [];
      for (const med of meds) {
        if (!isScheduledOn(med, key)) continue;
        for (const period of med.periods) {
          const log = findLog(logs, key, med.id, period);
          if (!log && key === today && !isDue(med, period, now)) continue; // ยังไม่ถึงเวลา
          const state = stateOf(log);
          entries.push({ med, period, state, log });
          totals.expected += 1;
          totals[state] += 1;
        }
      }
      if (entries.length > 0) days.push({ date: key, entries });
    }
  }
  days.reverse();
  const denominator = totals.expected - totals.skipped;
  return {
    from,
    to: end,
    days,
    totals,
    adherence: denominator > 0 ? Math.round((totals.taken / denominator) * 100) : null,
  };
}

// ---------- ช่วงเวลา ----------

export type RangePreset = '7d' | '30d' | '3m' | 'custom';

export const RANGE_LABEL: Record<RangePreset, string> = {
  '7d': '7 วัน',
  '30d': '30 วัน',
  '3m': '3 เดือน',
  custom: 'กำหนดเอง',
};

/** ช่วงวันที่ที่เลือก (รวมวันนี้) ช่วงกำหนดเองจะสลับให้ถูกและไม่เกินวันนี้ */
export function rangeFor(
  preset: RangePreset,
  custom: { from: string; to: string },
  now = new Date()
): { from: string; to: string } {
  const today = dateKey(now);
  if (preset === '7d') return { from: dateKey(addDays(now, -6)), to: today };
  if (preset === '30d') return { from: dateKey(addDays(now, -29)), to: today };
  if (preset === '3m') return { from: dateKey(addDays(addMonths(now, -3), 1)), to: today };
  let from = custom.from || today;
  let to = custom.to || today;
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  return { from, to };
}

export const inRange = (key: string, range: { from: string; to: string }) => key >= range.from && key <= range.to;

// ---------- บันทึกอาการ ----------

/** โพสต์ในบันทึกอาการที่เป็นของสมาชิกคนนี้ (ใหม่ → เก่า) */
export function postsAboutMember(posts: JournalPost[], member: HouseholdMember): JournalPost[] {
  const SELF = 'ตัวฉันเอง';
  return posts
    .filter((p) => {
      if (p.about === member.name) return true;
      const mine = p.authorId === member.id || p.authorName === member.name;
      return mine && (!p.about || p.about === SELF);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- นัดหมาย ----------

const textOfEvent = (e: CalendarEvent) => [e.title, e.description, ...e.tags].join(' ');

export const isMedicalEvent = (e: CalendarEvent): boolean => {
  const text = textOfEvent(e);
  return APPOINTMENT_WORDS.some((w) => text.includes(w));
};

/**
 * กิจกรรมในปฏิทินที่นับเป็นนัดหมายของสมาชิกคนนี้:
 * ต้องเป็นเรื่องแพทย์/การตรวจ และพูดถึงชื่อสมาชิก หรือมอบหมายให้สมาชิกคนนั้น
 * (ของตัวเอง: ไม่ได้พูดถึงสมาชิกคนอื่นด้วย)
 */
export function isAppointmentFor(
  event: CalendarEvent,
  member: HouseholdMember,
  members: HouseholdMember[],
  isMe: boolean
): boolean {
  if (!isMedicalEvent(event)) return false;
  const text = textOfEvent(event);
  if (text.includes(member.name) || event.assignees.includes(member.id)) return true;
  if (!isMe) return false;
  const mentionsOther = members.some((m) => m.id !== member.id && m.name && text.includes(m.name));
  const forOther = event.assignees.some((id) => id !== member.id);
  return !mentionsOther && !forOther && (event.createdById === member.id || event.assignees.length === 0);
}

const occurrenceEnd = (o: Occurrence): Date => {
  const day = parseKey(o.day);
  const e = o.event;
  if (e.allDay || !e.endTime) return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  const [h, m] = (o.dayIndex === o.totalDays - 1 ? e.endTime : '23:59').split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0, 59);
};

export function appointmentsBetween(
  events: CalendarEvent[],
  member: HouseholdMember,
  members: HouseholdMember[],
  isMe: boolean,
  from: Date,
  to: Date
): Occurrence[] {
  const mine = events.filter((e) => isAppointmentFor(e, member, members, isMe));
  const map = eventsByDay(mine, from, to);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, list]) => list)
    .sort((a, b) => a.day.localeCompare(b.day) || a.event.startTime.localeCompare(b.event.startTime));
}

/** นัดหมายที่ยังไม่จบ เรียงตามใกล้ที่สุด (ภายใน 1 ปีข้างหน้า) */
export function upcomingAppointments(
  events: CalendarEvent[],
  member: HouseholdMember,
  members: HouseholdMember[],
  isMe: boolean,
  now = new Date(),
  limit = 5
): Occurrence[] {
  return appointmentsBetween(events, member, members, isMe, now, addDays(now, 365))
    .filter((o) => occurrenceEnd(o) >= now)
    .slice(0, limit);
}

/** อีกกี่วันถึงวันนั้น (0 = วันนี้) */
export const daysUntilKey = (key: string, now = new Date()): number =>
  Math.round((parseKey(key).getTime() - parseKey(dateKey(now)).getTime()) / 86_400_000);

// ---------- ส่วนที่ต้องติดตาม ----------

export type FollowKind = 'dose' | 'symptom' | 'mood' | 'vital' | 'appointment' | 'stock' | 'record';
export type FollowTarget = 'meds' | 'symptoms' | 'bp' | 'glucose' | 'weight' | 'appointments' | 'record';

export interface FollowItem {
  id: string;
  level: Exclude<Severity, 'ok'>;
  kind: FollowKind;
  title: string;
  detail: string;
  target: FollowTarget;
}

export type OverallStatus = 'normal' | 'watch' | 'urgent';

export const overallOf = (items: FollowItem[]): OverallStatus =>
  items.some((i) => i.level === 'urgent') ? 'urgent' : items.length > 0 ? 'watch' : 'normal';

export interface FollowContext {
  member: HouseholdMember;
  members: HouseholdMember[];
  record: MemberRecord;
  isMe: boolean;
  meds: Medication[];
  logs: DoseLog[];
  posts: JournalPost[];
  events: CalendarEvent[];
  own: OnboardingProfile | null;
  /** ยานี้มีข้อมูลจำนวนคงเหลือที่เชื่อถือได้หรือไม่ */
  stockTrusted: (m: Medication) => boolean;
  now?: Date;
}

const timeText = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayText = (key: string) => parseKey(key).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export function buildFollowUps(ctx: FollowContext): FollowItem[] {
  const now = ctx.now ?? new Date();
  const items: FollowItem[] = [];
  const conditions = ctx.record.health.conditions;
  const diabetic = hasDiabetes(conditions);

  // 1) ยา: มื้อวันนี้ที่เลยเวลาแล้วยังไม่ยืนยัน / ไม่ได้กิน
  const doses = todayDoses(ctx.meds, ctx.logs, now);
  for (const d of doses) {
    if (d.state === 'unconfirmed' && d.late) {
      items.push({
        id: `dose-late-${d.key}`,
        level: 'watch',
        kind: 'dose',
        title: `ยังไม่ยืนยันการ${doseWords(d.med.form).phrase} ${d.med.name}`,
        detail: `มื้อ${PERIOD_LABEL[d.period]} ${d.time} น. เลยเวลามาแล้ว`,
        target: 'meds',
      });
    } else if (d.state === 'missed') {
      items.push({
        id: `dose-missed-${d.key}`,
        level: 'watch',
        kind: 'dose',
        title: `ไม่ได้${doseWords(d.med.form).phrase} ${d.med.name}`,
        detail: `มื้อ${PERIOD_LABEL[d.period]}วันนี้${d.log?.reason ? ` · ${d.log.reason}` : ''}`,
        target: 'meds',
      });
    }
  }
  // เมื่อวานมีมื้อที่ไม่ได้บันทึก
  const yesterday = dateKey(addDays(now, -1));
  const yReport = rangeDoseReport(ctx.meds, ctx.logs, yesterday, yesterday, now);
  if (yReport.totals.unconfirmed > 0) {
    const cw = commonDoseWords(ctx.meds.map((m) => m.form));
    items.push({
      id: 'dose-yesterday',
      level: 'watch',
      kind: 'dose',
      title: `เมื่อวานมี ${yReport.totals.unconfirmed} มื้อที่ไม่ได้บันทึกการ${cw.phrase}`,
      detail: `ตรวจสอบว่า${cw.phrase}ครบหรือไม่`,
      target: 'meds',
    });
  }

  // 2) อาการและอารมณ์ภายใน 24 ชั่วโมง
  const since = now.getTime() - SYMPTOM_FRESH_HOURS * 3_600_000;
  const recent = postsAboutMember(ctx.posts, ctx.member).filter((p) => new Date(p.createdAt).getTime() >= since);
  for (const p of recent) {
    if (p.symptoms.length > 0) {
      const urgent = p.symptoms.filter((s) => URGENT_SYMPTOMS.has(s));
      items.push({
        id: `symptom-${p.id}`,
        level: urgent.length > 0 ? 'urgent' : 'watch',
        kind: 'symptom',
        title: `บันทึกอาการ: ${p.symptoms.join(', ')}`,
        detail:
          urgent.length > 0
            ? `มีอาการที่ควรได้รับการประเมินจากแพทย์ (${urgent.join(', ')}) · บันทึกเวลา ${timeText(p.createdAt)} น.`
            : `บันทึกเวลา ${timeText(p.createdAt)} น.`,
        target: 'symptoms',
      });
    }
  }
  const downToday = recent.find((p) => p.moodMain === 'down');
  if (downToday) {
    items.push({
      id: `mood-${downToday.id}`,
      level: 'watch',
      kind: 'mood',
      title: 'รู้สึกไม่ดีในวันนี้',
      detail: downToday.moodDetails.length > 0 ? downToday.moodDetails.join(', ') : 'ลองพูดคุยและสอบถามอาการ',
      target: 'symptoms',
    });
  }

  // 3) ค่าสุขภาพที่วัดไว้ล่าสุดและผิดเกณฑ์
  const fresh = (iso: string | null) =>
    !!iso && now.getTime() - new Date(iso).getTime() <= VITAL_FRESH_DAYS * 86_400_000;
  const latest = latestVitals(ctx.record, ctx.own);
  if (latest.bp && fresh(latest.bp.at)) {
    const c = classifyBp(latest.bp.sys, latest.bp.dia);
    if (c.severity !== 'ok') {
      items.push({
        id: 'vital-bp',
        level: c.severity,
        kind: 'vital',
        title: `ความดัน ${latest.bp.sys}/${latest.bp.dia} mmHg อยู่ในช่วง “${c.label}”`,
        detail: `วัดเมื่อ ${dayText(keyOfIso(latest.bp.at as string))} ${timeText(latest.bp.at as string)} น. ควรวัดซ้ำและปรึกษาแพทย์ถ้ายังผิดปกติ`,
        target: 'bp',
      });
    }
  }
  if (latest.glucose && fresh(latest.glucose.at)) {
    const c = classifyGlucose(latest.glucose.value, latest.glucose.timing, diabetic);
    if (c.severity !== 'ok') {
      items.push({
        id: 'vital-glucose',
        level: c.severity,
        kind: 'vital',
        title: `น้ำตาล ${latest.glucose.value} มก./ดล. อยู่ในช่วง “${c.label}”`,
        detail: `วัดเมื่อ ${dayText(keyOfIso(latest.glucose.at as string))} · ${GLUCOSE_TIMING_LABEL[latest.glucose.timing]}`,
        target: 'glucose',
      });
    }
  }
  const shift = weightShift(ctx.record.vitals);
  if (shift && fresh(sortedReadings(ctx.record.vitals).find((r) => r.weightKg != null)?.at ?? null)) {
    items.push({
      id: 'vital-weight',
      level: 'watch',
      kind: 'vital',
      title: `น้ำหนัก${shift.deltaKg > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(shift.deltaKg)} กก. ใน ${shift.days} วัน`,
      detail: 'น้ำหนักเปลี่ยนเร็วกว่าปกติ ควรสังเกตอาการบวมหรือการกินอาหาร',
      target: 'weight',
    });
  }

  // 4) ข้อมูลสุขภาพที่ควรบันทึกตามโรคประจำตัว แต่ไม่ได้บันทึกนาน
  const lastAt = (pick: (r: VitalReading) => boolean) =>
    sortedReadings(ctx.record.vitals).find(pick)?.at ?? null;
  const stale = (iso: string | null) =>
    !iso || now.getTime() - new Date(iso).getTime() > VITAL_MISSING_DAYS * 86_400_000;
  if (hasHypertension(conditions) && stale(lastAt((r) => r.systolic != null))) {
    items.push({
      id: 'record-bp',
      level: 'watch',
      kind: 'record',
      title: `ยังไม่ได้วัดความดันในรอบ ${VITAL_MISSING_DAYS} วัน`,
      detail: 'มีโรคความดันโลหิตสูง ควรวัดและบันทึกค่าสม่ำเสมอ',
      target: 'record',
    });
  }
  if (diabetic && stale(lastAt((r) => r.glucose != null))) {
    items.push({
      id: 'record-glucose',
      level: 'watch',
      kind: 'record',
      title: `ยังไม่ได้ตรวจน้ำตาลในรอบ ${VITAL_MISSING_DAYS} วัน`,
      detail: 'มีโรคเบาหวาน ควรตรวจและบันทึกค่าสม่ำเสมอ',
      target: 'record',
    });
  }

  // 5) นัดหมายวันนี้/พรุ่งนี้
  for (const o of upcomingAppointments(ctx.events, ctx.member, ctx.members, ctx.isMe, now, 10)) {
    const diff = daysUntilKey(o.day, now);
    if (diff > 1) break;
    items.push({
      id: `appt-${o.event.id}-${o.day}`,
      level: 'watch',
      kind: 'appointment',
      title: `${diff === 0 ? 'วันนี้' : 'พรุ่งนี้'}มีนัด: ${o.event.title}`,
      detail: o.event.allDay ? 'ทั้งวัน' : `เวลา ${o.event.startTime} น.`,
      target: 'appointments',
    });
  }

  // 6) ยาใกล้หมด / ใกล้หมดอายุ (เฉพาะยาที่มีข้อมูลคงเหลือจริง)
  for (const m of ctx.meds) {
    if (!m.active || m.asNeeded || !ctx.stockTrusted(m)) continue;
    const level = stockLevel(m);
    if (level !== 'good') {
      const left = daysLeft(m);
      items.push({
        id: `stock-${m.id}`,
        level: 'watch',
        kind: 'stock',
        title: m.remaining <= 0 ? `${m.name} หมดแล้ว` : `${m.name} ใกล้หมด`,
        detail: m.remaining <= 0 ? 'ควรจัดหายาเพิ่ม' : `เหลือพอ${doseWords(m.form).use}อีกประมาณ ${left ?? '-'} วัน`,
        target: 'meds',
      });
    }
    const exp = daysToExpiry(m, now);
    if (exp !== null && exp <= (m.expiryWarnDays ?? 30)) {
      items.push({
        id: `expiry-${m.id}`,
        level: 'watch',
        kind: 'stock',
        title: exp < 0 ? `${m.name} หมดอายุแล้ว` : `${m.name} ใกล้หมดอายุ`,
        detail: exp < 0 ? 'ไม่ควรใช้ยาที่หมดอายุ' : `อีก ${exp} วัน`,
        target: 'meds',
      });
    }
  }

  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'urgent' ? -1 : 1));
}

