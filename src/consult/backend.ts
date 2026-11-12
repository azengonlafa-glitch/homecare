import type { Attachment } from '../lib/onboarding';
import { cloudEnabled } from '../cloud/client';
import type {
  AccessLogEntry,
  Category,
  ConsultMessage,
  ConsultNote,
  ConsultSession,
  FollowUp,
  FollowUpResponse,
  NoteFields,
  PatientBrief,
  Provider,
  ProviderInput,
  ProviderStatus,
  Review,
  StaffRecord,
  SessionBundle,
  StaffContext,
  StartInput,
} from './types';

/**
 * ชั้นเชื่อมต่อระบบปรึกษา หน้าจอเรียกผ่าน interface นี้เท่านั้น
 * - mock: เก็บในเครื่องนี้ ไม่มีใครได้รับข้อมูล ทุกหน้าแสดงป้ายโหมดทดสอบ
 * - live: ใช้ Supabase ต้องรัน supabase/consult_schema.sql และตั้ง VITE_CONSULT_BACKEND=supabase
 */
export type ConsultMode = 'mock' | 'live';

export const CONSULT_MODE: ConsultMode =
  cloudEnabled && import.meta.env.VITE_CONSULT_BACKEND === 'supabase' ? 'live' : 'mock';

export const CONSULT_CHANGED_EVENT = 'growa-consult-changed';

export interface QueueInfo {
  followUps: FollowUp[];
  lastSender: Record<string, 'patient' | 'staff'>;
}

export interface ConsultBackend {
  readonly mode: ConsultMode;
  getStaffContext(): Promise<StaffContext | null>;
  listProviders(): Promise<Provider[]>;
  getProvider(id: string): Promise<Provider | null>;
  listCategories(): Promise<Category[]>;
  /** รีวิวของร้านแบบไม่ระบุตัวตน ใหม่สุดก่อน */
  listReviews(providerId: string): Promise<Review[]>;
  /** ให้คะแนนหลังการปรึกษาเสร็จ ให้ซ้ำคือแก้รีวิวเดิม */
  submitReview(sessionId: string, stars: number, comment: string): Promise<void>;

  startConsultation(input: StartInput): Promise<ConsultSession>;
  listMyBundles(): Promise<SessionBundle[]>;
  getBundle(sessionId: string): Promise<SessionBundle | null>;
  getMyBrief(sessionId: string): Promise<PatientBrief | null>;
  cancelSession(sessionId: string): Promise<void>;
  /** ตั้งหรือเปลี่ยนเวลานัด ทำได้ทั้งสองฝ่ายระหว่างที่การปรึกษายังเปิดอยู่ */
  setSchedule(sessionId: string, iso: string): Promise<void>;
  revokeConsent(sessionId: string): Promise<void>;
  listAccessLog(sessionId: string): Promise<AccessLogEntry[]>;
  /** ลบข้อมูลการปรึกษาที่ปิดแล้วทั้งหมดรวมไฟล์แนบ ย้อนกลับไม่ได้ */
  deleteSession(sessionId: string): Promise<void>;

  listMessages(sessionId: string): Promise<ConsultMessage[]>;
  /** as ใช้เฉพาะโหมดทดสอบ โหมดจริงระบบคำนวณบทบาทจากบัญชีเอง */
  sendMessage(sessionId: string, body: string, attachments: Attachment[], as: 'patient' | 'staff'): Promise<ConsultMessage>;
  /** แจ้งเมื่อการปรึกษานี้มีความเปลี่ยนแปลง คืนฟังก์ชันยกเลิก */
  subscribe(sessionId: string | null, onChange: () => void): () => void;

  uploadFile(sessionId: string, attachment: Attachment, blob: Blob): Promise<void>;
  downloadFile(sessionId: string, attachment: Attachment): Promise<Blob>;

  respondFollowUp(id: string, response: FollowUpResponse): Promise<void>;

  // ฝั่งผู้ให้บริการ
  listQueue(): Promise<ConsultSession[]>;
  /** ข้อมูลเสริมของคิว: ผลติดตามที่รอตรวจ และใครส่งข้อความล่าสุด */
  listQueueInfo(activeSessionIds: string[]): Promise<QueueInfo>;
  getStaffSession(sessionId: string): Promise<{ session: ConsultSession; consentActive: boolean; followUps: FollowUp[] } | null>;
  openBrief(sessionId: string): Promise<PatientBrief>;
  /** รับเรื่อง = จองเคส คนแรกที่กดได้ คนอื่นได้ already_claimed */
  acceptSession(sessionId: string): Promise<void>;
  /** คืนเคสเข้าคิวให้เพื่อนร่วมงานรับต่อ */
  releaseSession(sessionId: string): Promise<void>;
  /** รับช่วงต่อเคสของเพื่อนร่วมงานที่กำลังดูแลอยู่ */
  takeOverSession(sessionId: string): Promise<void>;
  declineSession(sessionId: string): Promise<void>;
  getNote(sessionId: string): Promise<ConsultNote | null>;
  saveNote(sessionId: string, fields: NoteFields): Promise<ConsultNote>;
  confirmNote(sessionId: string): Promise<void>;
  reviewFollowUp(id: string): Promise<void>;
  setOnline(online: boolean): Promise<void>;
  getMyProvider(): Promise<Provider | null>;

  // ฝั่งแอดมิน
  getAdminAccess(): Promise<boolean>;
  listAllProviders(): Promise<Provider[]>;
  /** เพิ่มหมวดหมู่ผู้ให้บริการใหม่ คืนรหัส ชื่อซ้ำคืนรหัสเดิม */
  addCategory(label: string): Promise<string>;
  deleteReview(id: string): Promise<void>;
  /** คืนรหัสผู้ให้บริการ (ใช้ไปหน้ารายละเอียดหลังเพิ่มใหม่) */
  saveProvider(input: ProviderInput): Promise<string>;
  /** คืนจำนวนการปรึกษาที่ถูกยกเลิก (แบนยกเลิกที่ค้างอยู่ทั้งหมด ปิดชั่วคราวไม่ยกเลิก) */
  setProviderStatus(id: string, status: ProviderStatus, note: string): Promise<number>;
  /** ลบได้เมื่อไม่มีประวัติการปรึกษา ไม่งั้นต้องแบนแทน */
  deleteProvider(id: string): Promise<void>;
  listStaff(): Promise<StaffRecord[]>;
  /** ผูกบัญชีด้วยอีเมลพร้อมเบอร์ ผูกซ้ำเพื่อแก้เบอร์ ร้านละไม่เกิน 5 คน */
  assignStaff(email: string, providerId: string, phone: string): Promise<void>;
  removeStaff(userId: string): Promise<void>;
}

const ERROR_TEXT: Record<string, string> = {
  not_authenticated: 'กรุณาเข้าสู่ระบบอีกครั้ง',
  forbidden: 'คุณไม่มีสิทธิ์ทำรายการนี้',
  provider_unavailable: 'ร้านยาหรือคลินิกนี้ไม่พร้อมให้บริการแล้ว กรุณาเลือกใหม่',
  channel_unavailable: 'ร้านยาหรือคลินิกนี้ไม่มีช่องทางที่เลือก กรุณาเลือกใหม่',
  consent_required: 'ต้องอนุญาตให้เปิดเผยข้อมูลอาการก่อนเริ่มปรึกษา',
  consent_revoked: 'ผู้ใช้ถอนความยินยอมแล้ว จึงเปิดข้อมูลสุขภาพไม่ได้',
  schedule_required: 'กรุณาเลือกวันและเวลานัด',
  invalid_transition: 'สถานะของการปรึกษาเปลี่ยนไปแล้ว กรุณาโหลดใหม่',
  note_required: 'กรุณากรอกผลการประเมินหรือคำแนะนำก่อนยืนยัน',
  session_open: 'ต้องยกเลิกหรือรอให้การปรึกษาเสร็จก่อนจึงจะลบได้',
  files_remaining: 'ลบไฟล์แนบไม่ครบ กรุณาลองใหม่',
  user_not_found: 'ไม่พบบัญชีที่ใช้อีเมลนี้ ให้เจ้าของอีเมลสมัครใช้งานก่อน',
  target_is_admin: 'บัญชีนี้เป็นแอดมินอยู่แล้ว ผูกเป็นเจ้าหน้าที่ไม่ได้',
  staff_limit: 'ร้านนี้มีทีมงานครบ 5 คนแล้ว ถอดคนเดิมออกก่อนจึงเพิ่มได้',
  staff_other_provider: 'บัญชีนี้ผูกกับร้านอื่นอยู่ ต้องถอดออกจากร้านนั้นก่อน',
  invalid_phone: 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0',
  invalid_status: 'สถานะไม่ถูกต้อง',
  already_claimed: 'เพื่อนร่วมงานรับเคสนี้ไปแล้ว',
  review_not_allowed: 'รีวิวได้หลังการปรึกษาเสร็จสิ้นเท่านั้น',
  invalid_rating: 'กรุณาเลือกคะแนน 1-5 ดาว',
  invalid_category: 'ชื่อหมวดหมู่ต้องยาว 2-40 ตัวอักษร',
  category_limit: 'มีหมวดหมู่ครบจำนวนสูงสุดแล้ว',
  provider_has_history: 'ลบไม่ได้เพราะมีประวัติการปรึกษาแล้ว ให้แบนหรือปิดชั่วคราวแทน',
  consult_providers_photo_check: 'รูปไม่ถูกต้องหรือใหญ่เกินไป กรุณาเลือกรูปใหม่',
  'violates check constraint': 'ข้อมูลบางช่องไม่ถูกต้อง กรุณาตรวจอีกครั้ง',
};

/** แปลงข้อผิดพลาดเป็นข้อความที่ผู้ใช้อ่านเข้าใจ */
export function consultErrorText(err: unknown): string {
  const message = err instanceof Error ? err.message : (err as { message?: string } | null)?.message ?? '';
  for (const [code, text] of Object.entries(ERROR_TEXT)) {
    if (message.includes(code)) return text;
  }
  if (/fetch|network|Failed to/i.test(message)) return 'เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่';
  return 'ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ ให้โหลดหน้านี้ใหม่หรือลองใหม่ภายหลัง';
}

let instance: Promise<ConsultBackend> | null = null;

export function getBackend(): Promise<ConsultBackend> {
  if (!instance) {
    instance =
      CONSULT_MODE === 'live'
        ? import('./liveBackend').then((m) => m.createLiveBackend())
        : import('./mockBackend').then((m) => m.createMockBackend());
  }
  return instance;
}
