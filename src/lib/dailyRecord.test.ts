import { describe, expect, it } from 'vitest';
import {
  dayCells,
  draftFromVitals,
  emptyVitalDraft,
  hasVitals,
  memberIdForAbout,
  parseVitalDraft,
  symptomFrequency,
  vitalChips,
} from './dailyRecord';
import type { JournalPost } from './journal';
import { CURRENT_MEMBER_ID, type HouseholdMember } from './settings';

const post = (over: Partial<JournalPost>): JournalPost => ({
  id: Math.random().toString(36),
  authorId: 'me',
  authorName: 'ฉัน',
  about: 'ตัวฉันเอง',
  title: '',
  content: '',
  symptoms: [],
  moodMain: null,
  moodDetails: [],
  photo: null,
  createdAt: '2026-11-10T08:00:00.000Z',
  editedAt: null,
  likes: [],
  comments: [],
  ...over,
});

describe('parseVitalDraft', () => {
  it('ไม่กรอกเลย = ไม่มีค่าสุขภาพ (ไม่ใช่ข้อผิดพลาด)', () => {
    expect(parseVitalDraft(emptyVitalDraft())).toEqual({ ok: true, values: null });
  });

  it('แปลงตัวเลข และใส่ช่วงตรวจน้ำตาลเฉพาะเมื่อกรอกน้ำตาล', () => {
    const r = parseVitalDraft({ ...emptyVitalDraft(), nums: { systolic: '125', diastolic: '80', weight: '58,5' } });
    expect(r).toEqual({ ok: true, values: { systolic: 125, diastolic: 80, weightKg: 58.5 } });
    const g = parseVitalDraft({ ...emptyVitalDraft(), nums: { glucose: '105' }, glucoseTiming: 'after-meal' });
    expect(g.ok && g.values?.glucoseTiming).toBe('after-meal');
  });

  it('ความดันต้องกรอกทั้งตัวบนและตัวล่าง', () => {
    const r = parseVitalDraft({ ...emptyVitalDraft(), nums: { systolic: '125' } });
    expect(r.ok).toBe(false);
  });

  it('ค่านอกช่วงที่เป็นไปได้ = พิมพ์ผิด', () => {
    expect(parseVitalDraft({ ...emptyVitalDraft(), nums: { weight: '5800' } }).ok).toBe(false);
    expect(parseVitalDraft({ ...emptyVitalDraft(), nums: { pain: '11' } }).ok).toBe(false);
  });

  it('เวลาที่วัดต้องไม่เป็นอนาคต', () => {
    const now = new Date('2026-11-10T10:00:00').getTime();
    const r = parseVitalDraft({ ...emptyVitalDraft(), nums: { pulse: '72' }, at: '2026-11-11T10:00' }, now);
    expect(r.ok).toBe(false);
  });

  it('แก้ไขโพสต์: ค่าเดิมกลับมาเป็นช่องกรอกได้ครบ', () => {
    const values = { systolic: 130, diastolic: 85, glucose: 99, sleepHours: 6.5, more: { ldl: 120, rr: 18 }, glucoseTiming: 'fasting' as const };
    const round = parseVitalDraft(draftFromVitals(values));
    expect(round).toEqual({ ok: true, values });
  });
});

describe('ค่าใหม่ที่ไม่มีช่องเฉพาะ (ผลเลือด น้ำเข้า-ออก)', () => {
  it('เก็บใน more และบอกหมวดเมื่อพิมพ์ผิด', () => {
    const r = parseVitalDraft({ ...emptyVitalDraft(), nums: { ldl: '130', water: '1500' } });
    expect(r).toEqual({ ok: true, values: { more: { ldl: 130, water: 1500 } } });
    const bad = parseVitalDraft({ ...emptyVitalDraft(), nums: { k: '40' } });
    expect(bad.ok === false && bad.category).toBe('lab');
  });
  it('ป้ายแสดงตามลำดับหมวด', () => {
    const chips = vitalChips({ more: { ldl: 130 }, pulseBpm: 70 });
    expect(chips.map((c) => c.label)).toEqual(['ชีพจร', 'ไขมัน LDL']);
  });
});

describe('vitalChips / hasVitals', () => {
  it('แสดงความดันเป็นคู่ และค่าอื่นพร้อมหน่วย', () => {
    const chips = vitalChips({ systolic: 120, diastolic: 80, tempC: 37, painScore: 3 });
    expect(chips.map((c) => c.value)).toEqual(['120/80 mmHg', '37.0 °C', '3/10']);
  });
  it('มีค่าอย่างน้อยหนึ่งตัวจึงนับว่ามีค่าสุขภาพ', () => {
    expect(hasVitals({})).toBe(false);
    expect(hasVitals(null)).toBe(false);
    expect(hasVitals({ spo2: 98 })).toBe(true);
  });
});

describe('memberIdForAbout', () => {
  const members = [{ id: 'mint', name: 'น้องมิ้นท์' }] as HouseholdMember[];
  it('ตัวฉันเอง = ผู้ใช้ปัจจุบัน, ชื่อสมาชิก = สมาชิกคนนั้น, ไม่พบ = null', () => {
    expect(memberIdForAbout('ตัวฉันเอง', members)).toBe(CURRENT_MEMBER_ID);
    expect(memberIdForAbout('น้องมิ้นท์', members)).toBe('mint');
    expect(memberIdForAbout('คนนอกบ้าน', members)).toBeNull();
  });
});

describe('สรุปพัฒนาการ', () => {
  const keyOf = (iso: string) => iso.slice(0, 10);
  const posts = [
    post({ createdAt: '2026-11-09T08:00:00Z', symptoms: ['ปวดหัว', 'ไอ'], moodMain: 'down' }),
    post({ createdAt: '2026-11-09T20:00:00Z', symptoms: ['ปวดหัว'], moodMain: 'great' }),
    post({ createdAt: '2026-11-10T08:00:00Z', symptoms: ['ปวดหัว'] }),
  ];

  it('อาการที่พบบ่อยนับครั้งตามบันทึก เรียงมากไปน้อย', () => {
    expect(symptomFrequency(posts)).toEqual([
      { name: 'ปวดหัว', count: 3 },
      { name: 'ไอ', count: 1 },
    ]);
  });

  it('รายวัน: ใช้อารมณ์ของบันทึกล่าสุดของวัน นับอาการไม่ซ้ำ และวันที่ไม่มีบันทึกเป็นว่าง', () => {
    expect(dayCells(posts, ['2026-11-08', '2026-11-09', '2026-11-10'], keyOf)).toEqual([
      { day: '2026-11-08', mood: null, symptoms: 0, posts: 0 },
      { day: '2026-11-09', mood: 'great', symptoms: 2, posts: 2 },
      { day: '2026-11-10', mood: null, symptoms: 1, posts: 1 },
    ]);
  });
});
