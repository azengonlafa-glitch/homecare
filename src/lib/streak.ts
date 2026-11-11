import { addDays, parseKey } from './calendar';
import { findLog, isScheduledOn, todayKey, type DoseLog, type Medication } from './meds';

/**
 * "ต้นแอปเปิ้ลแห่งความสม่ำเสมอ": ไฟต่อเนื่องแบบ TikTok แต่เป็นการกินยาตรงตามตาราง
 *
 * วันหนึ่งนับเป็น "วันที่ทำได้" เมื่อทุกมื้อของทุกยาในตารางวันนั้น
 *  - กินแล้ว และไม่ช้าเกิน LATE_THRESHOLD_MIN นาที (บันทึกเป็น lateMinutes) หรือ
 *  - งดตามแพทย์สั่ง (ไม่ทำให้ไฟดับ ไม่ได้ช่วยให้ไฟต่อด้วย)
 * วันที่ไม่มีมื้อในตารางไม่นับและไม่ตัดไฟ วันนี้ที่ยังกินไม่ครบไม่ตัดไฟจนกว่าวันจะจบ
 *
 * ระบบกู้: ถ้าเคยต่อเนื่อง RECOVER_MIN_STREAK วันขึ้นไปแล้วพลาด 1 วัน แล้วกินครบติดกัน RECOVER_DAYS วัน
 * จะได้ไฟเดิมคืนพร้อมวันที่ทำใหม่ (คำนวณจากบันทึกล้วน ๆ ไม่ต้องเก็บสถานะแยก)
 *
 * นี่เป็นระบบให้กำลังใจ ไม่ใช่คำแนะนำทางการแพทย์ ห้ามกินยาเพิ่มหรือผิดคำสั่งเพื่อรักษาไฟ
 */

export const RECOVER_MIN_STREAK = 3;
export const RECOVER_DAYS = 2;

export type StreakDayState =
  /** ครบและตรงทุกมื้อ */
  | 'ok'
  /** มีแต่มื้อที่งดตามแพทย์สั่ง (ไม่นับ ไม่ตัดไฟ) */
  | 'rest'
  /** ไม่มียาในตารางวันนั้น */
  | 'none'
  /** วันที่ผ่านไปแล้วแต่มีมื้อที่ไม่ได้กิน ไม่ได้บันทึก หรือช้า */
  | 'miss'
  /** วันนี้ ยังกินไม่ครบ */
  | 'pending'
  /** วันนี้ มีมื้อที่กินช้าหรือบันทึกว่าไม่ได้กินแล้ว (ถ้าไม่แก้ วันจบแล้วจะนับว่าพลาด) */
  | 'fail';

export interface StreakDay {
  date: string;
  state: StreakDayState;
  /** มื้อทั้งหมดในตารางวันนั้น */
  total: number;
  /** มื้อที่กินแล้ว (ไม่ช้า) */
  done: number;
}

export function streakDay(meds: Medication[], logs: DoseLog[], key: string, today: string): StreakDay {
  let total = 0;
  let done = 0;
  let unresolved = 0;
  let bad = false;
  for (const med of meds) {
    if (!isScheduledOn(med, key)) continue;
    for (const period of med.periods) {
      total++;
      const log = findLog(logs, key, med.id, period);
      if (!log) unresolved++;
      else if (log.status === 'taken') {
        if (log.lateMinutes) bad = true;
        else done++;
      } else if (log.status === 'missed') bad = true;
      // skipped: ไม่ทำอะไร
    }
  }
  if (total === 0) return { date: key, state: 'none', total, done };
  if (key < today) {
    if (bad || unresolved > 0) return { date: key, state: 'miss', total, done };
    return { date: key, state: done === 0 ? 'rest' : 'ok', total, done };
  }
  if (bad) return { date: key, state: 'fail', total, done };
  if (unresolved > 0) return { date: key, state: 'pending', total, done };
  return { date: key, state: done === 0 ? 'rest' : 'ok', total, done };
}

export interface StreakResult {
  /** วันติดต่อกันตอนนี้ (รวมวันนี้ถ้ากินครบแล้ว) */
  current: number;
  /** สถิติสูงสุดที่เคยทำได้ */
  best: number;
  /** กำลังกู้ไฟเดิมอยู่: saved = วันเดิมที่จะได้คืน, run = วันที่ทำใหม่แล้ว, need = ต้องทำอีกกี่วัน */
  recovering: { saved: number; run: number; need: number } | null;
  /** 7 วันล่าสุด เก่า → ใหม่ (วันสุดท้ายคือวันนี้) */
  week: StreakDay[];
  today: StreakDay;
  /** มีตารางยาประจำให้นับหรือไม่ */
  hasSchedule: boolean;
}

export function computeStreak(meds: Medication[], logs: DoseLog[], now = new Date()): StreakResult {
  const today = todayKey(now);
  const medIds = new Set(meds.map((m) => m.id));
  const mine = logs.filter((l) => medIds.has(l.medId));
  const hasSchedule = meds.some((m) => !m.asNeeded && m.periods.length > 0 && (m.active || m.stoppedAt));

  // เริ่มนับตั้งแต่วันแรกที่มีบันทึก (ไม่ลงโทษวันก่อนที่เริ่มใช้แอป)
  let start = today;
  for (const l of mine) if (l.date < start) start = l.date;
  const earliestSchedule = meds.reduce((min, m) => (m.startDate < min ? m.startDate : min), today);
  if (earliestSchedule > start) start = earliestSchedule;

  let current = 0;
  let best = 0;
  let rec: { saved: number; run: number } | null = null;

  let d = parseKey(start);
  // นับทุกวันตั้งแต่วันแรกจนถึงวันนี้ ไม่มีเพดาน (สะสมได้เกิน 365 วันไปเรื่อย ๆ)
  for (; todayKey(d) <= today; d = addDays(d, 1)) {
    const day = streakDay(mine.length ? meds : meds, mine, todayKey(d), today);
    if (day.state === 'none' || day.state === 'rest') continue;
    if (day.state === 'pending' || day.state === 'fail') continue; // วันนี้ยังไม่ตัดสิน
    if (day.state === 'ok') {
      if (rec) {
        rec.run++;
        current = rec.run;
        if (rec.run >= RECOVER_DAYS) {
          current = rec.saved + rec.run;
          rec = null;
        }
      } else {
        current++;
      }
      best = Math.max(best, current);
    } else {
      // miss
      if (rec) {
        rec = null;
        current = 0;
      } else if (current >= RECOVER_MIN_STREAK) {
        rec = { saved: current, run: 0 };
        current = 0;
      } else {
        current = 0;
      }
    }
  }

  const week: StreakDay[] = [];
  for (let i = 6; i >= 0; i--) week.push(streakDay(meds, mine, todayKey(addDays(now, -i)), today));

  return {
    current,
    best,
    recovering: rec ? { saved: rec.saved, run: rec.run, need: RECOVER_DAYS - rec.run } : null,
    week,
    today: week[week.length - 1],
    hasSchedule,
  };
}

// ---------- ระดับของต้นไม้ ----------

export type StageId = 'empty' | 'seed' | 'sprout' | 'sapling' | 'apple' | 'gold' | 'red' | 'darkred' | 'blue' | 'purple';

export interface Stage {
  id: StageId;
  /** จำนวนวันติดต่อกันขั้นต่ำของระดับนี้ */
  from: number;
  label: string;
  /** สีไฟ (เฉพาะระดับที่มีออร่า) */
  aura?: { outer: string; mid: string; inner: string };
}

/** ปรับจำนวนวันได้ที่นี่ที่เดียว (ยิ่งร้อน ยิ่งต้องสะสมนาน) */
export const STAGES: Stage[] = [
  { id: 'empty', from: 0, label: 'ดินพร้อมปลูก' },
  { id: 'seed', from: 1, label: 'เมล็ดในดิน' },
  { id: 'sprout', from: 3, label: 'ต้นอ่อนงอกแล้ว' },
  { id: 'sapling', from: 7, label: 'ต้นเล็กแข็งแรง' },
  { id: 'apple', from: 14, label: 'ต้นแอปเปิ้ลออกลูก' },
  { id: 'gold', from: 30, label: 'ลูกแอปเปิ้ลไฟสีทอง', aura: { outer: '#FFB300', mid: '#FFD25E', inner: '#FFF3B0' } },
  { id: 'red', from: 60, label: 'ลูกแอปเปิ้ลไฟสีแดง', aura: { outer: '#E5263A', mid: '#FF4D4F', inner: '#FFB199' } },
  { id: 'darkred', from: 120, label: 'ลูกแอปเปิ้ลไฟแดงเข้ม', aura: { outer: '#7A0F22', mid: '#C4162F', inner: '#FF6A70' } },
  { id: 'blue', from: 240, label: 'ลูกแอปเปิ้ลไฟสีฟ้า', aura: { outer: '#1E6FE8', mid: '#3FA7FF', inner: '#D3ECFF' } },
  { id: 'purple', from: 365, label: 'ลูกแอปเปิ้ลไฟสีม่วง', aura: { outer: '#7B3FE4', mid: '#A55CFF', inner: '#EAD7FF' } },
];

export const stageOf = (days: number): Stage => {
  let found = STAGES[0];
  for (const s of STAGES) if (days >= s.from) found = s;
  return found;
};

export const nextStageOf = (days: number): Stage | null => STAGES.find((s) => s.from > days) ?? null;
