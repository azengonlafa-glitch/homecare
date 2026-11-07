import type { Attachment } from '../lib/onboarding';

/** โครงข้อมูลของระบบปรึกษา ใช้ร่วมกันทั้ง Mock และ Supabase */

/** รหัสหมวดหมู่ผู้ให้บริการ (เช่น pharmacist, clinic หรือหมวดที่แอดมินเพิ่มเอง) */
export type ProviderKind = string;

export interface Category {
  id: string;
  label: string;
}

export interface Review {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
}
export type Channel = 'chat' | 'voice' | 'video' | 'appointment';
/** admin หรือรหัสหมวดหมู่ของร้านที่สังกัด */
export type StaffRole = string;
/** open = เปิดให้บริการ, paused = ปิดชั่วคราว (ผู้ใช้ไม่เห็น การปรึกษาที่เปิดอยู่ยังคุยต่อได้), banned = ถูกแบน (ยกเลิกการปรึกษาที่ค้างและทีมงานเข้าไม่ได้) */
export type ProviderStatus = 'open' | 'paused' | 'banned';
export type SessionStatus = 'requested' | 'active' | 'completed' | 'cancelled';
export type Trend = '' | 'better' | 'same' | 'worse';
export type ConsentScope = 'overview' | 'history' | 'allergies' | 'medications' | 'symptoms' | 'previous';
export type FollowUpStatus = 'pending' | 'responded' | 'reviewed';

export interface Provider {
  id: string;
  kind: ProviderKind;
  /** ชื่อหมวดหมู่ที่แสดง */
  kindLabel: string;
  displayName: string;
  photoUrl: string;
  specialties: string[];
  orgName: string;
  licenseNo: string;
  /** แนะนำตัวและบริการ */
  about: string;
  address: string;
  province: string;
  /** ลิงก์แผนที่ (https) */
  mapUrl: string;
  /** เบอร์โทรของร้าน ตัวเลขล้วน */
  phone: string;
  lineId: string;
  contactEmail: string;
  website: string;
  hours: string;
  channels: Channel[];
  online: boolean;
  status: ProviderStatus;
  /** เหตุผลที่ปิดหรือแบน เห็นเฉพาะแอดมิน */
  statusNote: string;
  /** null = ยังไม่มีรีวิวจริง ห้ามแสดงคะแนน */
  rating: number | null;
  reviewCount: number;
  /** ผู้ให้บริการตัวอย่างในโหมดทดสอบ */
  isSample: boolean;
}

/** ข้อมูลที่แอดมินกรอกได้ คะแนนรีวิวไม่อยู่ในนี้โดยตั้งใจ: แอดมินตั้งเองไม่ได้ */
export interface ProviderInput {
  id?: string;
  kind: ProviderKind;
  displayName: string;
  /** รูปที่ย่อแล้ว (data URL) หรือลิงก์ https */
  photoUrl: string;
  specialties: string[];
  orgName: string;
  licenseNo: string;
  about: string;
  address: string;
  province: string;
  mapUrl: string;
  phone: string;
  lineId: string;
  contactEmail: string;
  website: string;
  hours: string;
  channels: Channel[];
}

export interface StaffRecord {
  userId: string;
  email: string;
  role: StaffRole;
  providerId: string | null;
  /** เบอร์ตัวเลขล้วน ว่างได้ */
  phone: string;
}

export type AnswerValue = string | string[];

/** สิ่งที่ผู้ใช้กรอกในแบบสอบถาม (ยังไม่ได้ส่ง) */
export interface CheckinAnswers {
  purpose: string;
  otherPurpose: string;
  symptoms: string[];
  otherSymptom: string;
  severity: number | null;
  feelings: string[];
  description: string;
  /** ตำแหน่งที่เป็น */
  location: string;
  /** เป็นตลอด เป็น ๆ หาย ๆ ฯลฯ */
  pattern: string;
  worseWith: string;
  betterWith: string;
  duration: string;
  startedOn: string;
  trend: Trend;
  previousMeds: string;
  additionalSymptoms: string;
  attachments: Attachment[];
  /** คำตอบจากคำถามเพิ่มเติมตามอาการ */
  answers: Record<string, AnswerValue>;
}

/** ผลแบบสอบถามที่บันทึกแล้ว มีเวลาเป็นของตัวเองและแยกจากข้อมูลสุขภาพพื้นฐาน */
export interface SymptomCheckin extends CheckinAnswers {
  id: string;
  createdAt: string;
}

export interface BriefOverview {
  name: string;
  age: number | null;
  gender: string;
  heightCm: string;
  weightKg: string;
  bloodType: string;
  birthDate: string;
  occupation: string;
}

export interface BriefLifestyle {
  systolic: string;
  diastolic: string;
  fastingGlucose: string;
  smoking: string;
  alcohol: string;
  exercise: string;
}

export interface BriefHistory {
  conditions: string[];
  noConditions: boolean;
  surgeryHistory: string;
  familyHistory: string[];
  supplements: string;
  notes: string;
  medicalNotes: string;
  medicalDocs: Attachment[];
}

export interface BriefAllergy {
  drug: string;
  symptoms: string;
  severity: string;
  attachments: Attachment[];
}

export interface BriefAllergies {
  noAllergies: boolean;
  drugs: BriefAllergy[];
  other: string[];
}

export interface BriefMedication {
  name: string;
  dose: string;
  schedule: string;
  times: string;
  startDate: string;
  form: string;
  condition: string;
  reason: string;
  note: string;
  remaining: string;
  expiryDate: string;
  /** สรุปการกินยา 30 วัน */
  adherence: string;
  missedReasons: string;
  /** cabinet = จากตู้ยา, profile = จากข้อมูลสุขภาพที่แจ้งไว้เท่านั้น */
  source: 'cabinet' | 'profile';
}

export interface BriefPastMedication {
  name: string;
  dose: string;
  period: string;
  note: string;
}

export interface BriefLog {
  date: string;
  title: string;
  symptoms: string[];
  mood: string;
  content: string;
}

export interface BriefSymptoms {
  recordedAt: string;
  purpose: string;
  symptoms: string[];
  severity: number | null;
  feelings: string[];
  duration: string;
  startedOn: string;
  trend: Trend;
  description: string;
  location: string;
  pattern: string;
  worseWith: string;
  betterWith: string;
  previousMeds: string;
  additionalSymptoms: string;
  answers: { question: string; answer: string }[];
  attachments: Attachment[];
}

export interface BriefPrevious {
  date: string;
  providerName: string;
  topic: string;
  severity: number | null;
  assessment: string;
  advice: string;
  referral: string;
  followUpPlan: string;
}

export type ChangeDirection = 'increased' | 'decreased' | 'same' | 'unknown';

export interface BriefChanges {
  previousDate: string;
  previousSeverity: number | null;
  currentSeverity: number | null;
  direction: ChangeDirection;
  previousSymptoms: string[];
  newSymptoms: string[];
}

export interface BriefMedContext {
  /** ข้อความนี้เป็นสิ่งที่ควรตรวจสอบ ไม่ใช่การสรุปสาเหตุ */
  items: string[];
}

/** ผลจากระบบช่วยเตรียมข้อมูล แยกจากข้อมูลที่ผู้ใช้รายงานเสมอ */
export interface BriefAssistant {
  engine: 'rules';
  summary: string;
  missing: string[];
}

export interface PatientBrief {
  generatedAt: string;
  scopes: ConsentScope[];
  overview?: BriefOverview;
  lifestyle?: BriefLifestyle;
  history?: BriefHistory;
  allergies?: BriefAllergies;
  medications?: BriefMedication[];
  pastMedications?: BriefPastMedication[];
  recentLogs?: BriefLog[];
  symptoms?: BriefSymptoms;
  previous?: BriefPrevious[];
  changes?: BriefChanges;
  medContext?: BriefMedContext;
  assistant: BriefAssistant;
}

export interface ConsultSession {
  id: string;
  patientId: string;
  patientLabel: string;
  providerId: string;
  channel: Channel;
  status: SessionStatus;
  topic: string;
  scheduledAt: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  /** เจ้าหน้าที่ที่รับเคสนี้ null = ยังไม่มีผู้ดูแล */
  assignedTo: string | null;
  assignedName: string;
}

export interface ConsultConsent {
  id: string;
  sessionId: string;
  providerId: string;
  scopes: ConsentScope[];
  version: string;
  grantedAt: string;
  revokedAt: string | null;
}

export interface ConsultMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderRole: 'patient' | 'staff';
  body: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface NoteFields {
  assessment: string;
  medicationAdvice: string;
  recommendation: string;
  referral: string;
  followUpPlan: string;
  followUpDue: string;
}

export interface ConsultNote extends NoteFields {
  sessionId: string;
  confirmedAt: string | null;
  updatedAt: string;
}

export interface FollowUpResponse {
  severity: number | null;
  feelings: string[];
  trend: Trend;
  note: string;
}

export interface FollowUp {
  id: string;
  sessionId: string;
  providerId: string;
  dueDate: string;
  plan: string;
  status: FollowUpStatus;
  response: FollowUpResponse | null;
  respondedAt: string | null;
  reviewedAt: string | null;
}

export interface AccessLogEntry {
  id: string;
  sessionId: string;
  action: string;
  at: string;
}

export interface StaffContext {
  userId: string;
  role: StaffRole;
  providerId: string | null;
}

/** ข้อมูลครบของการปรึกษาหนึ่งครั้ง ฝั่งผู้ใช้ */
export interface SessionBundle {
  session: ConsultSession;
  provider: Provider | null;
  checkin: SymptomCheckin | null;
  consent: ConsultConsent | null;
  note: ConsultNote | null;
  followUps: FollowUp[];
  /** รีวิวที่ผู้ใช้ให้ไว้ null = ยังไม่ได้รีวิว */
  review: Review | null;
}

export interface StartInput {
  sessionId: string;
  provider: Provider;
  channel: Channel;
  scheduledAt: string | null;
  topic: string;
  patientLabel: string;
  checkin: SymptomCheckin;
  brief: PatientBrief;
  scopes: ConsentScope[];
  consentVersion: string;
}
