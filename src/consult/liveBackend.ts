import { requireClient } from '../cloud/client';
import type { Attachment } from '../lib/onboarding';
import { CONSULT_CHANGED_EVENT, type ConsultBackend } from './backend';
import type {
  AccessLogEntry,
  Category,
  Channel,
  ConsentScope,
  ConsultConsent,
  ConsultMessage,
  ConsultNote,
  ConsultSession,
  FollowUp,
  FollowUpResponse,
  NoteFields,
  PatientBrief,
  Provider,
  ProviderInput,
  ProviderKind,
  ProviderStatus,
  Review,
  SessionBundle,
  SessionStatus,
  StaffRecord,
  StaffRole,
  SymptomCheckin,
} from './types';

/** เชื่อม Supabase สิทธิ์ทั้งหมดบังคับที่ฐานข้อมูล (supabase/consult_schema.sql) ไม่ใช่ที่โค้ดนี้ */

const BUCKET = 'consult-files';
const POLL_MS = 15_000;

type Row = Record<string, unknown>;

/** ยังอ่านฐานข้อมูลก่อนรัน consult_v3.sql ได้ (ค่า active เดิม → สถานะ) */
const providerStatus = (r: Row): ProviderStatus => {
  if (r.status === 'open' || r.status === 'paused' || r.status === 'banned') return r.status;
  return r.active === false ? 'paused' : 'open';
};

const toProvider = (r: Row, labels: Map<string, string>): Provider => ({
  id: r.id as string,
  kind: r.kind as ProviderKind,
  kindLabel: labels.get(r.kind as string) ?? 'ผู้ให้บริการ',
  displayName: r.display_name as string,
  photoUrl: (r.photo_url as string) ?? '',
  specialties: (r.specialties as string[]) ?? [],
  orgName: r.org_name as string,
  licenseNo: (r.license_no as string) ?? '',
  about: (r.about as string) ?? '',
  address: (r.address as string) ?? '',
  province: (r.province as string) ?? '',
  mapUrl: (r.map_url as string) ?? '',
  phone: (r.phone as string) ?? '',
  lineId: (r.line_id as string) ?? '',
  contactEmail: (r.contact_email as string) ?? '',
  website: (r.website as string) ?? '',
  hours: (r.hours as string) ?? '',
  channels: (r.channels as Channel[]) ?? [],
  online: !!r.is_online,
  status: providerStatus(r),
  statusNote: (r.status_note as string) ?? '',
  rating: r.rating === null || r.rating === undefined ? null : Number(r.rating),
  reviewCount: Number(r.review_count ?? 0),
  isSample: false,
});

const toSession = (r: Row): ConsultSession => ({
  id: r.id as string,
  patientId: r.patient_id as string,
  patientLabel: r.patient_label as string,
  providerId: r.provider_id as string,
  channel: r.channel as Channel,
  status: r.status as SessionStatus,
  topic: r.topic as string,
  scheduledAt: (r.scheduled_at as string) ?? null,
  createdAt: r.created_at as string,
  startedAt: (r.started_at as string) ?? null,
  endedAt: (r.ended_at as string) ?? null,
  assignedTo: (r.assigned_to as string) ?? null,
  assignedName: (r.assigned_name as string) ?? '',
});

const toReview = (r: Row): Review => ({
  id: r.id as string,
  stars: Number(r.stars),
  comment: (r.comment as string) ?? '',
  createdAt: r.created_at as string,
});

const toConsent = (r: Row): ConsultConsent => ({
  id: r.id as string,
  sessionId: r.session_id as string,
  providerId: r.provider_id as string,
  scopes: r.scopes as ConsentScope[],
  version: r.version as string,
  grantedAt: r.granted_at as string,
  revokedAt: (r.revoked_at as string) ?? null,
});

const toMessage = (r: Row): ConsultMessage => ({
  id: r.id as string,
  sessionId: r.session_id as string,
  senderId: r.sender_id as string,
  senderRole: r.sender_role as 'patient' | 'staff',
  body: r.body as string,
  attachments: (r.attachments as Attachment[]) ?? [],
  createdAt: r.created_at as string,
});

const toNote = (r: Row): ConsultNote => ({
  sessionId: r.session_id as string,
  assessment: r.assessment as string,
  medicationAdvice: r.medication_advice as string,
  recommendation: r.recommendation as string,
  referral: r.referral as string,
  followUpPlan: r.follow_up_plan as string,
  followUpDue: (r.follow_up_due as string) ?? '',
  confirmedAt: (r.confirmed_at as string) ?? null,
  updatedAt: r.updated_at as string,
});

const toFollowUp = (r: Row): FollowUp => ({
  id: r.id as string,
  sessionId: r.session_id as string,
  providerId: r.provider_id as string,
  dueDate: r.due_date as string,
  plan: r.plan as string,
  status: r.status as FollowUp['status'],
  response: (r.response as FollowUpResponse) ?? null,
  respondedAt: (r.responded_at as string) ?? null,
  reviewedAt: (r.reviewed_at as string) ?? null,
});

const toCheckin = (r: Row): SymptomCheckin => ({
  ...(r.data as SymptomCheckin),
  id: r.id as string,
  createdAt: r.created_at as string,
});

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

async function currentUserId(): Promise<string> {
  const { data } = await requireClient().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

export function createLiveBackend(): ConsultBackend {
  const sb = requireClient();

  /** ก่อนรัน consult_v4.sql ยังไม่มีตารางหมวดหมู่ ใช้ชื่อหมวดเดิมแทน */
  const categories = async (): Promise<Category[]> => {
    const { data, error } = await sb.from('consult_categories').select('id, label').order('sort').order('label');
    if (error || !data?.length) {
      return [
        { id: 'pharmacist', label: 'เภสัชกร' },
        { id: 'clinic', label: 'คลินิก' },
      ];
    }
    return (data as Row[]).map((r) => ({ id: r.id as string, label: r.label as string }));
  };
  const labelMap = async () => new Map((await categories()).map((c) => [c.id, c.label]));

  const providersById = async (ids: string[]): Promise<Map<string, Provider>> => {
    if (!ids.length) return new Map();
    const [rows, labels] = await Promise.all([sb.from('consult_providers').select('*').in('id', [...new Set(ids)]), labelMap()]);
    return new Map((check(rows) as Row[]).map((r) => [r.id as string, toProvider(r, labels)]));
  };

  const bundlesFor = async (sessions: ConsultSession[]): Promise<SessionBundle[]> => {
    if (!sessions.length) return [];
    const ids = sessions.map((s) => s.id);
    const [checkins, consents, notes, followUps, reviews, providers] = await Promise.all([
      sb.from('consult_checkins').select('*').in('session_id', ids),
      sb.from('consult_consents').select('*').in('session_id', ids),
      sb.from('consult_notes').select('*').in('session_id', ids),
      sb.from('consult_followups').select('*').in('session_id', ids),
      sb.from('consult_reviews').select('*').in('session_id', ids),
      providersById(sessions.map((s) => s.providerId)),
    ]);
    const cRows = check(checkins) as Row[];
    const consentRows = check(consents) as Row[];
    const noteRows = check(notes) as Row[];
    const fuRows = check(followUps) as Row[];
    // ก่อนรัน consult_v4.sql ยังไม่มีตารางรีวิว: ถือว่ายังไม่มีรีวิว
    const reviewRows = reviews.error ? [] : ((reviews.data ?? []) as Row[]);
    return sessions.map((session) => {
      const checkin = cRows.find((r) => r.session_id === session.id);
      const consent = consentRows.find((r) => r.session_id === session.id);
      const note = noteRows.find((r) => r.session_id === session.id);
      return {
        session,
        provider: providers.get(session.providerId) ?? null,
        checkin: checkin ? toCheckin(checkin) : null,
        consent: consent ? toConsent(consent) : null,
        note: note ? toNote(note) : null,
        followUps: fuRows.filter((r) => r.session_id === session.id).map(toFollowUp),
        review: (() => {
          const row = reviewRows.find((r) => r.session_id === session.id);
          return row ? toReview(row) : null;
        })(),
      };
    });
  };

  return {
    mode: 'live',

    async getStaffContext() {
      const uid = await currentUserId();
      const row = check(await sb.from('consult_staff').select('role, provider_id').eq('user_id', uid).maybeSingle()) as Row | null;
      return row ? { userId: uid, role: row.role as StaffRole, providerId: (row.provider_id as string) ?? null } : null;
    },
    async listProviders() {
      const [res, labels] = await Promise.all([sb.from('consult_providers').select('*').order('display_name'), labelMap()]);
      const rows = check(res) as Row[];
      // ฐานข้อมูลยังคืนร้านที่เคยปรึกษาแม้ปิดแล้ว (เพื่อแสดงในประวัติ) หน้าเลือกผู้ให้บริการจึงกรองเฉพาะร้านที่เปิดเอง
      return rows.map((r) => toProvider(r, labels)).filter((p) => p.status === 'open');
    },
    async getProvider(id) {
      const [res, labels] = await Promise.all([sb.from('consult_providers').select('*').eq('id', id).maybeSingle(), labelMap()]);
      const row = check(res) as Row | null;
      return row ? toProvider(row, labels) : null;
    },
    listCategories: categories,
    async listReviews(providerId) {
      const { data, error } = await sb.rpc('list_provider_reviews', { p_provider: providerId, p_limit: 50 });
      if (error) {
        // ก่อนรัน consult_v4.sql ยังไม่มีฟังก์ชันนี้: ถือว่ายังไม่มีรีวิว
        if (/does not exist|schema cache|could not find/i.test(error.message)) return [];
        throw error;
      }
      return ((data ?? []) as Row[]).map(toReview);
    },
    async submitReview(sessionId, stars, comment) {
      const { error } = await sb.rpc('submit_consult_review', { p_session: sessionId, p_stars: stars, p_comment: comment });
      if (error) throw error;
    },

    async startConsultation(input) {
      const { error } = await sb.rpc('start_consultation', {
        p_session: input.sessionId,
        p_provider: input.provider.id,
        p_channel: input.channel,
        p_topic: input.topic,
        p_patient_label: input.patientLabel,
        p_urgency: 'routine',
        p_scheduled: input.scheduledAt,
        p_checkin: input.checkin,
        p_brief: input.brief,
        p_scopes: input.scopes,
        p_consent_version: input.consentVersion,
      });
      if (error) throw error;
      const row = check(await sb.from('consult_sessions').select('*').eq('id', input.sessionId).single()) as Row;
      return toSession(row);
    },

    async listMyBundles() {
      const uid = await currentUserId();
      const rows = check(
        await sb.from('consult_sessions').select('*').eq('patient_id', uid).order('created_at', { ascending: false })
      ) as Row[];
      return bundlesFor(rows.map(toSession));
    },
    async getBundle(id) {
      const row = check(await sb.from('consult_sessions').select('*').eq('id', id).maybeSingle()) as Row | null;
      if (!row) return null;
      const [bundle] = await bundlesFor([toSession(row)]);
      return bundle;
    },
    async getMyBrief(id) {
      const row = check(await sb.from('consult_briefs').select('snapshot').eq('session_id', id).maybeSingle()) as Row | null;
      return (row?.snapshot as PatientBrief) ?? null;
    },
    async cancelSession(id) {
      const { error } = await sb.rpc('set_consult_status', { p_session: id, p_status: 'cancelled' });
      if (error) throw error;
    },
    async setSchedule(id, iso) {
      const { error } = await sb.rpc('set_consult_schedule', { p_session: id, p_when: iso });
      if (error) throw error;
    },
    async revokeConsent(id) {
      const { error } = await sb.rpc('revoke_consult_consent', { p_session: id });
      if (error) throw error;
    },
    async deleteSession(id) {
      // ลบไฟล์ก่อน ฐานข้อมูลจะไม่ยอมลบถ้ายังมีไฟล์เหลือ
      for (;;) {
        const { data, error } = await sb.storage.from(BUCKET).list(id, { limit: 100 });
        if (error) throw error;
        if (!data?.length) break;
        const { error: removeError } = await sb.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`));
        if (removeError) throw removeError;
      }
      const { error } = await sb.rpc('delete_consult_session', { p_session: id });
      if (error) throw error;
    },
    async listAccessLog(id) {
      const rows = check(
        await sb.from('consult_access_log').select('id, session_id, action, at').eq('session_id', id).order('at', { ascending: false })
      ) as Row[];
      return rows.map((r): AccessLogEntry => ({ id: String(r.id), sessionId: r.session_id as string, action: r.action as string, at: r.at as string }));
    },

    async listMessages(id) {
      const rows = check(
        await sb.from('consult_messages').select('*').eq('session_id', id).order('created_at').limit(1000)
      ) as Row[];
      return rows.map(toMessage);
    },
    async sendMessage(sessionId, body, attachments) {
      const uid = await currentUserId();
      const row = check(
        await sb.from('consult_messages').insert({ session_id: sessionId, sender_id: uid, body, attachments }).select('*').single()
      ) as Row;
      return toMessage(row);
    },
    subscribe(sessionId, onChange) {
      const name = `consult-${sessionId ?? 'all'}-${Math.random().toString(36).slice(2)}`;
      let channel = sb.channel(name).on('postgres_changes', { event: '*', schema: 'public', table: 'consult_sessions' }, onChange);
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'consult_followups' }, onChange);
      channel = channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consult_messages', ...(sessionId ? { filter: `session_id=eq.${sessionId}` } : {}) },
        onChange
      );
      channel.subscribe();
      // สำรองกรณี realtime หลุด และรับการเปลี่ยนแปลงจากหน้าเดียวกัน
      const timer = window.setInterval(onChange, POLL_MS);
      window.addEventListener(CONSULT_CHANGED_EVENT, onChange);
      return () => {
        window.clearInterval(timer);
        window.removeEventListener(CONSULT_CHANGED_EVENT, onChange);
        void sb.removeChannel(channel);
      };
    },

    async uploadFile(sessionId, attachment, blob) {
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(`${sessionId}/${attachment.id}`, blob, { contentType: attachment.type, upsert: false });
      if (error && !/exists|duplicate/i.test(error.message)) throw error;
    },
    async downloadFile(sessionId, attachment) {
      const { data, error } = await sb.storage.from(BUCKET).download(`${sessionId}/${attachment.id}`);
      if (error || !data) throw error ?? new Error('forbidden');
      return data;
    },

    async respondFollowUp(id, response) {
      const { error } = await sb.rpc('respond_consult_followup', { p_id: id, p_response: response });
      if (error) throw error;
    },

    async listQueue() {
      // ดึง 200 เคสล่าสุด (ไม่ใช่เก่าสุด) เพื่อให้คิวและสถิติไม่ตกหล่นเมื่อมีเคสสะสมมาก แล้วเรียงเก่าไปใหม่เหมือนเดิม
      const rows = check(await sb.from('consult_sessions').select('*').order('created_at', { ascending: false }).limit(200)) as Row[];
      return rows.reverse().map(toSession);
    },
    async listQueueInfo(ids) {
      const followUps = check(await sb.from('consult_followups').select('*').eq('status', 'responded').order('responded_at')) as Row[];
      const lastSender: Record<string, 'patient' | 'staff'> = {};
      if (ids.length) {
        const rows = check(
          await sb.from('consult_messages').select('session_id, sender_role').in('session_id', ids).order('created_at', { ascending: false }).limit(1000)
        ) as Row[];
        for (const r of rows) {
          const sid = r.session_id as string;
          if (!lastSender[sid]) lastSender[sid] = r.sender_role as 'patient' | 'staff';
        }
      }
      return { followUps: followUps.map(toFollowUp), lastSender };
    },
    async getStaffSession(id) {
      const row = check(await sb.from('consult_sessions').select('*').eq('id', id).maybeSingle()) as Row | null;
      if (!row) return null;
      const [consent, followUps] = await Promise.all([
        sb.from('consult_consents').select('revoked_at').eq('session_id', id).maybeSingle(),
        sb.from('consult_followups').select('*').eq('session_id', id),
      ]);
      const consentRow = check(consent) as Row | null;
      return {
        session: toSession(row),
        consentActive: !!consentRow && !consentRow.revoked_at,
        followUps: (check(followUps) as Row[]).map(toFollowUp),
      };
    },
    async openBrief(id) {
      const { data, error } = await sb.rpc('open_consult_brief', { p_session: id });
      if (error) throw error;
      return data as PatientBrief;
    },
    async acceptSession(id) {
      const { error } = await sb.rpc('set_consult_status', { p_session: id, p_status: 'active' });
      if (error) throw error;
    },
    async releaseSession(id) {
      const { error } = await sb.rpc('release_consultation', { p_session: id });
      if (error) throw error;
    },
    async takeOverSession(id) {
      const { error } = await sb.rpc('take_over_consultation', { p_session: id });
      if (error) throw error;
    },
    async declineSession(id) {
      const { error } = await sb.rpc('set_consult_status', { p_session: id, p_status: 'cancelled' });
      if (error) throw error;
    },
    async getNote(id) {
      const row = check(await sb.from('consult_notes').select('*').eq('session_id', id).maybeSingle()) as Row | null;
      return row ? toNote(row) : null;
    },
    async saveNote(id, fields: NoteFields) {
      const uid = await currentUserId();
      const row = check(
        await sb
          .from('consult_notes')
          .upsert({
            session_id: id,
            author_id: uid,
            assessment: fields.assessment,
            medication_advice: fields.medicationAdvice,
            recommendation: fields.recommendation,
            referral: fields.referral,
            follow_up_plan: fields.followUpPlan,
            follow_up_due: fields.followUpDue || null,
          })
          .select('*')
          .single()
      ) as Row;
      return toNote(row);
    },
    async confirmNote(id) {
      const { error } = await sb.rpc('confirm_consult_note', { p_session: id });
      if (error) throw error;
    },
    async reviewFollowUp(id) {
      const { error } = await sb.rpc('review_consult_followup', { p_id: id });
      if (error) throw error;
    },
    async setOnline(online) {
      const { error } = await sb.rpc('set_provider_online', { p_online: online });
      if (error) throw error;
    },
    async getAdminAccess() {
      const { data, error } = await sb.rpc('consult_is_admin');
      if (error) throw error;
      return data === true;
    },
    async listAllProviders() {
      const [res, labels] = await Promise.all([sb.from('consult_providers').select('*').order('display_name'), labelMap()]);
      return (check(res) as Row[]).map((r) => toProvider(r, labels));
    },
    async addCategory(label) {
      const { data, error } = await sb.rpc('admin_add_category', { p_label: label });
      if (error) throw error;
      return data as string;
    },
    async deleteReview(id) {
      const { error } = await sb.rpc('admin_delete_review', { p_id: id });
      if (error) throw error;
    },
    async saveProvider(input: ProviderInput) {
      const row = {
        kind: input.kind,
        display_name: input.displayName,
        photo_url: input.photoUrl,
        specialties: input.specialties,
        org_name: input.orgName,
        license_no: input.licenseNo,
        about: input.about,
        address: input.address,
        province: input.province,
        map_url: input.mapUrl,
        phone: input.phone,
        line_id: input.lineId,
        contact_email: input.contactEmail,
        website: input.website,
        hours: input.hours,
        channels: input.channels,
      };
      if (input.id) {
        const { error } = await sb.from('consult_providers').update(row).eq('id', input.id);
        if (error) throw error;
        return input.id;
      }
      const created = check(await sb.from('consult_providers').insert(row).select('id').single()) as Row;
      return created.id as string;
    },
    async setProviderStatus(id, status, note) {
      const { data, error } = await sb.rpc('admin_set_provider_status', { p_provider: id, p_status: status, p_note: note });
      if (error) throw error;
      return Number(data ?? 0);
    },
    async deleteProvider(id) {
      const { error } = await sb.rpc('admin_delete_provider', { p_provider: id });
      if (error) throw error;
    },
    async listStaff() {
      const rows = check(await sb.rpc('admin_list_staff')) as Row[];
      return rows.map((r): StaffRecord => ({
        userId: r.user_id as string,
        email: r.email as string,
        role: r.role as StaffRole,
        providerId: (r.provider_id as string) ?? null,
        phone: (r.phone as string) ?? '',
      }));
    },
    async assignStaff(email, providerId, phone) {
      const { error } = await sb.rpc('admin_assign_staff', { p_email: email, p_provider: providerId, p_phone: phone });
      if (error) throw error;
    },
    async removeStaff(userId) {
      const { error } = await sb.rpc('admin_remove_staff', { p_user: userId });
      if (error) throw error;
    },
    async getMyProvider() {
      const uid = await currentUserId();
      const staff = check(await sb.from('consult_staff').select('provider_id').eq('user_id', uid).maybeSingle()) as Row | null;
      if (!staff?.provider_id) return null;
      const [res, labels] = await Promise.all([sb.from('consult_providers').select('*').eq('id', staff.provider_id as string).maybeSingle(), labelMap()]);
      const row = check(res) as Row | null;
      return row ? toProvider(row, labels) : null;
    },
  };
}
