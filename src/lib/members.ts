import {
  MEDS_CHANGED_EVENT,
  formatMedForm,
  instructionText,
  loadMeds,
  todayKey,
  type DoseLog,
  type DosePeriod,
  type Medication,
} from './meds';
import { loadOnboarding, ONBOARDING_CHANGED_EVENT, isOnboardingDone } from './onboarding';
import { birthFromProfile, type BirthDate } from './memberDashboard';
import { cloudEnabled } from '../cloud/client';
import { queueSync } from '../cloud/queue';
import { CURRENT_MEMBER_ID, loadSettings, type Gender, type HouseholdMember } from './settings';

/** การเปิดเผยข้อมูลของเจ้าของข้อมูล: ให้ดูได้ไหม และให้ใครแก้ไขได้ */
export interface MemberSharing {
  /** ให้สมาชิกคนอื่นในบ้านดูข้อมูลสุขภาพและตารางยาของฉัน */
  shareData: boolean;
  /** all = ให้ทุกคนในบ้านแก้ไขได้ · choose = อนุญาตเป็นรายคน */
  editPolicy: 'all' | 'choose';
  /** รหัสสมาชิกที่ได้อนุญาตให้แก้ไขข้อมูล (ใช้เมื่อ editPolicy = choose) */
  allowedEditors: string[];
  /** รหัสสมาชิกที่ถูกห้ามแก้ไข (มีผลเหนือทุกอย่าง) */
  blockedEditors: string[];
}

export interface MemberMed {
  id: string;
  name: string;
  /** ขนาดที่กินต่อครั้ง เช่น "1 เม็ด" */
  dose: string;
  periods: DosePeriod[];
  times: Partial<Record<DosePeriod, string>>;
  form?: string;
  condition?: string;
  instruction?: string;
  /** ข้อมูลยาแบบละเอียดจากฟอร์มเดียวกับตู้ยา (ใช้เปิดแก้ไขต่อ) */
  detail?: MemberMedDetail;
}

export type MemberMedDetail = Omit<Medication, 'id' | 'createdAt' | 'stoppedAt'>;

export interface HealthHistoryItem {
  id: string;
  /** วันที่แบบ yyyy-mm-dd */
  at: string;
  label: string;
  detail: string;
}

export interface MemberHealth {
  conditions: string[];
  allergies: string[];
  /** ความดันล่าสุด เช่น "135/85" */
  bloodPressure: string;
  /** น้ำตาลในเลือดล่าสุด */
  bloodSugar: string;
  note: string;
  history: HealthHistoryItem[];
}

/** ช่วงที่วัดน้ำตาล */
export type GlucoseTiming = 'fasting' | 'after-meal' | 'unknown';

/** ค่าสุขภาพที่บันทึกไว้หนึ่งครั้ง (ใช้ทำประวัติความดัน น้ำตาล น้ำหนัก) */
export interface VitalReading {
  id: string;
  /** เวลาที่วัด (ISO) */
  at: string;
  systolic?: number;
  diastolic?: number;
  /** น้ำตาลในเลือด มก./ดล. */
  glucose?: number;
  glucoseTiming?: GlucoseTiming;
  weightKg?: number;
  /** ชีพจร ครั้ง/นาที */
  pulseBpm?: number;
  /** ออกซิเจนในเลือด % */
  spo2?: number;
  /** อุณหภูมิร่างกาย °C */
  tempC?: number;
  /** น้ำตาลสะสม HbA1c % */
  hba1c?: number;
  /** รอบเอว ซม. */
  waistCm?: number;
  /** ระดับความปวด 0-10 */
  painScore?: number;
  /** ชั่วโมงที่นอนคืนก่อน */
  sleepHours?: number;
  /** ค่าอื่นที่ไม่มีช่องเฉพาะ (ผลตรวจเลือด อัตราการหายใจ น้ำเข้า-ออก ฯลฯ) ตามรหัสใน vitalMetrics */
  more?: Record<string, number>;
  note?: string;
  byName?: string;
  /** มาจากบันทึกประจำวัน (โพสต์ในบันทึกอาการ) โพสต์ไหน: แก้/ลบโพสต์แล้วค่านี้เปลี่ยนตาม */
  postId?: string;
}

export interface MemberRecord {
  id: string;
  age: number | null;
  gender: Gender | '';
  photo: string;
  sharing: MemberSharing;
  health: MemberHealth;
  meds: MemberMed[];
  /** วันเกิด (ปี พ.ศ. จำเป็น วัน/เดือนไม่บังคับ) */
  birthDate?: BirthDate | null;
  heightCm?: number | null;
  /** น้ำหนักตั้งต้น ใช้เมื่อยังไม่มีบันทึกน้ำหนัก */
  weightKg?: number | null;
  /** ผู้ดูแลหลักของสมาชิกคนนี้ (ว่าง = ใช้ผู้ดูแลหลักของบ้าน) */
  caregiverId?: string;
  vitals?: VitalReading[];
  /** บันทึกการกินยาของสมาชิก (ของฉันเองอยู่ในตู้ยา ใช้เก็บของคนอื่นและสำหรับเผยแพร่ให้คนในบ้านเห็น) */
  doseLogs?: DoseLog[];
  todayMood?: {
    date: string;
    main: import('../data/journalOptions').MoodKey;
    details: string[];
  } | null;
}

const RECORDS_KEY = 'growa_member_records_v1';
export const MEMBERS_CHANGED_EVENT = 'growa-members-changed';

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'ชาย',
  female: 'หญิง',
  other: 'อื่น ๆ',
};

export const genderLabel = (g: Gender | '' | undefined): string => (g ? GENDER_LABEL[g] : 'ไม่ระบุ');

const emptyHealth = (): MemberHealth => ({
  conditions: [],
  allergies: [],
  bloodPressure: '',
  bloodSugar: '',
  note: '',
  history: [],
});

const defaultSharing = (): MemberSharing => ({
  shareData: true,
  // ค่าเริ่มต้น: ทุกคนในบ้านดูและแก้ได้ เจ้าของปิดหรือจำกัดเองได้ที่ ตั้งค่า > ความเป็นส่วนตัว (ฐานข้อมูลบังคับตาม)
  editPolicy: 'all',
  allowedEditors: [],
  blockedEditors: [],
});

const GENDER_FROM_LABEL: Record<string, Gender> = { ชาย: 'male', หญิง: 'female', 'อื่น ๆ': 'other' };

const isoDaysAgo = (days: number, hour = 8, minute = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const demoReading = (id: string, days: number, rest: Partial<VitalReading>, hour = 8): VitalReading => ({
  id,
  at: isoDaysAgo(days, hour),
  ...rest,
});

const num = (v: string | undefined): number | null => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : null;
};

/** วันเกิด ส่วนสูง น้ำหนักของตัวเองจากข้อมูลพื้นฐาน (ใช้เผยแพร่ให้คนในบ้านเห็น) */
function ownBody(profile: ReturnType<typeof loadOnboarding>['profile']): Pick<MemberRecord, 'birthDate' | 'heightCm' | 'weightKg'> {
  return { birthDate: birthFromProfile(profile), heightCm: num(profile.heightCm), weightKg: num(profile.weightKg) };
}

/** อายุและเพศของตัวเองจากข้อมูลพื้นฐานที่กรอกไว้ */
function ownIdentity(profile: ReturnType<typeof loadOnboarding>['profile']): { age: number | null; gender: Gender | '' } {
  const year = Number(profile.birthYear);
  const age = /^\d{4}$/.test(profile.birthYear) ? new Date().getFullYear() + 543 - year : null;
  return { age: age !== null && age >= 0 && age <= 120 ? age : null, gender: GENDER_FROM_LABEL[profile.gender] ?? '' };
}

/** ข้อมูลของสมาชิกในบ้าน (โหมดต้นแบบใช้ข้อมูลตัวอย่าง โหมดคลาวด์ใช้ข้อมูลจริงเท่านั้น) */
function seedRecord(id: string): MemberRecord {
  const base: MemberRecord = {
    id,
    age: null,
    gender: '',
    photo: '',
    sharing: defaultSharing(),
    health: emptyHealth(),
    meds: [],
  };

  if (cloudEnabled && id !== CURRENT_MEMBER_ID) return base;

  switch (id) {
    case CURRENT_MEMBER_ID: {
      const profile = loadOnboarding().profile;
      const meds = loadMeds().meds
        .filter((m) => m.active)
        .map<MemberMed>((m) => ({
          id: m.id,
          name: m.name,
          dose: `${m.perDose} ${m.unit}`,
          periods: m.periods,
          times: m.times,
          form: formatMedForm(m),
          condition: m.condition,
          instruction: instructionText(m),
        }));
      return {
        ...base,
        ...(cloudEnabled ? { ...ownIdentity(profile), ...ownBody(profile) } : { age: 68, gender: 'female' as Gender }),
        health: {
          conditions: profile.noConditions ? [] : profile.conditions ?? [],
          allergies: profile.noAllergies
            ? []
            : [...(profile.drugAllergies ?? []).map((a) => a.drug), ...(profile.otherAllergies ?? [])],
          bloodPressure: profile.systolic && profile.diastolic ? `${profile.systolic}/${profile.diastolic}` : '',
          bloodSugar: profile.fastingGlucose ?? '',
          note: '',
          history: [],
        },
        meds,
      };
    }
    case 'mint':
      return {
        ...base,
        age: 34,
        gender: 'female',
        birthDate: { day: 12, month: 5, yearBE: 2535 },
        heightCm: 160,
        weightKg: 56,
        vitals: [
          demoReading('mint-v1', 21, { systolic: 126, diastolic: 80 }),
          demoReading('mint-v2', 14, { systolic: 130, diastolic: 84 }),
          demoReading('mint-v3', 7, { systolic: 124, diastolic: 80, weightKg: 56 }),
          demoReading('mint-v4', 2, { systolic: 128, diastolic: 82 }),
          demoReading('mint-v5', 30, { glucose: 95, glucoseTiming: 'fasting', weightKg: 56.5 }),
        ],
        health: {
          conditions: ['ความดันโลหิตสูง'],
          allergies: [],
          bloodPressure: '128/82',
          bloodSugar: '95',
          note: 'ตรวจสุขภาพประจำปีล่าสุดปกติ',
          history: [
            { id: 'mint-h1', at: '2026-09-18', label: 'ตรวจสุขภาพประจำปี', detail: 'ความดัน 128/82 · น้ำตาล 95 มก./ดล.' },
            { id: 'mint-h2', at: '2026-06-02', label: 'พบแพทย์ (ปวดหัว)', detail: 'แพทย์ให้พักผ่อนและติดตามอาการ' },
          ],
        },
        meds: [
          {
            id: 'mint-m1',
            name: 'ยาลดความดัน (Amlodipine 5 mg)',
            dose: '1 เม็ด',
            form: 'ยาเม็ด',
            condition: 'ความดันโลหิตสูง',
            instruction: 'หลังอาหารเช้า',
            periods: ['morning'],
            times: { morning: '07:30' },
          },
        ],
      };
    case 'chai':
      return {
        ...base,
        age: 41,
        gender: 'male',
        birthDate: { day: 3, month: 9, yearBE: 2528 },
        heightCm: 172,
        weightKg: 78,
        vitals: [
          demoReading('chai-v1', 14, { glucose: 131, glucoseTiming: 'fasting', systolic: 134, diastolic: 88 }),
          demoReading('chai-v2', 10, { weightKg: 78.2 }),
          demoReading('chai-v3', 7, { glucose: 124, glucoseTiming: 'fasting' }),
          demoReading('chai-v4', 3, { glucose: 118, glucoseTiming: 'fasting', systolic: 132, diastolic: 86 }),
          demoReading('chai-v5', 2, { weightKg: 77.8 }),
        ],
        health: {
          conditions: ['เบาหวานชนิดที่ 2'],
          allergies: ['แพ้ยาเพนิซิลลิน'],
          bloodPressure: '132/86',
          bloodSugar: '118',
          note: 'งดของหวานตามคำแนะนำแพทย์',
          history: [
            { id: 'chai-h1', at: '2026-10-05', label: 'เจาะเลือดติดตามน้ำตาล', detail: 'น้ำตาล 118 มก./ดล. · ลดลงจากครั้งก่อน' },
            { id: 'chai-h2', at: '2026-07-14', label: 'พบแพทย์ตามนัด', detail: 'ปรับขนาดยาเบาหวาน' },
          ],
        },
        meds: [
          {
            id: 'chai-m1',
            name: 'ยาเบาหวาน (Metformin 500 mg)',
            dose: '1 เม็ด',
            form: 'ยาเม็ด',
            condition: 'เบาหวานชนิดที่ 2',
            instruction: 'พร้อมอาหารเช้าและเย็น',
            periods: ['morning', 'evening'],
            times: { morning: '08:00', evening: '18:30' },
          },
          {
            id: 'chai-m2',
            name: 'ยาฉีดลดเบาหวาน (Insulin)',
            dose: '10 ยูนิต',
            form: 'ยาฉีด',
            condition: 'เบาหวานชนิดที่ 2',
            instruction: 'ฉีดก่อนนอน',
            periods: ['bedtime'],
            times: { bedtime: '21:00' },
          },
        ],
      };
    case 'daeng':
      return {
        ...base,
        age: 63,
        gender: 'female',
        birthDate: { day: null, month: null, yearBE: 2506 },
        heightCm: 155,
        weightKg: 61,
        vitals: [
          demoReading('daeng-v1', 12, { systolic: 136, diastolic: 86 }),
          demoReading('daeng-v2', 5, { systolic: 138, diastolic: 88, glucose: 102, glucoseTiming: 'fasting', weightKg: 61 }),
        ],
        health: {
          conditions: ['ข้อเข่าเสื่อม'],
          allergies: ['แพ้ฝุ่น'],
          bloodPressure: '138/88',
          bloodSugar: '102',
          note: 'ทำกายภาพบำบัดหัวเข่าสัปดาห์ละ 2 ครั้ง',
          history: [
            { id: 'daeng-h1', at: '2026-08-20', label: 'ตรวจข้อเข่ากับแพทย์ออร์โธปิดิกส์', detail: 'แนะนำออกกำลังกายเบา ๆ และทายาแก้ปวด' },
          ],
        },
        meds: [
          {
            id: 'daeng-m1',
            name: 'ยานวดบรรเทาปวดข้อ (Glucosamine Cream)',
            dose: 'ทาบาง ๆ',
            form: 'ยาทา/ครีม',
            condition: 'ข้อเข่าเสื่อม',
            instruction: 'ทาบริเวณหัวเข่า เช้าและก่อนนอน',
            periods: ['morning', 'bedtime'],
            times: { morning: '08:00', bedtime: '21:00' },
          },
        ],
      };
    default:
      return base;
  }
}

/** อ่านข้อมูลสมาชิกทั้งหมด (สร้างข้อมูลตัวอย่างให้สมาชิกที่ยังไม่มีข้อมูล) */
export function loadMemberRecords(): Record<string, MemberRecord> {
  let stored: Record<string, MemberRecord> = {};
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (raw) stored = JSON.parse(raw) as Record<string, MemberRecord>;
  } catch {
    stored = {};
  }

  const result: Record<string, MemberRecord> = {};
  for (const member of loadSettings().members) {
    let record: MemberRecord = { ...seedRecord(member.id), ...(stored[member.id] ?? {}), id: member.id };
    if (cloudEnabled) {
      if (member.id === CURRENT_MEMBER_ID) {
        // ข้อมูลสุขภาพของตัวเองอ้างอิงจากข้อมูลพื้นฐานเสมอ เพื่อให้คนในบ้านเห็นข้อมูลล่าสุด
        const fresh = seedRecord(member.id);
        record = { ...record, age: fresh.age, gender: fresh.gender, birthDate: fresh.birthDate, heightCm: fresh.heightCm, weightKg: fresh.weightKg, health: { ...record.health, ...fresh.health, note: record.health.note, history: record.health.history } };
      }
      if (member.photo) record = { ...record, photo: member.photo };
    }
    result[member.id] = record;
  }
  // เก็บข้อมูลของสมาชิกที่ยังอยู่ในบ้านเท่านั้น
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(result));
  } catch {
    // เก็บไม่ได้: ใช้ข้อมูลชั่วคราวในหน่วยความจำ
  }
  return result;
}

export function loadMemberRecord(id: string): MemberRecord {
  return loadMemberRecords()[id] ?? seedRecord(id);
}

export function saveMemberRecord(record: MemberRecord): void {
  const all = loadMemberRecords();
  all[record.id] = record;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save member record', err);
  }
  queueSync('records', [record.id]);
  window.dispatchEvent(new Event(MEMBERS_CHANGED_EVENT));
}

/**
 * เผยแพร่ข้อมูลของตัวเอง (สุขภาพ + สรุปตารางยา) ให้คนในบ้านเห็น
 * เรียกเมื่อกรอกข้อมูลพื้นฐานหรือแก้ตู้ยา (เฉพาะโหมดคลาวด์)
 */
const PUBLISHED_LOG_DAYS = 45;
let publishTimer: number | undefined;
function publishOwnRecord(): void {
  if (!cloudEnabled || !isOnboardingDone()) return;
  window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    const mine = loadMemberRecord(CURRENT_MEMBER_ID);
    const meds = loadMeds()
      .meds.filter((m) => m.active)
      .map<MemberMed>((m) => ({
        id: m.id,
        name: m.name,
        dose: `${m.perDose} ${m.unit}`,
        periods: m.periods,
        times: m.times,
        form: formatMedForm(m),
        condition: m.condition,
        instruction: instructionText(m),
      }));
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - PUBLISHED_LOG_DAYS);
    const since = todayKey(oldest);
    const doseLogs = loadMeds().logs.filter((l) => l.date >= since);
    saveMemberRecord({ ...mine, meds, doseLogs });
  }, 600);
}

if (typeof window !== 'undefined' && cloudEnabled) {
  window.addEventListener(ONBOARDING_CHANGED_EVENT, publishOwnRecord);
  window.addEventListener(MEDS_CHANGED_EVENT, publishOwnRecord);
}

/** ชื่อ + ข้อมูลพื้นฐานของสมาชิกคนหนึ่ง */
export function findMember(id: string): HouseholdMember | undefined {
  return loadSettings().members.find((m) => m.id === id);
}

/** ความสัมพันธ์ของสมาชิก (ใช้แสดงในหน้าต่าง ๆ) */
export function relationOf(member: HouseholdMember): string {
  return member.id === CURRENT_MEMBER_ID ? 'ฉัน' : member.relation;
}

/** ข้อมูลยาของสมาชิก (ของฉันเองดึงจากตู้ยาจริง) */
export function memberMeds(record: MemberRecord): MemberMed[] {
  if (record.id !== CURRENT_MEMBER_ID) return record.meds;
  return loadMeds()
    .meds.filter((m) => m.active)
    .map<MemberMed>((m) => ({
      id: m.id,
      name: m.name,
      dose: `${m.perDose} ${m.unit}`,
      periods: m.periods,
      times: m.times,
    }));
}
