import { CURRENT_MEMBER_ID } from '../cloud/identity';
import type { Attachment } from '../lib/onboarding';
import { CONSULT_CHANGED_EVENT, type ConsultBackend } from './backend';
import { MAX_STAFF_PER_PROVIDER, PHONE_PATTERN, digitsOnly } from './format';
import { deleteLocalFile, getLocalFile, newUuid } from './files';
import type {
  AccessLogEntry,
  Category,
  ConsultConsent,
  ConsultMessage,
  ConsultNote,
  ConsultSession,
  FollowUp,
  PatientBrief,
  Provider,
  Review,
  StaffRecord,
  SessionBundle,
  SymptomCheckin,
} from './types';

/**
 * โหมดทดสอบ: เก็บใน localStorage ของเครื่องนี้ ไม่มีการส่งข้อมูลไปหาใคร
 * ผู้ให้บริการเป็นตัวอย่างล้วน ไม่มีคะแนนรีวิว และไม่มีการตอบกลับอัตโนมัติ
 * ทดสอบฝั่งเภสัชกรได้จากหน้า /pharmacist ในเบราว์เซอร์เดียวกัน
 * กติกาสิทธิ์ (ความยินยอม สถานะ การล็อกบันทึก) ทำแบบเดียวกับฐานข้อมูลจริง
 */
const KEY = `growa_consult_mock_v1_${CURRENT_MEMBER_ID}`;
const ONLINE_KEY = `${KEY}_online`;

/** ผู้ใช้เจ้าหน้าที่ในโหมดทดสอบ (มีคนเดียว) */
export const MOCK_STAFF_ID = 'mock-staff';
const MOCK_STAFF_NAME = 'คุณ (ทดสอบ)';

export const BASE_CATEGORIES: Category[] = [
  { id: 'pharmacist', label: 'เภสัชกร' },
  { id: 'clinic', label: 'คลินิก' },
];

const SAMPLE_BASE = {
  photoUrl: '',
  licenseNo: 'ตัวอย่าง',
  about: 'ข้อมูลตัวอย่างสำหรับทดสอบระบบ ไม่ใช่ผู้ให้บริการจริง',
  address: '',
  province: '',
  mapUrl: '',
  phone: '',
  lineId: '',
  contactEmail: '',
  website: '',
  status: 'open' as const,
  statusNote: '',
  rating: null,
  reviewCount: 0,
  isSample: true,
};

export const SAMPLE_PROVIDERS: Provider[] = [
  {
    ...SAMPLE_BASE,
    id: 'sample-pharmacist-1',
    kind: 'pharmacist',
    kindLabel: 'เภสัชกร',
    displayName: 'เภสัชกรตัวอย่าง ก',
    specialties: ['ตัวอย่าง: ยาโรคเรื้อรัง', 'ตัวอย่าง: การจัดยาผู้สูงอายุ'],
    orgName: 'ร้านยาตัวอย่าง (โหมดทดสอบ)',
    hours: 'ตัวอย่าง: ทุกวัน 09:00-20:00',
    channels: ['chat', 'voice', 'video', 'appointment'],
    online: true,
  },
  {
    ...SAMPLE_BASE,
    id: 'sample-pharmacist-2',
    kind: 'pharmacist',
    kindLabel: 'เภสัชกร',
    displayName: 'เภสัชกรตัวอย่าง ข',
    specialties: ['ตัวอย่าง: ปรึกษาการใช้ยาทั่วไป'],
    orgName: 'ร้านยาตัวอย่าง (โหมดทดสอบ)',
    hours: 'ตัวอย่าง: จันทร์-ศุกร์ 10:00-18:00',
    channels: ['chat', 'appointment'],
    online: false,
  },
  {
    ...SAMPLE_BASE,
    id: 'sample-clinic-1',
    kind: 'clinic',
    kindLabel: 'คลินิก',
    displayName: 'คลินิกตัวอย่าง',
    specialties: ['ตัวอย่าง: เวชศาสตร์ครอบครัว'],
    orgName: 'คลินิกตัวอย่าง (โหมดทดสอบ)',
    hours: 'ตัวอย่าง: ทุกวัน 08:00-17:00',
    channels: ['chat', 'video', 'appointment'],
    online: true,
  },
];

interface Db {
  sessions: ConsultSession[];
  checkins: Record<string, SymptomCheckin>;
  consents: Record<string, ConsultConsent>;
  briefs: Record<string, PatientBrief>;
  messages: ConsultMessage[];
  notes: Record<string, ConsultNote>;
  followUps: FollowUp[];
  log: AccessLogEntry[];
  customProviders: Provider[];
  /** ผู้ให้บริการตัวอย่างที่แอดมินลบแล้ว */
  deletedProviderIds: string[];
  staff: StaffRecord[];
  customCategories: Category[];
  reviews: (Review & { sessionId: string; providerId: string })[];
}

const emptyDb = (): Db => ({ sessions: [], checkins: {}, consents: {}, briefs: {}, messages: [], notes: {}, followUps: [], log: [], customProviders: [], deletedProviderIds: [], staff: [], customCategories: [], reviews: [] });

function read(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyDb(), ...(JSON.parse(raw) as Db) } : emptyDb();
  } catch {
    return emptyDb();
  }
}

function write(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    throw new Error('พื้นที่เก็บข้อมูลในเครื่องเต็ม');
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSULT_CHANGED_EVENT));
}

const addLog = (db: Db, sessionId: string, action: string) =>
  db.log.push({ id: newUuid(), sessionId, action, at: new Date().toISOString() });

function allProviders(): Provider[] {
  let online: Record<string, boolean> = {};
  try {
    online = JSON.parse(localStorage.getItem(ONLINE_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    online = {};
  }
  const { customProviders: custom, deletedProviderIds, customCategories, reviews } = read();
  const labels = new Map([...BASE_CATEGORIES, ...customCategories].map((c) => [c.id, c.label]));
  const merged = [...SAMPLE_PROVIDERS.filter((p) => !custom.some((c) => c.id === p.id)), ...custom].filter((p) => !deletedProviderIds.includes(p.id));
  // ร้านที่ปิดหรือถูกแบนไม่นับว่าออนไลน์ คะแนนคำนวณจากรีวิวจริงเท่านั้น (เหมือนฐานข้อมูลจริง)
  return merged.map((p) => {
    const mine = reviews.filter((r) => r.providerId === p.id);
    return {
      ...p,
      kindLabel: labels.get(p.kind) ?? 'ผู้ให้บริการ',
      online: p.status === 'open' && (p.id in online ? online[p.id] : p.online),
      rating: mine.length ? Math.round((mine.reduce((sum, r) => sum + r.stars, 0) / mine.length) * 10) / 10 : null,
      reviewCount: mine.length,
    };
  });
}

const providers = () => allProviders().filter((p) => p.status === 'open');

/** จำลองเพื่อนร่วมงานรับเคสไปก่อน ใช้ทดสอบกรณีรับเคสชนกัน (โหมดจริงทำที่ฐานข้อมูล) */
export function simulateColleagueClaim(sessionId: string, name = 'เพื่อนร่วมงาน'): void {
  const db = read();
  const s = db.sessions.find((x) => x.id === sessionId);
  if (!s) return;
  s.status = 'active';
  s.startedAt = s.startedAt ?? new Date().toISOString();
  s.assignedTo = 'mock-colleague';
  s.assignedName = name;
  write(db);
}

export function createMockBackend(): ConsultBackend {
  const need = (db: Db, id: string): ConsultSession => {
    const s = db.sessions.find((x) => x.id === id);
    if (!s) throw new Error('forbidden');
    return s;
  };

  const bundle = (db: Db, s: ConsultSession): SessionBundle => {
    const note = db.notes[s.id] ?? null;
    return {
      session: s,
      provider: allProviders().find((p) => p.id === s.providerId) ?? null,
      checkin: db.checkins[s.id] ?? null,
      consent: db.consents[s.id] ?? null,
      // เหมือนฐานข้อมูลจริง: ผู้ใช้เห็นบันทึกเมื่อเภสัชกรยืนยันแล้วเท่านั้น
      note: note?.confirmedAt ? note : null,
      followUps: db.followUps.filter((f) => f.sessionId === s.id),
      review: ((r) => (r ? { id: r.id, stars: r.stars, comment: r.comment, createdAt: r.createdAt } : null))(db.reviews.find((x) => x.sessionId === s.id)),
    };
  };

  return {
    mode: 'mock',
    getStaffContext: async () => ({ userId: MOCK_STAFF_ID, role: 'pharmacist', providerId: null }),
    listProviders: async () => providers(),
    getProvider: async (id) => allProviders().find((p) => p.id === id) ?? null,
    listCategories: async () => [...BASE_CATEGORIES, ...read().customCategories],
    async listReviews(providerId) {
      return read()
        .reviews.filter((r) => r.providerId === providerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({ id: r.id, stars: r.stars, comment: r.comment, createdAt: r.createdAt }));
    },
    async submitReview(sessionId, stars, comment) {
      const db = read();
      const s = need(db, sessionId);
      if (s.status !== 'completed') throw new Error('review_not_allowed');
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('invalid_rating');
      const text = comment.trim().slice(0, 500);
      const now = new Date().toISOString();
      const existing = db.reviews.find((r) => r.sessionId === sessionId);
      if (existing) Object.assign(existing, { stars, comment: text });
      else db.reviews.push({ id: newUuid(), sessionId, providerId: s.providerId, stars, comment: text, createdAt: now });
      write(db);
    },

    async startConsultation(input) {
      const db = read();
      const existing = db.sessions.find((s) => s.id === input.sessionId);
      if (existing) return existing;
      if (!input.scopes.includes('symptoms')) throw new Error('consent_required');
      const now = new Date().toISOString();
      const session: ConsultSession = {
        id: input.sessionId,
        patientId: CURRENT_MEMBER_ID,
        patientLabel: input.patientLabel,
        providerId: input.provider.id,
        channel: input.channel,
        status: 'requested',
        topic: input.topic,
        scheduledAt: input.scheduledAt,
        createdAt: now,
        startedAt: null,
        endedAt: null,
        assignedTo: null,
        assignedName: '',
      };
      db.sessions.push(session);
      db.checkins[session.id] = input.checkin;
      db.briefs[session.id] = input.brief;
      db.consents[session.id] = {
        id: newUuid(),
        sessionId: session.id,
        providerId: input.provider.id,
        scopes: input.scopes,
        version: input.consentVersion,
        grantedAt: now,
        revokedAt: null,
      };
      addLog(db, session.id, 'consent_granted');
      write(db);
      return session;
    },

    async listMyBundles() {
      const db = read();
      return [...db.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => bundle(db, s));
    },
    async getBundle(id) {
      const db = read();
      const s = db.sessions.find((x) => x.id === id);
      return s ? bundle(db, s) : null;
    },
    getMyBrief: async (id) => read().briefs[id] ?? null,

    async cancelSession(id) {
      const db = read();
      const s = need(db, id);
      if (s.status !== 'requested' && s.status !== 'active') throw new Error('invalid_transition');
      s.status = 'cancelled';
      s.endedAt = new Date().toISOString();
      write(db);
    },
    async setSchedule(id, iso) {
      const db = read();
      const s = need(db, id);
      if (s.status !== 'requested' && s.status !== 'active') throw new Error('invalid_transition');
      s.scheduledAt = iso;
      write(db);
    },
    async revokeConsent(id) {
      const db = read();
      const consent = db.consents[id];
      if (!consent || consent.revokedAt) throw new Error('forbidden');
      consent.revokedAt = new Date().toISOString();
      addLog(db, id, 'consent_revoked');
      write(db);
    },
    async deleteSession(id) {
      const db = read();
      const s = need(db, id);
      if (s.status === 'requested' || s.status === 'active') throw new Error('session_open');
      const files = [
        ...(db.checkins[id]?.attachments ?? []),
        ...db.messages.filter((m) => m.sessionId === id).flatMap((m) => m.attachments),
      ];
      await Promise.all(files.map((a) => deleteLocalFile(a.id)));
      db.sessions = db.sessions.filter((x) => x.id !== id);
      db.messages = db.messages.filter((m) => m.sessionId !== id);
      db.followUps = db.followUps.filter((f) => f.sessionId !== id);
      db.reviews = db.reviews.filter((r) => r.sessionId !== id);
      db.log = db.log.filter((l) => l.sessionId !== id);
      delete db.checkins[id];
      delete db.consents[id];
      delete db.briefs[id];
      delete db.notes[id];
      write(db);
    },
    listAccessLog: async (id) =>
      read()
        .log.filter((l) => l.sessionId === id)
        .sort((a, b) => b.at.localeCompare(a.at)),

    listMessages: async (id) => read().messages.filter((m) => m.sessionId === id),
    async sendMessage(sessionId, body, attachments, as) {
      const db = read();
      const s = need(db, sessionId);
      if (s.status !== 'requested' && s.status !== 'active') throw new Error('invalid_transition');
      // เหมือนฐานข้อมูลจริง: เจ้าหน้าที่ตอบได้เฉพาะเคสที่ตัวเองรับไว้
      if (as === 'staff' && s.assignedTo !== MOCK_STAFF_ID) throw new Error('forbidden');
      const message: ConsultMessage = {
        id: newUuid(),
        sessionId,
        senderId: as === 'patient' ? CURRENT_MEMBER_ID : 'sample-staff',
        senderRole: as,
        body: body.slice(0, 4000),
        attachments,
        createdAt: new Date().toISOString(),
      };
      db.messages.push(message);
      write(db);
      return message;
    },
    subscribe(_sessionId, onChange) {
      // สองแท็บ (ผู้ใช้/เภสัชกร) คุยกันผ่าน storage event
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) onChange();
      };
      window.addEventListener(CONSULT_CHANGED_EVENT, onChange);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(CONSULT_CHANGED_EVENT, onChange);
        window.removeEventListener('storage', onStorage);
      };
    },

    // โหมดทดสอบ: ไฟล์อยู่ในเครื่องอยู่แล้ว ไม่มีการอัปโหลด
    uploadFile: async () => undefined,
    async downloadFile(_sessionId, attachment: Attachment) {
      const blob = await getLocalFile(attachment.id);
      if (!blob) throw new Error('forbidden');
      return blob;
    },

    async respondFollowUp(id, response) {
      const db = read();
      const f = db.followUps.find((x) => x.id === id);
      if (!f || f.status !== 'pending') throw new Error('forbidden');
      f.response = response;
      f.status = 'responded';
      f.respondedAt = new Date().toISOString();
      write(db);
    },

    listQueue: async () => read().sessions,
    async listQueueInfo(ids) {
      const db = read();
      const lastSender: Record<string, 'patient' | 'staff'> = {};
      for (const m of db.messages) if (ids.includes(m.sessionId)) lastSender[m.sessionId] = m.senderRole;
      return { followUps: db.followUps.filter((f) => f.status === 'responded'), lastSender };
    },
    async getStaffSession(id) {
      const db = read();
      const session = db.sessions.find((s) => s.id === id);
      if (!session) return null;
      const consent = db.consents[id];
      return {
        session,
        consentActive: !!consent && !consent.revokedAt,
        followUps: db.followUps.filter((f) => f.sessionId === id),
      };
    },
    async openBrief(id) {
      const db = read();
      const handled = need(db, id);
      if (handled.assignedTo !== MOCK_STAFF_ID && !(handled.assignedTo === null && (handled.status === 'completed' || handled.status === 'cancelled'))) throw new Error('forbidden');
      const consent = db.consents[id];
      if (!consent || consent.revokedAt) throw new Error('consent_revoked');
      const brief = db.briefs[id];
      addLog(db, id, 'brief_opened');
      write(db);
      return brief;
    },
    async acceptSession(id) {
      const db = read();
      const s = need(db, id);
      if (s.status === 'active' && s.assignedTo === MOCK_STAFF_ID) return;
      if (s.status === 'active' && s.assignedTo !== null) throw new Error('already_claimed');
      if (s.status !== 'requested' && s.status !== 'active') throw new Error('invalid_transition');
      s.status = 'active';
      s.startedAt = s.startedAt ?? new Date().toISOString();
      s.assignedTo = MOCK_STAFF_ID;
      s.assignedName = MOCK_STAFF_NAME;
      addLog(db, id, 'claimed');
      write(db);
    },
    async releaseSession(id) {
      const db = read();
      const s = need(db, id);
      if (s.assignedTo !== MOCK_STAFF_ID) throw new Error('forbidden');
      if (s.status !== 'active') throw new Error('invalid_transition');
      s.status = 'requested';
      s.startedAt = null;
      s.assignedTo = null;
      s.assignedName = '';
      addLog(db, id, 'released');
      write(db);
    },
    async takeOverSession(id) {
      const db = read();
      const s = need(db, id);
      if (s.status !== 'active') throw new Error('invalid_transition');
      if (s.assignedTo === MOCK_STAFF_ID) return;
      s.assignedTo = MOCK_STAFF_ID;
      s.assignedName = MOCK_STAFF_NAME;
      addLog(db, id, 'taken_over');
      write(db);
    },
    async declineSession(id) {
      const db = read();
      const s = need(db, id);
      if (s.status !== 'requested' && s.status !== 'active') throw new Error('invalid_transition');
      if (s.assignedTo !== null && s.assignedTo !== MOCK_STAFF_ID) throw new Error('already_claimed');
      s.status = 'cancelled';
      s.endedAt = new Date().toISOString();
      write(db);
    },
    getNote: async (id) => read().notes[id] ?? null,
    async saveNote(id, fields) {
      const db = read();
      if (need(db, id).assignedTo !== MOCK_STAFF_ID) throw new Error('forbidden');
      if (db.notes[id]?.confirmedAt) throw new Error('forbidden');
      const note: ConsultNote = { ...fields, sessionId: id, confirmedAt: null, updatedAt: new Date().toISOString() };
      db.notes[id] = note;
      write(db);
      return note;
    },
    async confirmNote(id) {
      const db = read();
      const s = need(db, id);
      if (s.assignedTo !== MOCK_STAFF_ID) throw new Error('forbidden');
      if (s.status !== 'active') throw new Error('invalid_transition');
      const note = db.notes[id];
      if (!note || !(note.assessment.trim() || note.recommendation.trim() || note.medicationAdvice.trim())) {
        throw new Error('note_required');
      }
      const now = new Date().toISOString();
      note.confirmedAt = now;
      s.status = 'completed';
      s.endedAt = now;
      if (note.followUpDue) {
        db.followUps.push({
          id: newUuid(),
          sessionId: id,
          providerId: s.providerId,
          dueDate: note.followUpDue,
          plan: note.followUpPlan,
          status: 'pending',
          response: null,
          respondedAt: null,
          reviewedAt: null,
        });
      }
      write(db);
    },
    async reviewFollowUp(id) {
      const db = read();
      const f = db.followUps.find((x) => x.id === id);
      if (!f || f.status !== 'responded') throw new Error('forbidden');
      f.status = 'reviewed';
      f.reviewedAt = new Date().toISOString();
      write(db);
    },
    async setOnline(online) {
      const current = JSON.parse(localStorage.getItem(ONLINE_KEY) ?? '{}') as Record<string, boolean>;
      localStorage.setItem(ONLINE_KEY, JSON.stringify({ ...current, [SAMPLE_PROVIDERS[0].id]: online }));
      window.dispatchEvent(new Event(CONSULT_CHANGED_EVENT));
    },
    getMyProvider: async () => providers()[0] ?? null,

    getAdminAccess: async () => true,
    async addCategory(label) {
      const clean = label.trim();
      if (clean.length < 2 || clean.length > 40) throw new Error('invalid_category');
      const db = read();
      const all = [...BASE_CATEGORIES, ...db.customCategories];
      const found = all.find((c) => c.label.trim().toLowerCase() === clean.toLowerCase());
      if (found) return found.id;
      const id = `c${newUuid().replace(/-/g, '').slice(0, 10)}`;
      db.customCategories.push({ id, label: clean });
      write(db);
      return id;
    },
    async deleteReview(id) {
      const db = read();
      if (!db.reviews.some((r) => r.id === id)) throw new Error('forbidden');
      db.reviews = db.reviews.filter((r) => r.id !== id);
      write(db);
    },
    listAllProviders: async () => allProviders(),
    async saveProvider(input) {
      const db = read();
      const id = input.id ?? newUuid();
      const existing = allProviders().find((p) => p.id === id);
      const next: Provider = {
        rating: null,
        reviewCount: 0,
        online: false,
        status: 'open',
        statusNote: '',
        kindLabel: '',
        ...existing,
        ...input,
        id,
        isSample: true,
      };
      db.customProviders = [...db.customProviders.filter((p) => p.id !== id), next];
      db.deletedProviderIds = db.deletedProviderIds.filter((x) => x !== id);
      write(db);
      return id;
    },
    async setProviderStatus(id, status, note) {
      const db = read();
      const provider = allProviders().find((p) => p.id === id);
      if (!provider) throw new Error('provider_unavailable');
      db.customProviders = [
        ...db.customProviders.filter((p) => p.id !== id),
        { ...provider, status, statusNote: status === 'open' ? '' : note.slice(0, 300), online: status === 'open' ? provider.online : false },
      ];
      let cancelled = 0;
      if (status === 'banned') {
        const now = new Date().toISOString();
        for (const s of db.sessions) {
          if (s.providerId === id && (s.status === 'requested' || s.status === 'active')) {
            s.status = 'cancelled';
            s.endedAt = now;
            addLog(db, s.id, 'cancelled_by_admin');
            cancelled += 1;
          }
        }
      }
      write(db);
      return cancelled;
    },
    async deleteProvider(id) {
      const db = read();
      if (!allProviders().some((p) => p.id === id)) throw new Error('provider_unavailable');
      if (db.sessions.some((s) => s.providerId === id)) throw new Error('provider_has_history');
      db.staff = db.staff.filter((s) => s.providerId !== id);
      db.customProviders = db.customProviders.filter((p) => p.id !== id);
      if (SAMPLE_PROVIDERS.some((p) => p.id === id) && !db.deletedProviderIds.includes(id)) db.deletedProviderIds.push(id);
      write(db);
    },
    listStaff: async () => read().staff,
    async assignStaff(email, providerId, phone) {
      const db = read();
      const provider = allProviders().find((p) => p.id === providerId);
      if (!provider) throw new Error('provider_unavailable');
      const clean = digitsOnly(phone);
      if (clean && !PHONE_PATTERN.test(clean)) throw new Error('invalid_phone');
      const key = email.trim().toLowerCase();
      const existing = db.staff.find((s) => s.email === key);
      if (existing && existing.providerId !== providerId) throw new Error('staff_other_provider');
      if (!existing && db.staff.filter((s) => s.providerId === providerId).length >= MAX_STAFF_PER_PROVIDER) throw new Error('staff_limit');
      if (existing) existing.phone = clean;
      else db.staff.push({ userId: `sample-${key}`, email: key, role: provider.kind, providerId, phone: clean });
      write(db);
    },
    async removeStaff(userId) {
      const db = read();
      db.staff = db.staff.filter((s) => s.userId !== userId);
      write(db);
    },
  };
}

