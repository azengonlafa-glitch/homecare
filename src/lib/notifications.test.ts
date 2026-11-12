import { describe, expect, it } from 'vitest';
import {
  autoResolveMedNotifications,
  defaultRoutingForMember,
  generateHealthNotifications,
  shouldDeliverToMember,
  type HealthNotification,
  type MemberRoutingConfig,
} from './notifications';
import type { Medication, MedsState } from './meds';
import type { AppSettings } from './settings';
import type { MemberRecord } from './members';
import type { CalendarEvent } from './calendar';
import type { JournalPost } from './journal';

const mockSettings: AppSettings = {
  homeName: 'บ้านแสนสุข',
  nickname: 'ครอบครัว',
  inviteCode: '123456',
  fontScale: 'normal',
  home: {
    photo: '',
    timeZone: 'Asia/Bangkok',
    address1: '',
    address2: '',
    country: '',
    state: '',
    city: '',
    zip: '',
    conditions: [],
    active: true,
  },
  profile: {
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    email: 'somchai@example.com',
    hideEmail: false,
    timeZone: 'Asia/Bangkok',
    phone: '',
    address1: '',
    address2: '',
    country: '',
    state: '',
    city: '',
    zip: '',
    photo: '',
  },
  members: [
    { id: 'user-me', name: 'สมชาย', role: 'owner', relation: 'พ่อ' },
    { id: 'mint', name: 'มิ้นท์', role: 'member', relation: 'ลูกสาว' },
    { id: 'grandma', name: 'ยายแดง', role: 'member', relation: 'ยาย' },
  ],
  reminders: {
    lowStock: true,
    lowStockDays: 3,
    doseWindow: true,
    appointment: true,
    repeatCount: 2,
    repeatIntervalMinutes: 10,
    escalateToFamily: true,
    sound: true,
    uiSound: true,
  },
};

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

const sampleMed: Medication = {
  id: 'med-para',
  name: 'Paracetamol 500mg',
  form: 'tablet',
  perDose: 1,
  unit: 'เม็ด',
  meal: 'after',
  periods: ['morning', 'noon', 'evening'],
  times: { morning: '08:00', noon: '12:00', evening: '18:00' },
  weekdays: [],
  startDate: '2026-11-01',
  durationDays: null,
  active: true,
  stoppedAt: null,
  remaining: 2, // low stock (2 <= 3)
  lowStockDays: 3,
  lastRefillDate: '',
  refillsRemaining: null,
  condition: 'ลดไข้ แก้ปวด',
  reason: '',
  drugRef: '',
  pillPhoto: null,
  labelPhoto: null,
  note: '',
  createdAt: '2026-11-01T00:00:00Z',
};

describe('Health Notifications Engine (ระบบติดตามเหตุการณ์สุขภาพ)', () => {
  it('สร้างการแจ้งเตือนเรื่องยา: ถึงเวลา, สต็อกยาใกล้หมด', () => {
    // กำหนดเวลา 08:15 น. (เลย 08:00 มา 15 นาที = ถึงเวลารับประทานยา)
    const now = new Date(2026, 10, 5, 8, 15);
    const medsState: MedsState = {
      meds: [sampleMed],
      logs: [],
    };

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState,
    });

    // 1. ต้องมีการแจ้งเตือน dose_due สำหรับมื้อเช้า
    const doseDue = notifs.find((n) => n.type === 'dose_due' && n.period === 'morning');
    expect(doseDue).toBeDefined();
    expect(doseDue?.title).toContain('ถึงเวลากินยา');
    expect(doseDue?.medName).toBe('Paracetamol 500mg');
    expect(doseDue?.actionStatus).toBe('pending');

    // 2. ต้องมีการแจ้งเตือน stock_low เพราะเหลือ 2 เม็ด (<= 3 วัน)
    const stockLow = notifs.find((n) => n.type === 'stock_low');
    expect(stockLow).toBeDefined();
    expect(stockLow?.title).toContain('ยาใกล้หมด');
  });

  it('สร้างการแจ้งเตือนเมื่อยังไม่ยืนยันการรับประทานยา (dose_unconfirmed) และตั้งเวลาหน่วงก่อนแจ้งผู้ดูแล (Escalation)', () => {
    // 10:00 น. เลยมื้อ 08:00 มา 120 นาที (เกิน grace period 90 นาที และเกิน escalation delay 30 นาที)
    const now = new Date(2026, 10, 5, 10, 0);
    const medsState: MedsState = {
      meds: [sampleMed],
      logs: [],
    };

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState,
    });

    const unconfirmed = notifs.find((n) => n.type === 'dose_unconfirmed' && n.period === 'morning');
    expect(unconfirmed).toBeDefined();
    expect(unconfirmed?.priority).toBe('urgent');
    expect(unconfirmed?.title).toContain('ยังไม่ได้กินยา');
    expect(unconfirmed?.escalatedAt).not.toBeNull();
  });

  it('สร้างการแจ้งเตือนเมื่อใกล้ถึงเวลารับประทานยารอบถัดไป (dose_upcoming)', () => {
    // 11:45 น. ก่อนมื้อเที่ยง 12:00 น. 15 นาที
    const now = new Date(2026, 10, 5, 11, 45);
    const medsState: MedsState = {
      meds: [sampleMed],
      logs: [],
    };

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState,
    });

    const upcoming = notifs.find((n) => n.type === 'dose_upcoming' && n.period === 'noon');
    expect(upcoming).toBeDefined();
    expect(upcoming?.title).toContain('ใกล้ถึงเวลากินยา');
    expect(upcoming?.body).toContain('ในอีก 15 นาที');
  });

  it('สร้างการแจ้งเตือนเมื่อมีการบันทึกว่าข้ามยา (dose_skipped)', () => {
    const now = new Date(2026, 10, 5, 13, 0);
    const medsState: MedsState = {
      meds: [sampleMed],
      logs: [
        {
          date: '2026-11-05',
          medId: 'med-para',
          period: 'noon',
          status: 'skipped',
          at: '2026-11-05T05:00:00Z',
          byId: 'user-me',
          byName: 'สมชาย',
          reason: 'แพทย์สั่งให้งดเนื่องจากไม่มีไข้แล้ว',
        },
      ],
    };

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState,
    });

    const skipped = notifs.find((n) => n.type === 'dose_skipped' && n.period === 'noon');
    expect(skipped).toBeDefined();
    expect(skipped?.title).toContain('มีการข้ามยา');
    expect(skipped?.body).toContain('แพทย์สั่งให้งด');
  });

  it('สร้างการแจ้งเตือนนัดหมายแพทย์: ใกล้ถึงวันนัด และถึงกำหนดตรวจสุขภาพ', () => {
    const now = new Date(2026, 10, 5, 9, 0);
    const events: CalendarEvent[] = [
      {
        id: 'event-1',
        title: 'นัดพบแพทย์ รพ.ศิริราช ตรวจเบาหวาน',
        description: 'งดน้ำและอาหารหลัง 20:00 น.',
        important: true,
        tags: ['หมอ', 'เบาหวาน'],
        allDay: false,
        startDate: '2026-11-06', // พรุ่งนี้
        startTime: '09:00',
        endDate: '2026-11-06',
        endTime: '11:00',
        timeZone: 'Asia/Bangkok',
        reminderMinutes: 60,
        repeat: null,
        location: { name: 'รพ.ศิริราช ตึกผู้ป่วยนอก', address1: '', address2: '', country: '', state: '', city: '', zip: '' },
        assignees: ['mint'],
        needVolunteer: false,
        attachments: [],
        comments: [],
        createdById: 'user-me',
        createdByName: 'สมชาย',
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
      },
    ];

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState: { meds: [], logs: [] },
      events,
    });

    const appt = notifs.find((n) => n.type === 'appointment_upcoming');
    expect(appt).toBeDefined();
    expect(appt?.title).toContain('ใกล้ถึงวันนัดแพทย์');
    expect(appt?.body).toContain('พรุ่งนี้');
  });

  it('สร้างการแจ้งเตือนในครอบครัว: สมาชิกมีการเปลี่ยนแปลงข้อมูลสุขภาพผิดปกติ & โพสต์บันทึกสุขภาพ', () => {
    const now = new Date(2026, 10, 5, 9, 0);
    const memberRecords: Record<string, MemberRecord> = {
      grandma: emptyRecord('grandma', {
        health: {
          bloodPressure: '165/100',
          bloodSugar: '140',
          conditions: ['ความดันโลหิตสูง'],
          allergies: [],
          note: '',
          history: [],
        },
        vitals: [
          {
            id: 'vital-grandma-1',
            at: '2026-11-05T01:30:00Z',
            systolic: 165,
            diastolic: 100, // ความดันสูง
            weightKg: 60,
          },
        ],
      }),
    };

    const posts: JournalPost[] = [
      {
        id: 'post-1',
        authorId: 'mint',
        authorName: 'มิ้นท์',
        about: 'ยายแดง',
        title: 'ยายมีอาการเวียนศีรษะ',
        content: 'ตอนเช้าลุกขึ้นแล้วหน้ามืด',
        symptoms: ['เวียนศีรษะ', 'หน้ามืด'],
        moodMain: 'down',
        moodDetails: ['เหนื่อยล้า'],
        photo: null,
        createdAt: '2026-11-05T02:00:00Z',
        editedAt: null,
        likes: [],
        comments: [],
      },
    ];

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState: { meds: [], logs: [] },
      memberRecords,
      posts,
    });

    const healthChange = notifs.find((n) => n.type === 'health_change');
    expect(healthChange).toBeDefined();
    expect(healthChange?.title).toContain('ยายแดง มีการเปลี่ยนแปลงข้อมูลสุขภาพ');
    expect(healthChange?.body).toContain('ความดัน 165/100 mmHg');

    const journalPost = notifs.find((n) => n.type === 'journal_posted');
    expect(journalPost).toBeDefined();
    expect(journalPost?.title).toContain('มิ้นท์ เพิ่มบันทึกสุขภาพใหม่');
    expect(journalPost?.body).toContain('เวียนศีรษะ');
  });

  it('กฎข้อ 1: ป้องกันการส่งแจ้งเตือนซ้ำในเหตุการณ์เดียวกัน (Deduplication)', () => {
    const now = new Date(2026, 10, 5, 8, 15);
    const medsState: MedsState = { meds: [sampleMed], logs: [] };

    // รันครั้งที่ 1
    const firstRun = generateHealthNotifications({ now, settings: mockSettings, medsState });
    expect(firstRun.length).toBeGreaterThan(0);
    const initialId = firstRun[0].id;

    // รันครั้งที่ 2 โดยส่ง existingList เข้าไปด้วย
    const secondRun = generateHealthNotifications({ now, settings: mockSettings, medsState }, firstRun);

    // จำนวนรายการต้องไม่เพิ่มขึ้นเป็นเท่าตัว และ ID ของเหตุการณ์เดิมต้องคงเดิม
    expect(secondRun.length).toBe(firstRun.length);
    const matched = secondRun.find((n) => n.fingerprint === firstRun[0].fingerprint);
    expect(matched?.id).toBe(initialId);
  });

  it('กฎข้อ 2: หากสมาชิกยืนยันการรับประทานยาแล้ว ต้องปรับสถานะการแจ้งเตือนให้สอดคล้องกัน (Auto-resolve)', () => {
    const pendingNotif: HealthNotification = {
      id: 'notif-1',
      fingerprint: 'med:dose_due:2026-11-05:med-para:morning',
      category: 'medication',
      type: 'dose_due',
      priority: 'important',
      title: 'ถึงเวลารับประทานยา: Paracetamol 500mg',
      body: 'มื้อเช้า',
      medId: 'med-para',
      period: 'morning',
      dateKey: '2026-11-05',
      recipients: [],
      createdAt: '2026-11-05T01:00:00Z',
      isRead: false,
      actionStatus: 'pending',
    };

    // มีบันทึกว่า "กินแล้ว"
    const logs = [
      {
        date: '2026-11-05',
        medId: 'med-para',
        period: 'morning' as const,
        status: 'taken' as const,
        at: '2026-11-05T01:10:00Z',
        byId: 'user-me',
        byName: 'สมชาย',
      },
    ];

    const { updated, changedCount } = autoResolveMedNotifications([pendingNotif], logs);
    expect(changedCount).toBe(1);
    expect(updated[0].actionStatus).toBe('resolved');
    expect(updated[0].resolveReason).toBe('สมาชิกรับประทานยาแล้ว');
    expect(updated[0].isRead).toBe(true);
  });

  it('กฎข้อ 3: การตั้งค่าผู้รับการแจ้งเตือน (Recipient & Notification Routing Rules)', () => {
    const ownerRule = defaultRoutingForMember(mockSettings.members[0]); // owner -> all
    const memberRule = defaultRoutingForMember(mockSettings.members[1]); // member -> own_only for meds

    const configs: Record<string, MemberRoutingConfig> = {
      'user-me': ownerRule,
      mint: memberRule,
    };

    const notifForOwner: Pick<HealthNotification, 'category' | 'priority' | 'memberId'> = {
      category: 'medication',
      priority: 'routine',
      memberId: 'user-me',
    };

    const notifForMint: Pick<HealthNotification, 'category' | 'priority' | 'memberId'> = {
      category: 'medication',
      priority: 'routine',
      memberId: 'mint',
    };

    // Owner (ผู้ดูแลหลัก) ได้รับแจ้งเตือนยาทั้งหมด
    expect(shouldDeliverToMember(notifForMint, 'user-me', configs)).toBe(true);
    // Mint (สมาชิกทั่วไป) ไม่ได้รับแจ้งเตือนยาของคนอื่น (ได้เฉพาะของตัวเอง)
    expect(shouldDeliverToMember(notifForOwner, 'mint', configs)).toBe(false);
    expect(shouldDeliverToMember(notifForMint, 'mint', configs)).toBe(true);
  });

  it('ความปลอดภัยและความเป็นส่วนตัว: ไม่ส่งแจ้งเตือนค่าสุขภาพของสมาชิกให้ผู้ที่ไม่มีสิทธิ์ canViewMember', () => {
    const configs: Record<string, MemberRoutingConfig> = {
      mint: {
        memberId: 'mint',
        medication: 'all',
        appointment: 'all',
        family: 'all',
        system: 'all',
        escalationDelayMin: 30,
      },
    };

    // ยายแดงตั้งค่าความเป็นส่วนตัว: ไม่แชร์ข้อมูล (shareData: false)
    const grandmaPrivateRecord = emptyRecord('grandma', {
      sharing: { shareData: false, editPolicy: 'choose', allowedEditors: [], blockedEditors: [] },
    });

    const notif: Pick<HealthNotification, 'category' | 'priority' | 'memberId'> = {
      category: 'family',
      priority: 'urgent',
      memberId: 'grandma',
    };

    // มิ้นท์ไม่มีสิทธิ์ดูข้อมูลยายแดง -> ต้องไม่ถูกส่ง (false)
    const deliver = shouldDeliverToMember(notif, 'mint', configs, { grandma: grandmaPrivateRecord });
    expect(deliver).toBe(false);
  });

  it('การเตือนยาล่วงหน้าข้ามเที่ยงคืน (Midnight Wrap-around)', () => {
    // ยาเวลา 00:15 น. ตรวจสอบเวลา 23:55 น. (ก่อนถึงเวลา 20 นาที)
    const midnightMed: Medication = {
      ...sampleMed,
      id: 'med-bedtime',
      periods: ['bedtime'],
      times: { morning: '08:00', noon: '12:00', evening: '18:00', bedtime: '00:15' },
    };

    const now = new Date(2026, 10, 5, 23, 55);
    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState: { meds: [midnightMed], logs: [] },
    });

    const upcoming = notifs.find((n) => n.type === 'dose_upcoming' && n.medId === 'med-bedtime');
    expect(upcoming).toBeDefined();
    expect(upcoming?.body).toContain('ในอีก 20 นาที');
  });

  it('การกดยกเลิกการกินยา (Uncheck Log) ต้องคืนสถานะการแจ้งเตือนกลับเป็น pending', () => {
    const today = '2026-11-05';
    const resolvedNotif: HealthNotification = {
      id: 'notif-rev-1',
      fingerprint: `med:dose_due:${today}:med-para:morning`,
      category: 'medication',
      type: 'dose_due',
      priority: 'important',
      title: 'ถึงเวลารับประทานยา: Paracetamol 500mg',
      body: 'มื้อเช้า',
      medId: 'med-para',
      period: 'morning',
      dateKey: today,
      recipients: [],
      createdAt: '2026-11-05T01:00:00Z',
      isRead: true,
      actionStatus: 'resolved',
      resolveReason: 'สมาชิกรับประทานยาแล้ว',
    };

    // ลบ Log ออก (logs = [])
    const { updated, changedCount } = autoResolveMedNotifications([resolvedNotif], [], new Date(2026, 10, 5, 9, 0));
    expect(changedCount).toBe(1);
    expect(updated[0].actionStatus).toBe('pending');
    expect(updated[0].resolveReason).toBeNull();
  });

  it('ตรวจจับและแจ้งเตือนยาของสมาชิกคนอื่นในครอบครัวจาก memberRecords', () => {
    const now = new Date(2026, 10, 5, 8, 30);
    const memberRecords: Record<string, MemberRecord> = {
      grandma: emptyRecord('grandma', {
        meds: [
          {
            id: 'grandma-m1',
            name: 'Amlodipine 5mg',
            dose: '1 เม็ด',
            periods: ['morning'],
            times: { morning: '08:00' },
            form: 'ยาเม็ด',
            condition: 'ความดัน',
          },
        ],
        doseLogs: [],
      }),
    };

    const notifs = generateHealthNotifications({
      now,
      settings: mockSettings,
      medsState: { meds: [], logs: [] },
      memberRecords,
    });

    const grandmaDose = notifs.find((n) => n.memberId === 'grandma' && n.medName === 'Amlodipine 5mg');
    expect(grandmaDose).toBeDefined();
    expect(grandmaDose?.title).toContain('Amlodipine 5mg (ยายแดง)');
  });
});


describe('คำในการแจ้งเตือนเปลี่ยนตามรูปแบบยา (กิน / ฉีด / หยอด / ใช้)', () => {
  const titleFor = (form: Medication['form'], type: 'dose_due' | 'dose_unconfirmed' | 'dose_upcoming', at: Date) => {
    const med: Medication = { ...sampleMed, form, remaining: 100, lowStockDays: 3 };
    const notifs = generateHealthNotifications({ now: at, settings: mockSettings, medsState: { meds: [med], logs: [] } });
    return notifs.find((n) => n.type === type && n.period === 'morning');
  };
  const DUE = new Date(2026, 10, 5, 8, 15); // เลยเวลา 08:00 ไป 15 นาที
  const LATE = new Date(2026, 10, 5, 10, 0);
  const SOON = new Date(2026, 10, 5, 7, 45);

  it('ยาหยอด: หยอด / ยาฉีด: ฉีด / อื่น ๆ: ใช้', () => {
    expect(titleFor('drops', 'dose_due', DUE)?.title).toContain('ถึงเวลาหยอดยา');
    expect(titleFor('injection', 'dose_due', DUE)?.title).toContain('ถึงเวลาฉีดยา');
    expect(titleFor('other', 'dose_due', DUE)?.title).toContain('ถึงเวลาใช้ยา');
    expect(titleFor('spray', 'dose_due', DUE)?.title).toContain('ถึงเวลาพ่นยา');
  });

  it('ยังไม่ยืนยัน และใกล้ถึงเวลา ใช้คำเดียวกัน', () => {
    expect(titleFor('drops', 'dose_unconfirmed', LATE)?.title).toContain('ยังไม่ได้หยอดยา');
    expect(titleFor('drops', 'dose_upcoming', SOON)?.title).toContain('ใกล้ถึงเวลาหยอดยา');
    expect(titleFor('tablet', 'dose_unconfirmed', LATE)?.title).toContain('ยังไม่ได้กินยา');
  });

  it('ปุ่มยืนยันของแจ้งเตือนใช้กริยาเดียวกัน', () => {
    expect(titleFor('drops', 'dose_due', DUE)?.actionLabel).toBe('ยืนยันการหยอดยา');
    expect(titleFor('tablet', 'dose_due', DUE)?.actionLabel).toBe('ยืนยันการกินยา');
  });
});
