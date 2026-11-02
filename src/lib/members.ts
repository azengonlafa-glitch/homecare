import { loadMeds, type DosePeriod } from './meds';
import { loadOnboarding } from './onboarding';
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
}

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

export interface MemberRecord {
  id: string;
  age: number | null;
  gender: Gender | '';
  photo: string;
  sharing: MemberSharing;
  health: MemberHealth;
  meds: MemberMed[];
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

const sharingFor = (id: string): MemberSharing => ({
  shareData: true,
  editPolicy: id === CURRENT_MEMBER_ID ? 'choose' : 'choose',
  allowedEditors: [],
  blockedEditors: [],
});

/** ข้อมูลตัวอย่างของสมาชิกในบ้าน (ต้นแบบยังไม่มีเซิร์ฟเวอร์) */
function seedRecord(id: string): MemberRecord {
  const base: MemberRecord = {
    id,
    age: null,
    gender: '',
    photo: '',
    sharing: sharingFor(id),
    health: emptyHealth(),
    meds: [],
  };

  switch (id) {
    case 'me': {
      const profile = loadOnboarding().profile;
      const meds = loadMeds().meds
        .filter((m) => m.active)
        .map<MemberMed>((m) => ({
          id: m.id,
          name: m.name,
          dose: `${m.perDose} ${m.unit}`,
          periods: m.periods,
          times: m.times,
        }));
      return {
        ...base,
        age: 68,
        gender: 'female',
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
          { id: 'mint-m1', name: 'ยาลดความดัน (Amlodipine 5 mg)', dose: '1 เม็ด', periods: ['morning'], times: { morning: '07:30' } },
        ],
      };
    case 'chai':
      return {
        ...base,
        age: 41,
        gender: 'male',
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
          { id: 'chai-m1', name: 'Metformin 500 mg', dose: '1 เม็ด', periods: ['morning', 'evening'], times: { morning: '08:00', evening: '18:30' } },
        ],
      };
    case 'daeng':
      return {
        ...base,
        age: 63,
        gender: 'female',
        health: {
          conditions: ['ข้อเข่าเสื่อม'],
          allergies: ['แพ้ฝุ่น'],
          bloodPressure: '145/92',
          bloodSugar: '101',
          note: 'เดินเบา ๆ วันละ 20 นาที',
          history: [{ id: 'daeng-h1', at: '2026-08-21', label: 'กายภาพบำบัดเข่า', detail: 'ทำต่อเนื่อง 4 ครั้ง อาการดีขึ้น' }],
        },
        meds: [
          { id: 'daeng-m1', name: 'ยาแก้ปวดข้อ (Celecoxib 200 mg)', dose: '1 แคปซูล', periods: ['evening'], times: { evening: '19:00' } },
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
    result[member.id] = { ...seedRecord(member.id), ...(stored[member.id] ?? {}), id: member.id };
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
  window.dispatchEvent(new Event(MEMBERS_CHANGED_EVENT));
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
