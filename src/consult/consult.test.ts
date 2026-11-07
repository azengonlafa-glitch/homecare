import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProfile, type OnboardingProfile } from '../lib/onboarding';
import type { Medication, MedsState } from '../lib/meds';
import type { CheckinAnswers, SessionBundle, StartInput, SymptomCheckin } from './types';

// ข้อมูลในไฟล์นี้เป็นข้อมูลสมมติทั้งหมด
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined });

const { briefToText, buildBrief, changesSince, currentMedications, medicationContext, pastMedications, profileAttachments, recentLogs, severityDirection } = await import('./brief');
const { ALL_SCOPES } = await import('./options');
const { findMissing, structureText } = await import('./assistant');
const { emptyAnswers, questionsFor } = await import('./options');
const { createMockBackend, SAMPLE_PROVIDERS, simulateColleagueClaim } = await import('./mockBackend');
const format = await import('./format');

const answers = (patch: Partial<CheckinAnswers> = {}): CheckinAnswers => ({ ...emptyAnswers(), purpose: 'symptoms', ...patch });

const med = (patch: Partial<Medication>): Medication =>
  ({
    id: 'm1', name: 'ยาสมมติ A', form: 'tablet', perDose: 1, unit: 'เม็ด', meal: 'after', periods: ['morning'], times: {}, weekdays: [],
    startDate: '2020-01-01', durationDays: null, active: true, stoppedAt: null, remaining: 10, lowStockDays: 3, lastRefillDate: '2020-01-01',
    refillsRemaining: null, condition: '', reason: '', drugRef: '', pillPhoto: null, labelPhoto: null, note: '', refillRequestedAt: null, createdAt: '2020-01-01',
    ...patch,
  }) as Medication;

const profile = (patch: Partial<OnboardingProfile> = {}): OnboardingProfile => ({
  ...emptyProfile,
  fullName: 'ผู้ทดสอบ สมมติ',
  birthYear: '2500',
  drugAllergies: [{ drug: 'ยาสมมติ B', symptoms: 'ผื่น', severity: 'severe' }],
  conditions: ['โรคสมมติ'],
  ...patch,
});

const meds = (list: Medication[] = []): MedsState => ({ meds: list, logs: [] });

describe('คำถามตามอาการ', () => {
  it('แสดงเฉพาะที่เกี่ยวข้อง', () => {
    expect(questionsFor({ purpose: 'medication_question', symptoms: [] })).toHaveLength(0);
    expect(questionsFor({ purpose: 'symptoms', symptoms: ['headache'] }).map((q) => q.id)).toEqual(['ha_where', 'ha_long', 'ha_flags']);
    expect(questionsFor({ purpose: 'side_effects', symptoms: [] }).map((q) => q.id)).toEqual(['se_drug', 'se_start', 'se_after']);
  });
});

describe('ระบบช่วยจัดข้อมูล', () => {
  it('เสนออาการและระยะเวลาจากข้อความ โดยไม่แก้ข้อมูลเอง', () => {
    const hints = structureText({ description: 'ปวดหัวมา 3 วัน', symptoms: [], duration: '' });
    expect(hints.symptoms.map((s) => s.value)).toEqual(['headache']);
    expect(hints.duration).toBe('3 วัน');
  });
  it('บอกข้อมูลที่ขาด', () => {
    expect(findMissing(answers({ symptoms: ['cough'] }))).toContain('เป็นมานานแค่ไหนแล้ว');
    expect(findMissing(answers({ purpose: 'other', description: 'ถาม' }))).toHaveLength(0);
  });
});

describe('Patient Brief', () => {
  const now = new Date('2026-06-15T10:00:00');
  it('หมวดที่ไม่อนุญาตต้องไม่อยู่ในข้อมูลเลย ไม่ใช่แค่ซ่อน', () => {
    const b = buildBrief({ profile: profile(), meds: meds([med({})]), answers: answers(), prior: [], scopes: ['symptoms'], now });
    expect(b.symptoms).toBeDefined();
    const text = JSON.stringify(b);
    expect(text).not.toContain('ผู้ทดสอบ');
    expect(text).not.toContain('ยาสมมติ');
    expect(text).not.toContain('โรคสมมติ');
  });
  it('รวมข้อมูลจาก Health Profile เดิมเมื่ออนุญาต', () => {
    const b = buildBrief({ profile: profile(), meds: meds(), answers: answers(), prior: [], scopes: ['symptoms', 'overview', 'allergies', 'history'], now });
    expect(b.overview?.age).toBe(69);
    expect(b.allergies?.drugs[0]).toMatchObject({ drug: 'ยาสมมติ B', severity: 'รุนแรง' });
    expect(b.history?.conditions).toEqual(['โรคสมมติ']);
  });
  it('ไม่นับยาซ้ำระหว่างตู้ยากับข้อมูลสุขภาพ', () => {
    const list = currentMedications(profile({ currentMeds: ['ยาสมมติ A', 'ยาสมมติ C'] }), meds([med({})]));
    expect(list.map((m) => [m.name, m.source])).toEqual([['ยาสมมติ A', 'cabinet'], ['ยาสมมติ C', 'profile']]);
  });
  it('ยาที่เริ่มก่อนมีอาการเป็นข้อมูลให้ตรวจสอบ ไม่ใช้คำว่าเป็นสาเหตุ', () => {
    const ctx = medicationContext(answers({ startedOn: '2026-06-10' }), meds([med({ startDate: '2026-06-05' }), med({ id: 'm2', name: 'ยาเก่า', startDate: '2020-01-01' })]), now);
    expect(ctx?.items.join()).toContain('5 วัน');
    expect(ctx?.items.join()).not.toContain('ยาเก่า');
    expect(ctx?.items.join()).not.toMatch(/สาเหตุ|ทำให้/);
  });
  it('ยาที่เริ่มวันนี้ต้องไม่ขึ้นว่าเริ่มก่อนหน้า 1 วัน', () => {
    const ctx = medicationContext(answers(), meds([med({ startDate: '2026-06-15' })]), now);
    expect(ctx?.items[0]).toContain('ตรงกับวันนี้');
    const yesterday = medicationContext(answers(), meds([med({ startDate: '2026-06-14' })]), now);
    expect(yesterday?.items[0]).toContain('ก่อนวันนี้ 1 วัน');
  });
  it('เปรียบเทียบความรุนแรงกับครั้งก่อน', () => {
    expect(severityDirection(3, 7)).toBe('increased');
    expect(severityDirection(7, 3)).toBe('decreased');
    expect(severityDirection(null, 3)).toBe('unknown');
    const prior = { session: { createdAt: '2026-01-01', status: 'completed' }, checkin: { ...answers({ severity: 3, symptoms: ['cough'] }), createdAt: '2026-01-01' } } as unknown as SessionBundle;
    const c = changesSince(answers({ severity: 7, symptoms: ['cough', 'fever'] }), [prior]);
    expect(c).toMatchObject({ previousSeverity: 3, currentSeverity: 7, direction: 'increased', newSymptoms: ['มีไข้'] });
  });
});

describe('รายงานให้เภสัชกร: ไม่ตัดข้อมูล', () => {
  const now = new Date('2026-06-15T10:00:00');
  const fullProfile = profile({
    birthDay: '1', birthMonth: 'มกราคม', gender: 'เพศสมมติ', occupation: 'อาชีพสมมติ', phone: '0811111111', heightCm: '161', weightKg: '61', bloodType: 'กรุ๊ปสมมติ',
    smoking: 'บุหรี่สมมติ', alcohol: 'แอลกอฮอล์สมมติ', exercise: 'ออกกำลังสมมติ', systolic: '131', diastolic: '81', fastingGlucose: '101',
    otherAllergies: ['แพ้อาหารสมมติ'], currentMeds: ['ยาในโปรไฟล์สมมติ'], supplements: 'อาหารเสริมสมมติ', surgeryHistory: 'ผ่าตัดสมมติ', pharmacistNote: 'โน้ตสมมติ',
    familyHistory: ['ครอบครัวสมมติ'], emergencyName: 'ญาติสมมติ', emergencyPhone: '0822222222', emergencyRelation: 'ความสัมพันธ์สมมติ', address: 'ที่อยู่สมมติ',
    medicalNotes: 'บันทึกแพทย์สมมติ', medicalDocs: [{ id: 'doc1', name: 'เอกสารสมมติ.pdf', type: 'application/pdf', size: 1 }],
    drugAllergies: [{ drug: 'ยาแพ้สมมติ', symptoms: 'อาการแพ้สมมติ', severity: 'severe', attachments: [{ id: 'card1', name: 'บัตรแพ้ยาสมมติ.png', type: 'image/png', size: 1 }] }],
  });
  const medsState: MedsState = {
    meds: [
      med({ name: 'ยาอยู่สมมติ', condition: 'โรคของยาสมมติ', reason: 'เหตุผลยาสมมติ', note: 'โน้ตยาสมมติ', expiryDate: '2030-01-01', startDate: '2026-06-01' }),
      med({ id: 'm9', name: 'ยาหยุดสมมติ', active: false, stoppedAt: '2026-05-01', note: 'โน้ตยาหยุดสมมติ' }),
    ],
    logs: [{ date: '2026-06-10', medId: 'm1', period: 'morning', status: 'missed', at: '2026-06-10T09:00:00', byId: 'x', byName: 'x', reason: 'เหตุผลไม่กินสมมติ' }],
  };
  const fullAnswers = answers({
    symptoms: ['headache'], severity: 6, feelings: ['worried'], description: 'คำอธิบายสมมติ', location: 'ตำแหน่งสมมติ', pattern: 'เป็นตลอดเวลา', worseWith: 'แย่ลงสมมติ', betterWith: 'ดีขึ้นสมมติ',
    duration: '1-3 วัน', startedOn: '2026-06-10', trend: 'worse', previousMeds: 'ยาลองสมมติ', additionalSymptoms: 'อาการร่วมสมมติ',
    answers: { ha_where: 'ข้างเดียว', ha_flags: ['ha_vomit'] },
  });
  const logs = [{ date: '2026-06-14T10:00:00', title: 'หัวข้อบันทึกสมมติ', symptoms: ['อาการบันทึกสมมติ'], mood: 'อารมณ์สมมติ', content: 'เนื้อหาบันทึกสมมติ' }];
  const brief = buildBrief({ profile: fullProfile, meds: medsState, answers: fullAnswers, prior: [], scopes: ALL_SCOPES, logs, now });
  const expected = [
    'ผู้ทดสอบ', '69 ปี', 'เพศสมมติ', '61 กก.', '161 ซม.', 'กรุ๊ปสมมติ', 'อาชีพสมมติ',
    '131/81', '101 mg/dL', 'บุหรี่สมมติ', 'แอลกอฮอล์สมมติ', 'ออกกำลังสมมติ',
    'ยาแพ้สมมติ', 'อาการแพ้สมมติ', 'รุนแรง', 'แพ้อาหารสมมติ',
    'โรคสมมติ', 'ผ่าตัดสมมติ', 'ครอบครัวสมมติ', 'อาหารเสริมสมมติ', 'โน้ตสมมติ', 'บันทึกแพทย์สมมติ', 'เอกสารสมมติ.pdf',
    'ยาอยู่สมมติ', 'โรคของยาสมมติ', 'เหตุผลยาสมมติ', 'โน้ตยาสมมติ', '2030-01-01', 'เหตุผลไม่กินสมมติ', 'ยาในโปรไฟล์สมมติ', 'ยาหยุดสมมติ', 'โน้ตยาหยุดสมมติ',
    'คำอธิบายสมมติ', 'ตำแหน่งสมมติ', 'เป็นตลอดเวลา', 'แย่ลงสมมติ', 'ดีขึ้นสมมติ', '1-3 วัน', '2026-06-10', 'แย่ลง', 'ยาลองสมมติ', 'อาการร่วมสมมติ', 'ข้างเดียว', 'อาเจียนร่วมด้วย', '6/10', 'กังวล',
    'หัวข้อบันทึกสมมติ', 'อาการบันทึกสมมติ', 'อารมณ์สมมติ', 'เนื้อหาบันทึกสมมติ',
  ];
  it('ข้อมูลทุกช่องของ Profile ยา และอาการ อยู่ในรายงานแบบข้อความที่คัดลอกได้', () => {
    const text = briefToText(brief);
    const missing = expected.filter((e) => !text.includes(e));
    expect(missing).toEqual([]);
  });
  it('ไม่ส่งเบอร์โทร ที่อยู่ พิกัด และผู้ติดต่อฉุกเฉิน ทั้งในข้อมูลที่ส่งและรายงานที่คัดลอก', () => {
    const withLocation = buildBrief({ profile: { ...fullProfile, lat: 13.123456, lng: 100.654321 }, meds: medsState, answers: fullAnswers, prior: [], scopes: ALL_SCOPES, logs, now });
    for (const text of [JSON.stringify(withLocation), briefToText(withLocation)]) {
      for (const secret of ['0811111111', '0822222222', 'ญาติสมมติ', 'ความสัมพันธ์สมมติ', 'ที่อยู่สมมติ', '13.123456', '100.654321']) {
        expect(text, secret).not.toContain(secret);
      }
    }
  });
  it('รายงานเรียงสิ่งที่ต้องรู้ก่อน: แพ้ยา → อาการ → ยา', () => {
    const text = briefToText(brief);
    expect(text.indexOf('[ประวัติแพ้ยา]')).toBeLessThan(text.indexOf('[อาการล่าสุด'));
    expect(text.indexOf('[อาการล่าสุด')).toBeLessThan(text.indexOf('[ยาที่ใช้อยู่]'));
  });
  it('เอกสารและบัตรแพ้ยาถูกส่งไปด้วย', () => {
    expect(profileAttachments(brief).map((a) => a.id).sort()).toEqual(['card1', 'doc1']);
  });
  it('การปรึกษาครั้งก่อนไม่ถูกตัดเหลือบางรายการ', () => {
    const prior = Array.from({ length: 8 }, (_, i) => ({ session: { id: String(i), createdAt: `2026-0${i + 1}-01`, status: 'completed', topic: `เรื่อง${i}` }, provider: null, checkin: null, note: { assessment: `ประเมิน${i}`, recommendation: '', medicationAdvice: '', referral: '', followUpPlan: '' } })) as unknown as SessionBundle[];
    const b = buildBrief({ profile: profile(), meds: meds(), answers: answers(), prior, scopes: ALL_SCOPES, now });
    expect(b.previous).toHaveLength(8);
    expect(briefToText(b)).toContain('ประเมิน0');
  });
  it('ยาที่หยุดแล้วไม่ปนกับยาที่ใช้อยู่', () => {
    expect(currentMedications(profile(), medsState, now).map((m) => m.name)).not.toContain('ยาหยุดสมมติ');
    expect(pastMedications(medsState).map((m) => m.name)).toEqual(['ยาหยุดสมมติ']);
  });
  it('บันทึกอาการเอาเฉพาะของตัวเองใน 30 วัน ไม่เอาที่เขียนถึงคนอื่นหรือเก่าเกิน', () => {
    const post = (patch: object) => ({ authorId: 'me', about: 'ตัวฉันเอง', title: 't', content: '', symptoms: [], moodDetails: [], createdAt: '2026-06-10T00:00:00', ...patch });
    const list = recentLogs([post({ title: 'ของฉัน' }), post({ title: 'ของพ่อ', about: 'พ่อ' }), post({ title: 'คนอื่นเขียน', authorId: 'other' }), post({ title: 'เก่า', createdAt: '2026-01-01T00:00:00' })] as never, 'me', 'ตัวฉันเอง', now);
    expect(list.map((l) => l.title)).toEqual(['ของฉัน']);
  });
  it('ยาที่ไม่มีข้อมูลก็ยังแสดงได้ไม่พัง', () => {
    expect(() => briefToText(buildBrief({ profile: emptyProfile, meds: meds(), answers: emptyAnswers(), prior: [], scopes: ALL_SCOPES, now }))).not.toThrow();
  });
});

describe('ขั้นตอนเต็มบน Mock backend', () => {
  beforeEach(() => store.clear());

  const input = (patch: Partial<StartInput> = {}): StartInput => {
    const a = answers({ severity: 4 });
    const checkin: SymptomCheckin = { ...a, id: 'c1', createdAt: new Date().toISOString() };
    return {
      sessionId: 's1', provider: SAMPLE_PROVIDERS[0], channel: 'chat', scheduledAt: null, topic: 'หัวข้อ', patientLabel: 'ผู้ทดสอบ', checkin,
      brief: buildBrief({ profile: profile(), meds: meds(), answers: a, prior: [], scopes: ['symptoms'] }), scopes: ['symptoms'], consentVersion: 'v1',
      ...patch,
    };
  };

  it('ต้องมีโทรเสียงและวิดีโอคอลเป็นตัวเลือกคู่กัน', () => {
    expect(SAMPLE_PROVIDERS[0].channels).toEqual(expect.arrayContaining(['chat', 'voice', 'video', 'appointment']));
  });

  it('ผู้ให้บริการตัวอย่างไม่มีคะแนนปลอม', () => {
    for (const p of SAMPLE_PROVIDERS) {
      expect(p.rating).toBeNull();
      expect(p.isSample).toBe(true);
    }
  });

  it('ไม่รับถ้าไม่ยินยอม และเรียกซ้ำไม่สร้างซ้ำ', async () => {
    const b = createMockBackend();
    const base = input();
    await expect(b.startConsultation({ ...base, scopes: [] })).rejects.toThrow('consent_required');
    await b.startConsultation(base);
    await b.startConsultation(base);
    expect(await b.listMyBundles()).toHaveLength(1);
  });

  it('ผู้ใช้ส่ง → เภสัชกรรับ คุย ยืนยันผล → นัดติดตาม → ผู้ใช้อัปเดต → เภสัชกรตรวจ', async () => {
    const b = createMockBackend();
    await b.startConsultation(input());
    await b.sendMessage('s1', 'สวัสดี', [], 'patient');
    await b.acceptSession('s1');
    await b.openBrief('s1');
    expect((await b.listAccessLog('s1')).map((l) => l.action)).toContain('brief_opened');
    await b.sendMessage('s1', 'ตอบ', [], 'staff');
    expect((await b.listMessages('s1')).map((m) => m.senderRole)).toEqual(['patient', 'staff']);

    const fields = { assessment: '', medicationAdvice: '', recommendation: '', referral: '', followUpPlan: '', followUpDue: '' };
    await expect(b.confirmNote('s1')).rejects.toThrow('note_required');
    await b.saveNote('s1', { ...fields, recommendation: 'คำแนะนำ', followUpPlan: 'ติดตาม', followUpDue: '2030-01-01' });
    expect((await b.getBundle('s1'))?.note).toBeNull();
    await b.confirmNote('s1');

    const done = await b.getBundle('s1');
    expect(done?.session.status).toBe('completed');
    expect(done?.note?.recommendation).toBe('คำแนะนำ');
    await expect(b.saveNote('s1', fields)).rejects.toThrow('forbidden');
    await expect(b.sendMessage('s1', 'ส่งหลังปิด', [], 'patient')).rejects.toThrow('invalid_transition');

    const fu = done!.followUps[0];
    await b.respondFollowUp(fu.id, { severity: 2, feelings: [], trend: 'better', note: '' });
    await expect(b.respondFollowUp(fu.id, { severity: 1, feelings: [], trend: 'better', note: '' })).rejects.toThrow('forbidden');
    await b.reviewFollowUp(fu.id);
    expect((await b.getBundle('s1'))?.followUps[0].status).toBe('reviewed');
  });

  it('ตั้งเวลานัดในห้องได้ระหว่างที่ยังเปิดอยู่ ไม่ต้องเลือกตั้งแต่เริ่ม', async () => {
    const b = createMockBackend();
    const session = await b.startConsultation(input());
    expect(session.channel).toBe('chat');
    expect(session.scheduledAt).toBeNull();
    await b.setSchedule('s1', '2099-01-01T10:00:00.000Z');
    expect((await b.getBundle('s1'))?.session.scheduledAt).toBe('2099-01-01T10:00:00.000Z');
    await b.cancelSession('s1');
    await expect(b.setSchedule('s1', '2099-01-02T10:00:00.000Z')).rejects.toThrow('invalid_transition');
  });

  it('ถอนความยินยอมแล้วเปิด Brief ไม่ได้', async () => {
    const b = createMockBackend();
    await b.startConsultation(input());
    await b.revokeConsent('s1');
    await b.acceptSession('s1');
    await expect(b.openBrief('s1')).rejects.toThrow('consent_revoked');
    expect(await b.getMyBrief('s1')).not.toBeNull();
    expect((await b.getStaffSession('s1'))?.consentActive).toBe(false);
  });
});

describe('เอกสารยินยอม', () => {
  const load = async () => JSON.stringify(await import('../data/consentDocument'));
  it('ไม่มีเบอร์ 1669 แล้ว', async () => {
    expect(await load()).not.toContain('1669');
  });
  it('บอกครบว่าส่งอะไร ไม่ส่งอะไร ถอนและลบอย่างไร และเรื่องสำเนานอกระบบ', async () => {
    const doc = await load();
    for (const phrase of ['ข้อมูลที่ส่ง', 'ไม่ส่งเบอร์โทรศัพท์ ที่อยู่ พิกัดบ้าน และข้อมูลผู้ติดต่อฉุกเฉิน', 'สถิติการกินยา', 'บันทึกอาการของคุณเอง', 'ถอนความยินยอม', 'ลบข้อมูลการปรึกษา', 'คัดลอกรายงาน', 'ไม่ได้ประเมินความรุนแรง', 'ไม่รับประกันว่าผู้ให้บริการจะตอบทันที']) {
      expect(doc, phrase).toContain(phrase);
    }
  });
  it('เปลี่ยนเวอร์ชันแล้ว ผู้ใช้เดิมต้องอ่านใหม่', async () => {
    expect((await import('../data/consentDocument')).CONSENT_VERSION).not.toBe('draft-0.1');
  });
});

describe('แอดมินจัดการร้านและทีมงาน (Mock)', () => {
  const { formatPhone, isHttpsUrl, isSafePhoto } = format;
  type Backend = ReturnType<typeof createMockBackend>;
  beforeEach(() => store.clear());

  const shop = (patch: Record<string, unknown> = {}) => ({
    kind: 'clinic' as const, displayName: 'ร้านทดสอบ', photoUrl: '', specialties: ['ทดสอบ'], orgName: 'ที่ทดสอบ', licenseNo: 'ท.1', about: 'แนะนำตัวสมมติ',
    address: 'ที่อยู่สมมติ', province: 'เชียงใหม่', mapUrl: 'https://maps.example.com/x', phone: '0212345678', lineId: '@shop', contactEmail: 'shop@example.com',
    website: 'https://example.com', hours: '9-17', channels: ['chat' as const], ...patch,
  });
  const startOn = async (b: Backend, providerId: string, sessionId = 's1') => {
    const provider = (await b.getProvider(providerId))!;
    const a = answers({ severity: 3 });
    await b.startConsultation({
      sessionId, provider, channel: 'chat', scheduledAt: null, topic: 'หัวข้อ', patientLabel: 'ผู้ทดสอบ',
      checkin: { ...a, id: 'c', createdAt: new Date().toISOString() },
      brief: buildBrief({ profile: profile(), meds: meds(), answers: a, prior: [], scopes: ['symptoms'] }), scopes: ['symptoms'], consentVersion: 'v1',
    });
  };

  it('จัดรูปแบบเบอร์ และตรวจลิงก์/รูปที่ปลอดภัย', () => {
    expect(formatPhone('0812345678')).toBe('081-234-5678');
    expect(formatPhone('021234567')).toBe('02-123-4567');
    expect(formatPhone('abc')).toBe('abc');
    expect(isHttpsUrl('https://example.com/a')).toBe(true);
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'https://', 'https://a b.com', '']) expect(isHttpsUrl(bad), bad).toBe(false);
    expect(isSafePhoto('')).toBe(true);
    expect(isSafePhoto('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
    expect(isSafePhoto('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafePhoto('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
  });

  it('เพิ่มร้านพร้อมข้อมูลละเอียด ผู้ใช้เห็นครบทุกช่อง', async () => {
    const b = createMockBackend();
    const id = await b.saveProvider(shop({ photoUrl: 'data:image/jpeg;base64,/9j/4AAQ' }));
    const p = (await b.listProviders()).find((x) => x.id === id)!;
    expect(p).toMatchObject({ about: 'แนะนำตัวสมมติ', address: 'ที่อยู่สมมติ', province: 'เชียงใหม่', phone: '0212345678', lineId: '@shop', status: 'open', photoUrl: 'data:image/jpeg;base64,/9j/4AAQ' });
    await b.saveProvider({ ...shop(), id, about: 'แก้แล้ว' });
    expect((await b.getProvider(id))?.about).toBe('แก้แล้ว');
  });

  it('ปิดชั่วคราว: ผู้ใช้ไม่เห็นและเริ่มใหม่ไม่ได้ แอดมินยังเห็น และไม่นับว่าออนไลน์', async () => {
    const b = createMockBackend();
    expect((await b.listProviders()).some((p) => p.id === 'sample-pharmacist-1' && p.online)).toBe(true);
    expect(await b.setProviderStatus('sample-pharmacist-1', 'paused', 'พักร้อน')).toBe(0);
    expect((await b.listProviders()).some((p) => p.id === 'sample-pharmacist-1')).toBe(false);
    const all = (await b.listAllProviders()).find((p) => p.id === 'sample-pharmacist-1')!;
    expect(all).toMatchObject({ status: 'paused', statusNote: 'พักร้อน', online: false });
    await b.setProviderStatus('sample-pharmacist-1', 'open', '');
    const back = (await b.listProviders()).find((p) => p.id === 'sample-pharmacist-1')!;
    expect(back.statusNote).toBe('');
  });

  it('ปิดชั่วคราวไม่ยกเลิกการปรึกษาที่เปิดอยู่ แต่แบนยกเลิกทั้งหมดพร้อมบันทึกให้ผู้ป่วยเห็น', async () => {
    const b = createMockBackend();
    await startOn(b, 'sample-pharmacist-1', 's1');
    await b.setProviderStatus('sample-pharmacist-1', 'paused', '');
    expect((await b.getBundle('s1'))?.session.status).toBe('requested');
    expect((await b.getBundle('s1'))?.provider?.displayName).toBe('เภสัชกรตัวอย่าง ก');
    expect(await b.setProviderStatus('sample-pharmacist-1', 'banned', 'ผิดเงื่อนไข')).toBe(1);
    expect((await b.getBundle('s1'))?.session.status).toBe('cancelled');
    expect((await b.listAccessLog('s1')).map((l) => l.action)).toContain('cancelled_by_admin');
    expect((await b.getBundle('s1'))?.provider?.status).toBe('banned');
  });

  it('ลบร้านที่มีประวัติไม่ได้ ลบร้านว่างได้ และลบทีมงานของร้านไปด้วย', async () => {
    const b = createMockBackend();
    await startOn(b, 'sample-pharmacist-1');
    await expect(b.deleteProvider('sample-pharmacist-1')).rejects.toThrow('provider_has_history');
    const id = await b.saveProvider(shop());
    await b.assignStaff('a@example.com', id, '');
    await b.deleteProvider(id);
    expect(await b.getProvider(id)).toBeNull();
    expect(await b.listStaff()).toHaveLength(0);
    await b.deleteProvider('sample-clinic-1');
    expect((await b.listAllProviders()).some((p) => p.id === 'sample-clinic-1')).toBe(false);
    await expect(b.deleteProvider('no-such')).rejects.toThrow('provider_unavailable');
  });

  it('ทีมงาน: เก็บเบอร์เป็นตัวเลข ตรวจรูปแบบ แก้เบอร์ได้ และไม่เกิน 5 คนต่อร้าน', async () => {
    const b = createMockBackend();
    const id = await b.saveProvider(shop());
    await b.assignStaff('One@Example.com', id, '081-234 5678');
    expect((await b.listStaff())[0]).toMatchObject({ email: 'one@example.com', phone: '0812345678' });
    await expect(b.assignStaff('two@example.com', id, '12345')).rejects.toThrow('invalid_phone');
    await b.assignStaff('one@example.com', id, '0899999999');
    expect(await b.listStaff()).toHaveLength(1);
    expect((await b.listStaff())[0].phone).toBe('0899999999');
    for (const n of [2, 3, 4, 5]) await b.assignStaff(`p${n}@example.com`, id, '');
    await expect(b.assignStaff('p6@example.com', id, '')).rejects.toThrow('staff_limit');
    await b.assignStaff('p5@example.com', id, '0211111111');
    expect((await b.listStaff()).filter((s) => s.providerId === id)).toHaveLength(5);
  });

  it('ย้ายทีมงานข้ามร้านเงียบ ๆ ไม่ได้ ต้องถอดออกก่อน', async () => {
    const b = createMockBackend();
    const a = await b.saveProvider(shop());
    const c = await b.saveProvider(shop({ displayName: 'ร้านอื่น' }));
    await b.assignStaff('x@example.com', a, '');
    await expect(b.assignStaff('x@example.com', c, '')).rejects.toThrow('staff_other_provider');
    await b.removeStaff((await b.listStaff())[0].userId);
    await b.assignStaff('x@example.com', c, '');
    expect((await b.listStaff())[0].providerId).toBe(c);
  });
});

describe('ทีมงานหลายคนและรีวิว (Mock)', () => {
  type Backend = ReturnType<typeof createMockBackend>;
  beforeEach(() => store.clear());

  const start = async (b: Backend, sessionId = 's1', providerId = SAMPLE_PROVIDERS[0].id) => {
    const provider = (await b.getProvider(providerId))!;
    const a = answers({ severity: 3 });
    await b.startConsultation({
      sessionId, provider, channel: 'chat', scheduledAt: null, topic: 'หัวข้อ', patientLabel: 'ผู้ทดสอบ',
      checkin: { ...a, id: 'c', createdAt: new Date().toISOString() },
      brief: buildBrief({ profile: profile(), meds: meds(), answers: a, prior: [], scopes: ['symptoms'] }), scopes: ['symptoms'], consentVersion: 'v1',
    });
  };
  const closeWithNote = async (b: Backend, id: string) => {
    await b.saveNote(id, { assessment: 'ประเมินสมมติ', medicationAdvice: '', recommendation: '', referral: '', followUpPlan: '', followUpDue: '' });
    await b.confirmNote(id);
  };

  it('รับเรื่องแล้วเป็นผู้ดูแล เปิดข้อมูลผู้ป่วยได้ ก่อนรับเปิดไม่ได้', async () => {
    const b = createMockBackend();
    await start(b);
    await expect(b.openBrief('s1')).rejects.toThrow('forbidden');
    await b.acceptSession('s1');
    const ctx = await b.getStaffContext();
    const session = (await b.getStaffSession('s1'))!.session;
    expect(session.assignedTo).toBe(ctx!.userId);
    await expect(b.openBrief('s1')).resolves.toBeTruthy();
  });

  it('เพื่อนร่วมงานรับเคสไปก่อน: รับซ้ำ ตอบ เขียนบันทึก ปิดเคส และเปิดข้อมูลไม่ได้', async () => {
    const b = createMockBackend();
    await start(b);
    simulateColleagueClaim('s1', 'เพื่อน');
    await expect(b.acceptSession('s1')).rejects.toThrow('already_claimed');
    await expect(b.declineSession('s1')).rejects.toThrow('already_claimed');
    await expect(b.sendMessage('s1', 'ตอบ', [], 'staff')).rejects.toThrow('forbidden');
    await expect(b.saveNote('s1', { assessment: 'x', medicationAdvice: '', recommendation: '', referral: '', followUpPlan: '', followUpDue: '' })).rejects.toThrow('forbidden');
    await expect(b.confirmNote('s1')).rejects.toThrow('forbidden');
    await expect(b.openBrief('s1')).rejects.toThrow('forbidden');
    expect((await b.getStaffSession('s1'))!.session.assignedName).toBe('เพื่อน');
  });

  it('รับช่วงต่อเคสของเพื่อนแล้วทำงานต่อได้ และบันทึกไว้ให้ผู้ป่วยเห็น', async () => {
    const b = createMockBackend();
    await start(b);
    simulateColleagueClaim('s1');
    await b.takeOverSession('s1');
    await expect(b.sendMessage('s1', 'ตอบแล้ว', [], 'staff')).resolves.toBeTruthy();
    expect((await b.listAccessLog('s1')).map((l) => l.action)).toContain('taken_over');
  });

  it('คืนเคสเข้าคิว: กลับไปรอรับเรื่อง ไม่มีผู้ดูแล และเปิดข้อมูลไม่ได้อีก', async () => {
    const b = createMockBackend();
    await start(b);
    await b.acceptSession('s1');
    await b.releaseSession('s1');
    const s = (await b.getStaffSession('s1'))!.session;
    expect(s).toMatchObject({ status: 'requested', assignedTo: null, assignedName: '' });
    await expect(b.openBrief('s1')).rejects.toThrow('forbidden');
    await expect(b.releaseSession('s1')).rejects.toThrow('forbidden');
  });

  it('หมวดหมู่: เพิ่มหมวดใหม่ ชื่อซ้ำคืนรหัสเดิม ร้านแสดงชื่อหมวด', async () => {
    const b = createMockBackend();
    expect((await b.listCategories()).map((c) => c.id)).toEqual(['pharmacist', 'clinic']);
    const id = await b.addCategory('ทันตกรรม');
    expect(await b.addCategory(' ทันตกรรม ')).toBe(id);
    await expect(b.addCategory('ก')).rejects.toThrow('invalid_category');
    const providerId = await b.saveProvider({
      kind: id, displayName: 'คลินิกฟัน', photoUrl: '', specialties: [], orgName: 'ที่ทดสอบ', licenseNo: 'ท.2', about: '', address: '', province: '', mapUrl: '',
      phone: '0212345678', lineId: '', contactEmail: '', website: '', hours: '', channels: ['chat'],
    });
    expect((await b.getProvider(providerId))?.kindLabel).toBe('ทันตกรรม');
    expect((await b.listCategories()).map((c) => c.label)).toContain('ทันตกรรม');
  });

  it('รีวิว: รีวิวได้เมื่อเคสเสร็จเท่านั้น คะแนนเฉลี่ยจากรีวิวจริง แก้รีวิวเดิมไม่นับเพิ่ม', async () => {
    const b = createMockBackend();
    const pid = SAMPLE_PROVIDERS[0].id;
    await start(b, 's1', pid);
    await expect(b.submitReview('s1', 5, 'ดี')).rejects.toThrow('review_not_allowed');
    await b.acceptSession('s1');
    await closeWithNote(b, 's1');
    await expect(b.submitReview('s1', 0, '')).rejects.toThrow('invalid_rating');
    await expect(b.submitReview('s1', 6, '')).rejects.toThrow('invalid_rating');
    expect((await b.getProvider(pid))?.rating).toBeNull();
    await b.submitReview('s1', 4, 'ตอบเร็ว');
    await b.submitReview('s1', 5, 'ตอบเร็วมาก');
    const provider = (await b.getProvider(pid))!;
    expect(provider).toMatchObject({ rating: 5, reviewCount: 1 });
    expect((await b.getBundle('s1'))?.review).toMatchObject({ stars: 5, comment: 'ตอบเร็วมาก' });
    expect(await b.listReviews(pid)).toHaveLength(1);
  });

  it('รีวิว: เคสที่ยกเลิกรีวิวไม่ได้ แอดมินลบรีวิวแล้วคะแนนคำนวณใหม่ ลบเคสแล้วรีวิวหาย', async () => {
    const b = createMockBackend();
    const pid = SAMPLE_PROVIDERS[0].id;
    await start(b, 's1', pid);
    await b.cancelSession('s1');
    await expect(b.submitReview('s1', 5, '')).rejects.toThrow('review_not_allowed');
    await start(b, 's2', pid);
    await b.acceptSession('s2');
    await closeWithNote(b, 's2');
    await b.submitReview('s2', 3, 'รอนาน');
    const [review] = await b.listReviews(pid);
    await b.deleteReview(review.id);
    expect((await b.getProvider(pid))).toMatchObject({ rating: null, reviewCount: 0 });
    await b.submitReview('s2', 4, '');
    await b.deleteSession('s2');
    expect(await b.listReviews(pid)).toHaveLength(0);
  });

  it('ให้คะแนนแล้วไม่เก็บชื่อผู้รีวิวในรายการรีวิว', async () => {
    const b = createMockBackend();
    const pid = SAMPLE_PROVIDERS[0].id;
    await start(b, 's1', pid);
    await b.acceptSession('s1');
    await closeWithNote(b, 's1');
    await b.submitReview('s1', 5, 'ดี');
    expect(Object.keys((await b.listReviews(pid))[0]).sort()).toEqual(['comment', 'createdAt', 'id', 'stars']);
  });
});
