import { describe, expect, it } from 'vitest';
import {
  ageFromBirth,
  appointmentsBetween,
  birthFromProfile,
  birthLabel,
  bodyInfo,
  buildFollowUps,
  caregiverOf,
  classifyBp,
  classifyGlucose,
  doseSummary,
  isAppointmentFor,
  latestVitals,
  overallOf,
  postsAboutMember,
  rangeDoseReport,
  rangeFor,
  todayDoses,
  upcomingAppointments,
  weightShift,
  type FollowContext,
} from './memberDashboard';
import { normalizeMed, type DoseLog, type Medication } from './meds';
import type { MemberRecord, VitalReading } from './members';
import type { HouseholdMember } from './settings';
import type { JournalPost } from './journal';
import type { CalendarEvent } from './calendar';

// วันพฤหัสที่ 5 พ.ย. 2026 เวลา 12:00 (เวลาท้องถิ่น)
const NOW = new Date(2026, 10, 5, 12, 0, 0);
const isoAt = (daysAgo: number, hour = 8) => new Date(2026, 10, 5 - daysAgo, hour, 0, 0).toISOString();

const me: HouseholdMember = { id: 'me', name: 'ฉัน', relation: 'ฉัน', role: 'owner' };
const mint: HouseholdMember = { id: 'mint', name: 'น้องมิ้นท์', relation: 'ลูกสาว', role: 'member' };
const members = [me, mint];

const emptyRecord = (id: string, over: Partial<MemberRecord> = {}): MemberRecord => ({
  id,
  age: null,
  gender: '',
  photo: '',
  sharing: { shareData: true, editPolicy: 'choose', allowedEditors: [], blockedEditors: [] },
  health: { conditions: [], allergies: [], bloodPressure: '', bloodSugar: '', note: '', history: [] },
  meds: [],
  ...over,
});

const med = (over: Partial<Medication> = {}): Medication =>
  normalizeMed({
    id: 'm1',
    name: 'ยาลดความดัน',
    periods: ['morning'],
    times: { morning: '08:00' },
    startDate: '2026-10-01',
    remaining: 60,
    lowStockDays: 7,
    active: true,
    ...over,
  });

const log = (over: Partial<DoseLog>): DoseLog => ({
  date: '2026-11-05',
  medId: 'm1',
  period: 'morning',
  status: 'taken',
  at: new Date(2026, 10, 5, 8, 5).toISOString(),
  byId: 'me',
  byName: 'ฉัน',
  ...over,
});

const post = (over: Partial<JournalPost>): JournalPost => ({
  id: 'p1',
  authorId: 'mint',
  authorName: 'น้องมิ้นท์',
  about: 'ตัวฉันเอง',
  title: '',
  content: '',
  symptoms: [],
  moodMain: null,
  moodDetails: [],
  photo: null,
  createdAt: isoAt(0, 9),
  editedAt: null,
  likes: [],
  comments: [],
  ...over,
});

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e1',
  title: 'นัดหมอ',
  description: '',
  important: false,
  tags: [],
  allDay: false,
  startDate: '2026-11-06',
  startTime: '09:00',
  endDate: '2026-11-06',
  endTime: '10:00',
  timeZone: 'Asia/Bangkok',
  reminderMinutes: null,
  repeat: null,
  location: null,
  assignees: [],
  needVolunteer: false,
  attachments: [],
  comments: [],
  createdById: 'me',
  createdByName: 'ฉัน',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: null,
  ...over,
});

const ctx = (over: Partial<FollowContext> = {}): FollowContext => ({
  member: mint,
  members,
  record: emptyRecord('mint'),
  isMe: false,
  meds: [],
  logs: [],
  posts: [],
  events: [],
  own: null,
  stockTrusted: () => true,
  now: NOW,
  ...over,
});

describe('ค่าสุขภาพ', () => {
  it('จัดระดับความดันตามเกณฑ์วัดที่บ้านของไทย 2022 (ทั้งตัวบนและตัวล่าง)', () => {
    expect(classifyBp(118, 72)).toMatchObject({ severity: 'ok', label: 'ปกติ' });
    expect(classifyBp(128, 72)).toMatchObject({ severity: 'ok', label: 'สูงกว่าปกติเล็กน้อย' });
    expect(classifyBp(118, 80)).toMatchObject({ severity: 'ok', label: 'สูงกว่าปกติเล็กน้อย' });
    expect(classifyBp(135, 70)).toMatchObject({ severity: 'watch', label: 'สูง' });
    expect(classifyBp(120, 85)).toMatchObject({ severity: 'watch', label: 'สูง' });
    // ความดันต่ำมีความหมายเมื่อมีอาการเท่านั้น จึงไม่แจ้งเตือน
    expect(classifyBp(85, 55)).toMatchObject({ severity: 'ok', label: 'ต่ำ' });
    expect(classifyBp(180, 100)).toMatchObject({ severity: 'urgent', label: 'สูงมาก' });
    expect(classifyBp(150, 110).severity).toBe('urgent');
    expect(classifyBp(179, 109).severity).toBe('watch');
  });

  it('จัดระดับน้ำตาลตาม ADA 2025', () => {
    // ไม่เป็นเบาหวาน
    expect(classifyGlucose(90, 'fasting', false)).toMatchObject({ severity: 'ok', label: 'ปกติ' });
    expect(classifyGlucose(110, 'fasting', false)).toMatchObject({ severity: 'ok', label: 'สูงกว่าปกติ' });
    expect(classifyGlucose(126, 'fasting', false)).toMatchObject({ severity: 'watch', label: 'สูง ควรตรวจยืนยัน' });
    expect(classifyGlucose(190, 'after-meal', false).severity).toBe('ok');
    expect(classifyGlucose(200, 'after-meal', false).severity).toBe('watch');
    // เป็นเบาหวาน: เป้าทั่วไปก่อนอาหาร 80–130 หลังอาหาร <180
    expect(classifyGlucose(130, 'fasting', true)).toMatchObject({ severity: 'ok', label: 'ตามเป้าทั่วไป' });
    expect(classifyGlucose(131, 'fasting', true)).toMatchObject({ severity: 'ok', label: 'สูงกว่าเป้าทั่วไป' });
    expect(classifyGlucose(170, 'after-meal', true).label).toBe('ตามเป้าทั่วไป');
    expect(classifyGlucose(180, 'after-meal', true).label).toBe('สูงกว่าเป้าทั่วไป');
    expect(classifyGlucose(200, 'unknown', true).severity).toBe('watch');
    // น้ำตาลต่ำ: ระดับ 1 <70, ระดับ 2 <54
    expect(classifyGlucose(65, 'fasting', true).severity).toBe('watch');
    expect(classifyGlucose(53, 'fasting', false).severity).toBe('urgent');
  });

  it('ใช้ค่าที่บันทึกล่าสุดก่อน และถอยไปใช้ค่าตั้งต้นเมื่อไม่มีบันทึก', () => {
    const vitals: VitalReading[] = [
      { id: 'a', at: isoAt(5), systolic: 120, diastolic: 80 },
      { id: 'b', at: isoAt(1), systolic: 135, diastolic: 85, glucose: 99, glucoseTiming: 'fasting' },
    ];
    const withReadings = latestVitals(emptyRecord('mint', { vitals }), null);
    expect(withReadings.bp).toMatchObject({ sys: 135, dia: 85 });
    expect(withReadings.glucose).toMatchObject({ value: 99, timing: 'fasting' });
    expect(withReadings.weight).toBeNull();

    const base = latestVitals(
      emptyRecord('mint', {
        health: { conditions: [], allergies: [], bloodPressure: '128/82', bloodSugar: '95', note: '', history: [] },
        weightKg: 56,
      }),
      null
    );
    expect(base.bp).toEqual({ sys: 128, dia: 82, at: null });
    expect(base.glucose).toEqual({ value: 95, timing: 'fasting', at: null });
    expect(base.weight).toEqual({ kg: 56, at: null });
  });

  it('จับน้ำหนักขึ้นเกิน 2 กก. ใน 3 วัน (ESC สำหรับหัวใจล้มเหลว)', () => {
    const fast: VitalReading[] = [
      { id: '1', at: isoAt(3), weightKg: 60 },
      { id: '2', at: isoAt(0), weightKg: 62.5 },
    ];
    expect(weightShift(fast)).toEqual({ deltaKg: 2.5, days: 3 });
    const exactlyTwo: VitalReading[] = [
      { id: '1', at: isoAt(2), weightKg: 60 },
      { id: '2', at: isoAt(0), weightKg: 62 },
    ];
    expect(weightShift(exactlyTwo)).toBeNull();
    const slow: VitalReading[] = [
      { id: '1', at: isoAt(6), weightKg: 60 },
      { id: '2', at: isoAt(0), weightKg: 63 },
    ];
    expect(weightShift(slow)).toBeNull();
    const loss: VitalReading[] = [
      { id: '1', at: isoAt(2), weightKg: 63 },
      { id: '2', at: isoAt(0), weightKg: 60 },
    ];
    expect(weightShift(loss)).toBeNull();
    expect(weightShift([{ id: '1', at: isoAt(0), weightKg: 60 }])).toBeNull();
  });
});

describe('ข้อมูลพื้นฐาน', () => {
  it('คำนวณอายุและวันเกิด', () => {
    expect(ageFromBirth({ day: 12, month: 5, yearBE: 2535 }, NOW)).toBe(34);
    // ยังไม่ถึงวันเกิดปีนี้ (ธ.ค.) → ยังไม่ครบปี
    expect(ageFromBirth({ day: 20, month: 12, yearBE: 2535 }, NOW)).toBe(33);
    expect(ageFromBirth({ day: null, month: null, yearBE: 2506 }, NOW)).toBe(63);
    expect(birthLabel({ day: 12, month: 5, yearBE: 2535 })).toBe('12 พฤษภาคม 2535');
    expect(birthLabel({ day: null, month: 9, yearBE: 2528 })).toBe('กันยายน 2528');
    expect(birthLabel({ day: null, month: null, yearBE: 2506 })).toBe('พ.ศ. 2506');
    expect(birthLabel(null)).toBeNull();
  });

  it('อ่านวันเกิดจากข้อมูลพื้นฐาน', () => {
    expect(birthFromProfile({ birthDay: '5', birthMonth: '11', birthYear: '2540' })).toEqual({
      day: 5,
      month: 11,
      yearBE: 2540,
    });
    expect(birthFromProfile({ birthDay: '', birthMonth: '', birthYear: '2540' })).toEqual({
      day: null,
      month: null,
      yearBE: 2540,
    });
    expect(birthFromProfile({ birthDay: '1', birthMonth: '1', birthYear: '' })).toBeNull();
  });

  it('คำนวณ BMI จากส่วนสูงและน้ำหนักล่าสุด', () => {
    const record = emptyRecord('mint', {
      heightCm: 160,
      weightKg: 70,
      vitals: [{ id: 'w', at: isoAt(1), weightKg: 56 }],
    });
    const body = bodyInfo(record, null, NOW);
    expect(body.weightKg).toBe(56);
    expect(body.bmi).toBe(21.9);
    expect(body.bmiLabel).toBe('สมส่วน');
    expect(body.bmiTone).toBe('good');
    expect(bodyInfo(emptyRecord('x'), null, NOW).bmi).toBeNull();
  });

  it('ข้อมูลตัวเองใช้ข้อมูลพื้นฐานที่กรอกไว้ก่อน', () => {
    const own = {
      birthDay: '12',
      birthMonth: '5',
      birthYear: '2535',
      heightCm: '170',
      weightKg: '65',
    } as Parameters<typeof bodyInfo>[1];
    const body = bodyInfo(emptyRecord('me', { age: 99 }), own, NOW);
    expect(body.age).toBe(34);
    expect(body.heightCm).toBe(170);
    expect(body.weightKg).toBe(65);
    expect(body.bmi).toBe(22.5);
  });

  it('ผู้ดูแลหลัก: ที่เลือกไว้ก่อน ไม่งั้นใช้เจ้าของบ้าน และเจ้าของบ้านไม่มีผู้ดูแลอื่นโดยปริยาย', () => {
    expect(caregiverOf({ caregiverId: 'mint' }, me, members)).toEqual({ member: mint, chosen: true });
    expect(caregiverOf({}, mint, members)).toEqual({ member: me, chosen: false });
    expect(caregiverOf({}, me, members)).toEqual({ member: null, chosen: false });
    expect(caregiverOf({ caregiverId: 'gone' }, mint, members).member).toEqual(me);
  });
});

describe('ยาวันนี้', () => {
  it('สรุปสถานะ กินแล้ว / ยังไม่ยืนยัน / ข้าม', () => {
    const meds = [
      med({ id: 'm1', name: 'ยา ก', periods: ['morning', 'evening'], times: { morning: '08:00', evening: '18:00' } }),
      med({ id: 'm2', name: 'ยา ข', periods: ['noon'], times: { noon: '11:00' } }),
    ];
    const logs = [
      log({ medId: 'm1', period: 'morning', status: 'taken' }),
      log({ medId: 'm2', period: 'noon', status: 'skipped', reason: 'หมอสั่งให้งด' }),
    ];
    const items = todayDoses(meds, logs, NOW);
    expect(items.map((i) => `${i.med.id}|${i.period}|${i.state}`)).toEqual([
      'm1|morning|taken',
      'm2|noon|skipped',
      'm1|evening|unconfirmed',
    ]);
    const s = doseSummary(items);
    expect(s).toMatchObject({ total: 3, taken: 1, skipped: 1, missed: 0, unconfirmed: 1, late: 0 });
    // 18:00 ยังไม่ถึงเวลา จึงไม่นับว่าเลยเวลา
    expect(items[2].overdue).toBe(false);
  });

  it('มื้อที่เลยเวลาผ่อนผันและยังไม่ยืนยันถือว่าตกหล่น', () => {
    const items = todayDoses([med()], [], NOW);
    expect(items[0]).toMatchObject({ state: 'unconfirmed', overdue: true, late: true });
    expect(doseSummary(items).late).toBe(1);
  });

  it('ไม่นับยาที่หยุดใช้ ยาที่กินเมื่อจำเป็น และวันที่ไม่ตรงตาราง', () => {
    const meds = [
      med({ id: 'a', active: false }),
      med({ id: 'b', asNeeded: true }),
      // 5 พ.ย. 2026 เป็นวันพฤหัส (4) ตั้งให้กินเฉพาะวันอาทิตย์
      med({ id: 'c', weekdays: [0] }),
      med({ id: 'd' }),
    ];
    expect(todayDoses(meds, [], NOW).map((i) => i.med.id)).toEqual(['d']);
  });

  it('รายงานช่วงวัน: คิดเปอร์เซ็นต์โดยไม่นับมื้อที่งดตามแพทย์สั่ง', () => {
    const meds = [med()];
    const logs = [
      log({ date: '2026-11-03', status: 'taken' }),
      log({ date: '2026-11-02', status: 'skipped' }),
      log({ date: '2026-11-01', status: 'missed' }),
      // 2026-11-04 ไม่มีบันทึก = ยังไม่ยืนยัน
      log({ date: '2026-11-05', status: 'taken' }),
    ];
    const r = rangeDoseReport(meds, logs, '2026-11-01', '2026-11-05', NOW);
    expect(r.totals).toEqual({ expected: 5, taken: 2, skipped: 1, missed: 1, unconfirmed: 1 });
    expect(r.adherence).toBe(50);
    expect(r.days[0].date).toBe('2026-11-05');
    expect(r.days).toHaveLength(5);
  });

  it('รายงานไม่นับมื้อวันนี้ที่ยังไม่ถึงเวลา และไม่นับวันอนาคต', () => {
    const meds = [med({ times: { morning: '20:00' } })];
    const r = rangeDoseReport(meds, [], '2026-11-05', '2026-11-30', NOW);
    expect(r.totals.expected).toBe(0);
    expect(r.adherence).toBeNull();
    expect(r.to).toBe('2026-11-05');
  });
});

describe('ช่วงเวลา', () => {
  it('ช่วงสำเร็จรูปนับรวมวันนี้', () => {
    const custom = { from: '', to: '' };
    expect(rangeFor('7d', custom, NOW)).toEqual({ from: '2026-10-30', to: '2026-11-05' });
    expect(rangeFor('30d', custom, NOW)).toEqual({ from: '2026-10-07', to: '2026-11-05' });
    expect(rangeFor('3m', custom, NOW)).toEqual({ from: '2026-08-06', to: '2026-11-05' });
  });

  it('ช่วงกำหนดเองสลับวันที่ที่กลับด้าน และไม่เกินวันนี้', () => {
    expect(rangeFor('custom', { from: '2026-10-10', to: '2026-10-01' }, NOW)).toEqual({
      from: '2026-10-01',
      to: '2026-10-10',
    });
    expect(rangeFor('custom', { from: '2026-10-10', to: '2027-01-01' }, NOW)).toEqual({
      from: '2026-10-10',
      to: '2026-11-05',
    });
    expect(rangeFor('custom', { from: '2027-02-01', to: '2027-03-01' }, NOW)).toEqual({
      from: '2026-11-05',
      to: '2026-11-05',
    });
  });
});

describe('บันทึกอาการและนัดหมาย', () => {
  it('เลือกโพสต์ที่เป็นของสมาชิกคนนั้น', () => {
    const posts = [
      post({ id: 'own', authorId: 'mint', about: 'ตัวฉันเอง' }),
      post({ id: 'aboutName', authorId: 'me', authorName: 'ฉัน', about: 'น้องมิ้นท์' }),
      post({ id: 'other', authorId: 'mint', about: 'ป้าแดง' }),
      post({ id: 'notMine', authorId: 'me', authorName: 'ฉัน', about: 'ตัวฉันเอง' }),
    ];
    expect(postsAboutMember(posts, mint).map((p) => p.id).sort()).toEqual(['aboutName', 'own']);
  });

  it('นัดหมาย: ต้องเป็นเรื่องแพทย์และพูดถึงสมาชิกหรือมอบหมายให้', () => {
    const named = event({ title: 'พาน้องมิ้นท์ไปหาหมอ' });
    const assigned = event({ title: 'ตรวจเลือด', assignees: ['mint'] });
    const notMedical = event({ title: 'ซื้อของ', assignees: ['mint'] });
    const noName = event({ title: 'นัดหมอฟัน', createdById: 'me' });
    expect(isAppointmentFor(named, mint, members, false)).toBe(true);
    expect(isAppointmentFor(assigned, mint, members, false)).toBe(true);
    expect(isAppointmentFor(notMedical, mint, members, false)).toBe(false);
    // ไม่ระบุชื่อ = ของคนที่สร้างนัด (ฉัน) ไม่ใช่ของมิ้นท์
    expect(isAppointmentFor(noName, mint, members, false)).toBe(false);
    expect(isAppointmentFor(noName, me, members, true)).toBe(true);
    // ของฉัน แต่พูดถึงสมาชิกอื่น → ไม่ใช่ของฉัน
    expect(isAppointmentFor(named, me, members, true)).toBe(false);
  });

  it('หานัดครั้งถัดไป ข้ามนัดที่จบไปแล้ว', () => {
    const events = [
      event({ id: 'past', title: 'นัดหมอน้องมิ้นท์', startDate: '2026-11-05', endDate: '2026-11-05', startTime: '08:00', endTime: '09:00' }),
      event({ id: 'later', title: 'นัดหมอน้องมิ้นท์', startDate: '2026-11-20', endDate: '2026-11-20' }),
      event({ id: 'today', title: 'นัดหมอน้องมิ้นท์', startDate: '2026-11-05', endDate: '2026-11-05', startTime: '15:00', endTime: '16:00' }),
    ];
    const next = upcomingAppointments(events, mint, members, false, NOW);
    expect(next.map((o) => o.event.id)).toEqual(['today', 'later']);
    const past = appointmentsBetween(events, mint, members, false, new Date(2026, 10, 1), new Date(2026, 10, 5));
    expect(past.map((o) => o.event.id).sort()).toEqual(['past', 'today']);
  });
});

describe('ส่วนที่ต้องติดตามและสถานะภาพรวม', () => {
  it('ไม่มีรายการที่ต้องติดตาม = ปกติ', () => {
    const items = buildFollowUps(
      ctx({
        meds: [med()],
        logs: [log({ status: 'taken' }), log({ date: '2026-11-04', status: 'taken' })],
        record: emptyRecord('mint', { vitals: [{ id: 'v', at: isoAt(1), systolic: 118, diastolic: 76 }] }),
      })
    );
    expect(items).toEqual([]);
    expect(overallOf(items)).toBe('normal');
  });

  it('ยังไม่ยืนยันกินยาหลังเลยเวลา = ต้องติดตาม', () => {
    const items = buildFollowUps(ctx({ meds: [med()], logs: [log({ date: '2026-11-04', status: 'taken' })] }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ level: 'watch', kind: 'dose', target: 'meds' });
    expect(overallOf(items)).toBe('watch');
  });

  it('เมื่อวานไม่ได้บันทึกการกินยา และมื้อที่ไม่ได้กินวันนี้ = ต้องติดตาม', () => {
    const yesterday = buildFollowUps(ctx({ meds: [med()], logs: [log({ status: 'taken' })] }));
    expect(yesterday.map((i) => i.id)).toEqual(['dose-yesterday']);

    const missed = buildFollowUps(
      ctx({
        meds: [med()],
        logs: [log({ status: 'missed', reason: 'ลืมกิน' }), log({ date: '2026-11-04', status: 'taken' })],
      })
    );
    expect(missed).toHaveLength(1);
    expect(missed[0].title).toContain('ไม่ได้กินยา');
    expect(missed[0].detail).toContain('ลืมกิน');
  });

  it('อาการอันตรายภายใน 24 ชั่วโมง = เร่งด่วน และอาการทั่วไป = ต้องติดตาม', () => {
    const urgent = buildFollowUps(ctx({ posts: [post({ symptoms: ['เจ็บหน้าอก', 'ไอ'] })] }));
    expect(urgent[0]).toMatchObject({ level: 'urgent', kind: 'symptom' });
    expect(overallOf(urgent)).toBe('urgent');

    const mild = buildFollowUps(ctx({ posts: [post({ symptoms: ['ปวดศีรษะ'] })] }));
    expect(mild[0]).toMatchObject({ level: 'watch', kind: 'symptom' });

    // อาการเมื่อ 3 วันก่อนไม่นับ
    const old = buildFollowUps(ctx({ posts: [post({ symptoms: ['เจ็บหน้าอก'], createdAt: isoAt(3) })] }));
    expect(old).toEqual([]);
  });

  it('ความดันที่วัดล่าสุดสูงมาก = เร่งด่วน แต่ค่าเก่ากว่า 7 วันไม่นับ', () => {
    const fresh = buildFollowUps(
      ctx({ record: emptyRecord('mint', { vitals: [{ id: 'v', at: isoAt(1), systolic: 190, diastolic: 110 }] }) })
    );
    expect(fresh[0]).toMatchObject({ level: 'urgent', kind: 'vital', target: 'bp' });

    const old = buildFollowUps(
      ctx({ record: emptyRecord('mint', { vitals: [{ id: 'v', at: isoAt(10), systolic: 190, diastolic: 110 }] }) })
    );
    expect(old).toEqual([]);
  });

  it('มีโรคความดัน/เบาหวานแต่ไม่ได้วัดเกิน 7 วัน = ข้อมูลยังไม่ได้บันทึกตามแผน', () => {
    const record = emptyRecord('mint', {
      health: {
        conditions: ['ความดันโลหิตสูง', 'เบาหวานชนิดที่ 2'],
        allergies: [],
        bloodPressure: '',
        bloodSugar: '',
        note: '',
        history: [],
      },
    });
    const items = buildFollowUps(ctx({ record }));
    expect(items.map((i) => i.id).sort()).toEqual(['record-bp', 'record-glucose']);

    const ok = buildFollowUps(
      ctx({
        record: {
          ...record,
          vitals: [{ id: 'v', at: isoAt(2), systolic: 125, diastolic: 80, glucose: 110, glucoseTiming: 'fasting' }],
        },
      })
    );
    expect(ok).toEqual([]);
  });

  it('มีนัดวันนี้หรือพรุ่งนี้ = ต้องติดตาม แต่นัดวันถัดไปไม่นับ', () => {
    const tomorrow = event({ title: 'นัดหมอน้องมิ้นท์' });
    const items = buildFollowUps(ctx({ events: [tomorrow] }));
    expect(items[0]).toMatchObject({ kind: 'appointment', level: 'watch' });
    expect(items[0].title).toContain('พรุ่งนี้');

    const far = event({ title: 'นัดหมอน้องมิ้นท์', startDate: '2026-11-10', endDate: '2026-11-10' });
    expect(buildFollowUps(ctx({ events: [far] }))).toEqual([]);
  });

  it('ยาใกล้หมดแจ้งเฉพาะยาที่มีข้อมูลคงเหลือจริง', () => {
    const low = med({ remaining: 2, periods: ['morning'], times: { morning: '23:00' } });
    const trusted = buildFollowUps(ctx({ meds: [low] }));
    expect(trusted.some((i) => i.kind === 'stock')).toBe(true);
    const untrusted = buildFollowUps(ctx({ meds: [low], stockTrusted: () => false }));
    expect(untrusted.some((i) => i.kind === 'stock')).toBe(false);
  });

  it('เรียงรายการเร่งด่วนก่อน', () => {
    const items = buildFollowUps(
      ctx({
        meds: [med()],
        posts: [post({ symptoms: ['ชัก'] })],
      })
    );
    expect(items[0].level).toBe('urgent');
    expect(items[items.length - 1].level).toBe('watch');
  });
});
