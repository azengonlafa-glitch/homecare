import { FEVER_OPTIONS, HEADACHE_OPTIONS, STOMACH_OPTIONS, type SymptomOption } from '../data/consultReference';
import type { Channel, CheckinAnswers, ConsentScope, SessionStatus, Trend } from './types';

export const CHANNEL_LABEL: Record<Channel, string> = {
  chat: 'แชท',
  voice: 'โทรเสียง',
  video: 'วิดีโอคอล',
  appointment: 'นัดหมายล่วงหน้า',
};

export const PROVIDER_STATUS_LABEL: Record<'open' | 'paused' | 'banned', string> = {
  open: 'เปิดให้บริการ',
  paused: 'ปิดชั่วคราว',
  banned: 'ถูกแบน',
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  requested: 'รอผู้ให้บริการรับเรื่อง',
  active: 'กำลังปรึกษา',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิกแล้ว',
};

export const TREND_LABEL: Record<Exclude<Trend, ''>, string> = { better: 'ดีขึ้น', same: 'เท่าเดิม', worse: 'แย่ลง' };

export const PURPOSES = [
  { value: 'symptoms', label: 'อาการที่เป็นอยู่ตอนนี้' },
  { value: 'medication_question', label: 'คำถามเรื่องยา' },
  { value: 'side_effects', label: 'ผลข้างเคียงจากยา' },
  { value: 'follow_up', label: 'ติดตามผลการรักษา' },
  { value: 'med_management', label: 'จัดการการใช้ยา' },
  { value: 'other', label: 'เรื่องอื่น ๆ' },
];

/** ถ้าเรื่องที่ปรึกษาไม่เกี่ยวกับอาการ ไม่บังคับเลือกอาการ */
export const SYMPTOM_REQUIRED_PURPOSES = ['symptoms', 'side_effects', 'follow_up'];

export const SYMPTOM_GROUPS: { title: string; items: { value: string; label: string }[] }[] = [
  {
    title: 'ปวดหัว เวียนหัว',
    items: [
      { value: 'headache', label: 'ปวดหัว' },
      { value: 'dizziness', label: 'เวียนหัว' },
    ],
  },
  {
    title: 'ไข้ ไอ เจ็บคอ',
    items: [
      { value: 'fever', label: 'มีไข้' },
      { value: 'cough', label: 'ไอ' },
      { value: 'sore_throat', label: 'เจ็บคอ' },
    ],
  },
  {
    title: 'ปวดท้อง คลื่นไส้',
    items: [
      { value: 'stomach_pain', label: 'ปวดท้อง' },
      { value: 'nausea', label: 'คลื่นไส้' },
    ],
  },
  {
    title: 'ผิวหนัง คัน ผื่น',
    items: [
      { value: 'skin_problem', label: 'ปัญหาผิวหนัง' },
      { value: 'itching', label: 'คัน' },
      { value: 'rash', label: 'ผื่น' },
    ],
  },
  { title: 'เกี่ยวกับการใช้ยา', items: [{ value: 'med_symptom', label: 'มีอาการหลังใช้ยา' }] },
  { title: 'อื่น ๆ', items: [{ value: 'other', label: 'อาการอื่น' }] },
];

export const SYMPTOM_LABEL: Record<string, string> = Object.fromEntries(
  SYMPTOM_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label]))
);

export const FEELINGS = [
  { value: 'normal', label: 'รู้สึกปกติ' },
  { value: 'uncomfortable', label: 'ไม่สบายตัว' },
  { value: 'fatigued', label: 'อ่อนเพลีย' },
  { value: 'worried', label: 'กังวล' },
  { value: 'getting_worse', label: 'รู้สึกแย่ลงเรื่อย ๆ' },
  { value: 'affects_daily', label: 'กระทบชีวิตประจำวัน' },
];
export const FEELING_LABEL: Record<string, string> = Object.fromEntries(FEELINGS.map((f) => [f.value, f.label]));

export const DURATIONS = [
  { value: 'ไม่ถึง 1 วัน', label: 'ไม่ถึง 1 วัน' },
  { value: '1-3 วัน', label: '1-3 วัน' },
  { value: '4-7 วัน', label: '4-7 วัน' },
  { value: '1-4 สัปดาห์', label: '1-4 สัปดาห์' },
  { value: 'มากกว่า 1 เดือน', label: 'มากกว่า 1 เดือน' },
];

/** ตัวช่วยเริ่มเล่าอาการ กดแล้วเติมหัวข้อในช่องคำอธิบายให้พิมพ์ต่อ */
export const DESCRIBE_STARTERS = ['ลักษณะอาการ: ', 'เป็นมากตอน: ', 'เกิดขึ้นหลังจาก: ', 'กระทบชีวิตประจำวันคือ: '];

export const PATTERNS = ['เป็นตลอดเวลา', 'เป็น ๆ หาย ๆ', 'เป็นบางช่วงของวัน', 'เป็นครั้งแรก', 'เคยเป็นมาก่อน'].map((v) => ({ value: v, label: v }));

export const SCOPE_LABEL: Record<ConsentScope, { title: string; hint: string }> = {
  symptoms: { title: 'อาการล่าสุด', hint: 'จำเป็นสำหรับการปรึกษา' },
  overview: { title: 'ข้อมูลพื้นฐาน', hint: 'ชื่อ อายุ เพศ น้ำหนัก ส่วนสูง กรุ๊ปเลือด' },
  allergies: { title: 'ประวัติแพ้ยา', hint: 'ชื่อยาที่แพ้ อาการ และความรุนแรง' },
  medications: { title: 'ยาที่ใช้อยู่', hint: 'ชื่อยา ขนาด ความถี่ เวลา จากตู้ยาและข้อมูลสุขภาพ' },
  history: { title: 'ประวัติสุขภาพ', hint: 'โรคประจำตัว การผ่าตัด ประวัติครอบครัว อาหารเสริม' },
  previous: { title: 'การปรึกษาครั้งก่อน', hint: 'คำแนะนำและแผนติดตามเดิม รวมถึงการเปรียบเทียบอาการ' },
};

export const ALL_SCOPES: ConsentScope[] = ['symptoms', 'overview', 'allergies', 'medications', 'history', 'previous'];

export const CONSENT_VERSION = 'consult-2026-11-v2';

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  hint?: string;
  kind: 'text' | 'date' | 'single' | 'multi' | 'med';
  options?: QuestionOption[];
  required?: boolean;
}

const toOptions = (list: SymptomOption[]): QuestionOption[] => list.map((o) => ({ value: o.id, label: o.label }));

/**
 * คำถามเพิ่มเติมตามอาการ แสดงเฉพาะที่เกี่ยวข้อง คำตอบส่งให้ผู้ให้บริการอ่าน ระบบไม่ประเมินเอง
 */
export function questionsFor(a: Pick<CheckinAnswers, 'purpose' | 'symptoms'>): Question[] {
  const has = (id: string) => a.symptoms.includes(id);
  const out: Question[] = [];

  if (a.purpose === 'side_effects' || has('med_symptom')) {
    out.push(
      { id: 'se_drug', label: 'คิดว่าเกี่ยวกับยาตัวไหน', kind: 'med', required: true },
      { id: 'se_start', label: 'เริ่มใช้ยานี้เมื่อไร', kind: 'date' },
      { id: 'se_after', label: 'หลังใช้ยามีลักษณะอาการอย่างไร', kind: 'text', required: true }
    );
  }
  if (has('headache')) {
    out.push(
      { id: 'ha_where', label: 'ปวดตรงไหน', kind: 'single', options: ['ทั้งศีรษะ', 'ข้างเดียว', 'หน้าผาก', 'ท้ายทอย', 'ไม่แน่ใจ'].map((v) => ({ value: v, label: v })) },
      { id: 'ha_long', label: 'แต่ละครั้งปวดนานเท่าไร', kind: 'single', options: ['ไม่ถึง 1 ชั่วโมง', '1-4 ชั่วโมง', 'มากกว่า 4 ชั่วโมง', 'ปวดตลอด'].map((v) => ({ value: v, label: v })) },
      { id: 'ha_flags', label: 'มีข้อไหนร่วมด้วยไหม', hint: 'เลือกได้หลายข้อ ถ้าไม่มีให้ข้ามได้', kind: 'multi', options: toOptions(HEADACHE_OPTIONS) }
    );
  }
  if (has('stomach_pain')) {
    out.push(
      { id: 'st_where', label: 'ปวดตรงไหน', kind: 'single', options: ['ท้องส่วนบน', 'รอบสะดือ', 'ท้องน้อย', 'ทั่วท้อง', 'ไม่แน่ใจ'].map((v) => ({ value: v, label: v })) },
      { id: 'st_meal', label: 'เกี่ยวกับมื้ออาหารไหม', kind: 'single', options: ['ปวดก่อนอาหาร', 'ปวดหลังอาหาร', 'ไม่เกี่ยว', 'ไม่แน่ใจ'].map((v) => ({ value: v, label: v })) },
      { id: 'st_flags', label: 'มีข้อไหนร่วมด้วยไหม', hint: 'เลือกได้หลายข้อ ถ้าไม่มีให้ข้ามได้', kind: 'multi', options: toOptions(STOMACH_OPTIONS) }
    );
  }
  if (has('fever')) {
    out.push(
      { id: 'fv_temp', label: 'วัดอุณหภูมิได้เท่าไร (องศาเซลเซียส)', hint: 'ถ้าไม่ได้วัดให้เว้นว่าง', kind: 'text' },
      { id: 'fv_flags', label: 'ข้อนี้ตรงกับคุณไหม', kind: 'multi', options: toOptions(FEVER_OPTIONS) }
    );
  }
  if (has('rash') || has('skin_problem') || has('itching')) {
    out.push(
      { id: 'sk_where', label: 'เป็นที่ส่วนไหนของร่างกาย', kind: 'text' },
      { id: 'sk_new', label: 'ช่วงนี้เริ่มใช้ยา อาหาร หรือผลิตภัณฑ์ใหม่ไหม', kind: 'text' }
    );
  }
  return out;
}

export const emptyAnswers = (): CheckinAnswers => ({
  purpose: '',
  otherPurpose: '',
  symptoms: [],
  otherSymptom: '',
  severity: null,
  feelings: [],
  description: '',
  location: '',
  pattern: '',
  worseWith: '',
  betterWith: '',
  duration: '',
  startedOn: '',
  trend: '',
  previousMeds: '',
  additionalSymptoms: '',
  attachments: [],
  answers: {},
});

export const purposeLabel = (a: Pick<CheckinAnswers, 'purpose' | 'otherPurpose'>) =>
  a.purpose === 'other' && a.otherPurpose.trim()
    ? a.otherPurpose.trim()
    : PURPOSES.find((p) => p.value === a.purpose)?.label ?? '';

export const symptomLabels = (a: Pick<CheckinAnswers, 'symptoms' | 'otherSymptom'>) =>
  a.symptoms.map((s) => (s === 'other' && a.otherSymptom.trim() ? a.otherSymptom.trim() : SYMPTOM_LABEL[s] ?? s));
