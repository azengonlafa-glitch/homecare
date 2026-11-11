import { queueSync } from '../cloud/queue';
import { cloudEnabled } from '../cloud/client';
const ONBOARDING_KEY = 'growa_onboarding_v1';

/**
 * ปุ่มข้ามขั้นตอนกรอกข้อมูลพื้นฐาน สำหรับช่วงพัฒนาเท่านั้น
 * TODO(dev): ตั้งเป็น false หรือลบทิ้งก่อนใช้งานจริง (ลบ guard ที่เกี่ยวกับ `skipped` ด้วย)
 */
export const ENABLE_DEV_SKIP = !cloudEnabled;
export const ONBOARDING_CHANGED_EVENT = 'growa-onboarding-changed';

/** ข้อมูลไฟล์ที่แนบ (ตัวไฟล์จริงเก็บใน IndexedDB ผ่าน lib/fileStore.ts) */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface DrugAllergy {
  drug: string;
  symptoms: string;
  severity: 'mild' | 'moderate' | 'severe';
  /** บัตรแพ้ยา ใบรับรองแพทย์ รูปอาการ ฯลฯ */
  attachments?: Attachment[];
}

export interface OnboardingProfile {
  // 1 ข้อมูลส่วนตัว
  fullName: string;
  birthDay: string;
  birthMonth: string;
  /** ปี พ.ศ. */
  birthYear: string;
  gender: string;
  occupation: string;
  phone: string;
  // 2 ร่างกายและไลฟ์สไตล์
  heightCm: string;
  weightKg: string;
  bloodType: string;
  smoking: string;
  alcohol: string;
  exercise: string;
  /** ค่าตรวจล่าสุด (ไม่บังคับ ใช้วิเคราะห์ในหน้าข้อมูลสุขภาพ) ความดันตัวบน/ล่าง mmHg และน้ำตาลตอนอดอาหาร mg/dL */
  systolic: string;
  diastolic: string;
  fastingGlucose: string;
  // 3 ประวัติการแพ้
  noAllergies: boolean;
  drugAllergies: DrugAllergy[];
  otherAllergies: string[];
  // 4 โรคและยาที่ใช้
  noConditions: boolean;
  conditions: string[];
  currentMeds: string[];
  supplements: string;
  surgeryHistory: string;
  pharmacistNote: string;
  // 5 ประวัติครอบครัว
  familyHistory: string[];
  // 6 ติดต่อและที่อยู่
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  address: string;
  lat: number | null;
  lng: number | null;
  // 7 เอกสารทางการแพทย์ (ไม่บังคับ)
  medicalDocs: Attachment[];
  medicalNotes: string;
  // 8 ความยินยอม
  consent: boolean;
  /** เวลาที่กดยอมรับเอกสาร (ISO) */
  consentAt: string | null;
  consentVersion: string | null;
}

export interface OnboardingState {
  completed: boolean;
  /** ข้ามด้วยปุ่ม dev (ยังไม่ได้กรอกครบ) */
  skipped?: boolean;
  profile: OnboardingProfile;
}

export const emptyProfile: OnboardingProfile = {
  fullName: '',
  birthDay: '',
  birthMonth: '',
  birthYear: '',
  gender: '',
  occupation: '',
  phone: '',
  heightCm: '',
  weightKg: '',
  bloodType: '',
  smoking: '',
  alcohol: '',
  exercise: '',
  systolic: '',
  diastolic: '',
  fastingGlucose: '',
  noAllergies: false,
  drugAllergies: [],
  otherAllergies: [],
  noConditions: false,
  conditions: [],
  currentMeds: [],
  supplements: '',
  surgeryHistory: '',
  pharmacistNote: '',
  familyHistory: [],
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  address: '',
  lat: null,
  lng: null,
  medicalDocs: [],
  medicalNotes: '',
  consent: false,
  consentAt: null,
  consentVersion: null,
};

export function loadOnboarding(): OnboardingState {
  try {
    const item = localStorage.getItem(ONBOARDING_KEY);
    if (item) {
      const parsed = JSON.parse(item) as Partial<OnboardingState>;
      return {
        completed: !!parsed.completed,
        skipped: !!parsed.skipped,
        profile: { ...emptyProfile, ...(parsed.profile ?? {}) },
      };
    }
  } catch {
    // ข้อมูลเสีย: เริ่มใหม่
  }
  return { completed: false, profile: { ...emptyProfile } };
}

export function saveOnboarding(state: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save onboarding to localStorage', err);
  }
  queueSync('onboarding');
  window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
}

/** ผ่านด่านกรอกข้อมูลพื้นฐานแล้ว (กรอกครบ หรือกดข้ามตอน dev) */
export function isOnboardingDone(): boolean {
  const state = loadOnboarding();
  return state.completed || (ENABLE_DEV_SKIP && !!state.skipped);
}

const phonePattern = /^0\d{8,9}$/;

/** ตรวจข้อมูลของแต่ละขั้น คืนค่า { รหัสช่อง: ข้อความผิดพลาด } ว่างเปล่า = ผ่าน */
export function validateStep(step: number, p: OnboardingProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  const digits = (value: string) => value.replace(/\D/g, '');

  if (step === 0) {
    if (!p.fullName.trim()) errors['ob-fullname'] = 'กรุณากรอกชื่อ-นามสกุล';
    // อายุจำเป็น: ขนาดยาและข้อห้ามใช้ยาขึ้นกับอายุ (เก็บเป็นปีเกิด พ.ศ. คำนวณจากอายุ)
    const age = new Date().getFullYear() + 543 - Number(p.birthYear);
    if (!p.birthYear || age < 0 || age > 120) errors['ob-age'] = 'กรุณากรอกอายุเป็นตัวเลข 0–120 ปี';
    if (!p.gender) errors['ob-gender'] = 'กรุณาเลือกเพศ';
    if (!p.phone.trim()) {
      errors['ob-phone'] = 'กรุณากรอกเบอร์โทรศัพท์';
    } else if (!phonePattern.test(digits(p.phone))) {
      errors['ob-phone'] = 'กรอกเบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0';
    }
  }

  if (step === 1) {
    // น้ำหนักจำเป็น: ใช้คำนวณขนาดยา
    if (!p.weightKg) {
      errors['ob-weight'] = 'กรุณากรอกน้ำหนัก';
    } else if (!(Number(p.weightKg) >= 1 && Number(p.weightKg) <= 400)) {
      errors['ob-weight'] = 'น้ำหนักควรอยู่ระหว่าง 1–400 กก.';
    }
    if (p.heightCm && !(Number(p.heightCm) >= 30 && Number(p.heightCm) <= 250)) {
      errors['ob-height'] = 'ส่วนสูงควรอยู่ระหว่าง 30–250 ซม.';
    }
  }

  // ประวัติแพ้ยา/อาหาร: ต้องระบุอย่างน้อย 1 รายการ หรือยืนยันว่าไม่เคยแพ้
  if (step === 2 && !p.noAllergies && p.drugAllergies.length === 0 && p.otherAllergies.length === 0) {
    errors['ob-no-allergies'] =
      'กรุณาเพิ่มประวัติที่แพ้ หรือติ๊กว่าไม่เคยแพ้อะไรเลย (ถ้าพิมพ์ชื่อยาไว้ ให้กด "เพิ่มประวัติแพ้ยา" ก่อน)';
  }

  // โรคประจำตัว: ต้องเลือกอย่างน้อย 1 โรค หรือยืนยันว่าไม่มี
  if (step === 3 && !p.noConditions && p.conditions.length === 0) {
    errors['ob-no-conditions'] = 'กรุณาเลือกโรคประจำตัว หรือติ๊กว่าไม่มีโรคประจำตัว';
  }

  if (step === 5) {
    if (!p.emergencyName.trim()) errors['ob-emergency-name'] = 'กรุณากรอกชื่อผู้ติดต่อฉุกเฉิน';
    if (!p.emergencyPhone.trim()) {
      errors['ob-emergency-phone'] = 'กรุณากรอกเบอร์โทรผู้ติดต่อฉุกเฉิน';
    } else if (!phonePattern.test(digits(p.emergencyPhone))) {
      errors['ob-emergency-phone'] = 'กรอกเบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0';
    }
    if (!p.address.trim()) errors['ob-address'] = 'กรุณากรอกที่อยู่จัดส่ง';
  }

  if (step === 7 && !p.consent) {
    errors['ob-consent'] = 'กรุณาเปิดอ่านเอกสารให้จบและกดยอมรับก่อนเริ่มใช้งาน';
  }

  return errors;
}

export function clearOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ไม่มีสิทธิ์เข้าถึง localStorage: ข้ามได้
  }
}
