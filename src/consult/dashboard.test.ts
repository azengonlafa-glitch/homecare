import { describe, expect, it } from 'vitest';
import { computeReviewStats, computeStats, durationText } from './dashboard';
import type { ConsultSession, Review } from './types';

const NOW = new Date(2026, 10, 6, 15, 0, 0);
const at = (daysAgo: number, hour: number, minute = 0) => new Date(2026, 10, 6 - daysAgo, hour, minute).toISOString();

let n = 0;
const session = (over: Partial<ConsultSession>): ConsultSession => ({
  id: `s${++n}`,
  patientId: 'p1',
  patientLabel: 'x',
  providerId: 'pr',
  channel: 'chat',
  status: 'requested',
  topic: 't',
  scheduledAt: null,
  createdAt: at(0, 9),
  startedAt: null,
  endedAt: null,
  assignedTo: null,
  assignedName: '',
  ...over,
});

describe('สถิติหลังบ้าน', () => {
  it('นับคำขอรายวันและเคสที่จบในช่วงที่เลือก ไม่นับเคสนอกช่วง', () => {
    const sessions = [
      session({ createdAt: at(0, 9) }),
      session({ createdAt: at(0, 14), patientId: 'p2' }),
      session({ createdAt: at(2, 10), status: 'completed', startedAt: at(2, 10, 10), endedAt: at(2, 10, 40), patientId: 'p3' }),
      session({ createdAt: at(20, 10), patientId: 'p4' }),
    ];
    const week = computeStats(sessions, NOW, 7);
    expect(week.days).toHaveLength(7);
    expect(week.requests).toBe(3);
    expect(week.days[6].requests).toBe(2);
    expect(week.days[4].requests).toBe(1);
    expect(week.days[4].completed).toBe(1);
    const month = computeStats(sessions, NOW, 30);
    expect(month.requests).toBe(4);
  });

  it('เวลารอและเวลาปรึกษาเฉลี่ย ไม่มีข้อมูลคืน null ไม่ใช่ 0', () => {
    expect(computeStats([], NOW, 7).avgWaitMinutes).toBeNull();
    expect(computeStats([], NOW, 7).completionRate).toBeNull();
    const stats = computeStats(
      [
        session({ status: 'completed', createdAt: at(1, 9), startedAt: at(1, 9, 10), endedAt: at(1, 9, 40) }),
        session({ status: 'completed', createdAt: at(1, 11), startedAt: at(1, 11, 30), endedAt: at(1, 12, 30) }),
      ],
      NOW,
      7
    );
    expect(stats.avgWaitMinutes).toBe(20);
    expect(stats.avgDurationMinutes).toBe(45);
  });

  it('อัตราปรึกษาจบนับจากเคสที่ปิดแล้วเท่านั้น', () => {
    const stats = computeStats(
      [session({ status: 'completed' }), session({ status: 'completed' }), session({ status: 'cancelled' }), session({ status: 'requested' })],
      NOW,
      7
    );
    expect(stats.completed).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.open).toBe(1);
    expect(stats.completionRate).toBeCloseTo(2 / 3);
  });

  it('นับผู้ใช้ไม่ซ้ำ ผู้ใช้ที่กลับมา ช่องทาง ชั่วโมงที่คนเข้ามากสุด และภาระงานรายคน', () => {
    const stats = computeStats(
      [
        session({ patientId: 'a', createdAt: at(0, 10), channel: 'voice' }),
        session({ patientId: 'a', createdAt: at(1, 10), status: 'completed', assignedName: 'ก', startedAt: at(1, 10, 1), endedAt: at(1, 11) }),
        session({ patientId: 'b', createdAt: at(1, 10), status: 'active', assignedName: 'ข' }),
        session({ patientId: 'c', createdAt: at(1, 16), assignedName: 'ก', status: 'completed', startedAt: at(1, 16, 1), endedAt: at(1, 17) }),
      ],
      NOW,
      7
    );
    expect(stats.patients).toBe(3);
    expect(stats.returningPatients).toBe(1);
    expect(stats.byChannel).toEqual({ chat: 3, voice: 1, video: 0, appointment: 0 });
    expect(stats.peakHour).toBe(10);
    expect(stats.staff).toEqual([
      { name: 'ก', active: 0, completed: 2 },
      { name: 'ข', active: 1, completed: 0 },
    ]);
  });

  it('ไม่มีเคสเลยก็ไม่พัง', () => {
    const stats = computeStats([], NOW, 90);
    expect(stats.days).toHaveLength(90);
    expect(stats.requests).toBe(0);
    expect(stats.peakHour).toBeNull();
  });
});

describe('สถิติรีวิว', () => {
  const review = (stars: number, comment: string, createdAt: string): Review => ({ id: `${stars}${createdAt}`, stars, comment, createdAt });
  it('คำนวณค่าเฉลี่ย การกระจายดาว และเรียงความคิดเห็นล่าสุดก่อน', () => {
    const stats = computeReviewStats([review(5, 'ดีมาก', '2026-11-01T00:00:00Z'), review(3, '', '2026-11-02T00:00:00Z'), review(5, 'เร็ว', '2026-11-03T00:00:00Z')]);
    expect(stats.count).toBe(3);
    expect(stats.average).toBeCloseTo(13 / 3);
    expect(stats.distribution).toEqual([0, 0, 1, 0, 2]);
    expect(stats.withComment.map((r) => r.comment)).toEqual(['เร็ว', 'ดีมาก']);
  });
  it('ไม่มีรีวิวไม่มีค่าเฉลี่ย', () => {
    expect(computeReviewStats([]).average).toBeNull();
  });
});

describe('ข้อความระยะเวลา', () => {
  it('แปลงเป็นนาที ชั่วโมง วัน', () => {
    expect(durationText(null)).toBe('ยังไม่มีข้อมูล');
    expect(durationText(0.2)).toBe('ไม่ถึง 1 นาที');
    expect(durationText(45)).toBe('45 นาที');
    expect(durationText(130)).toBe('2 ชม. 10 นาที');
    expect(durationText(60 * 30)).toBe('1 วัน 6 ชม.');
  });
});
