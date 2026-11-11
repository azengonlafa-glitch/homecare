import { describe, expect, it } from 'vitest';
import { computeStreak, nextStageOf, stageOf, streakDay } from './streak';
import { normalizeMed, todayKey, type DoseLog, type Medication } from './meds';
import { addDays } from './calendar';

const NOW = new Date(2026, 10, 9, 20, 0, 0); // 9 พ.ย. 2569 (ค.ศ. 2026) 20:00
const day = (offset: number) => todayKey(addDays(NOW, offset));

const med = (rest: Partial<Medication> = {}) =>
  normalizeMed({
    id: 'm1',
    name: 'ยาทดสอบ',
    periods: ['morning', 'evening'],
    startDate: day(-40),
    ...rest,
  });

const log = (offset: number, period: 'morning' | 'evening', status: DoseLog['status'] = 'taken', extra: Partial<DoseLog> = {}): DoseLog => ({
  date: day(offset),
  medId: 'm1',
  period,
  status,
  at: new Date().toISOString(),
  byId: 'me',
  byName: 'ฉัน',
  ...extra,
});

/** กินครบทุกมื้อของวันนั้น */
const fullDay = (offset: number) => [log(offset, 'morning'), log(offset, 'evening')];

describe('streakDay', () => {
  const meds = [med()];
  it('วันที่ผ่านมา: ครบ = ok, ขาดมื้อ = miss, ช้า = miss', () => {
    expect(streakDay(meds, fullDay(-1), day(-1), day(0)).state).toBe('ok');
    expect(streakDay(meds, [log(-1, 'morning')], day(-1), day(0)).state).toBe('miss');
    expect(streakDay(meds, [log(-1, 'morning', 'taken', { lateMinutes: 40 }), log(-1, 'evening')], day(-1), day(0)).state).toBe('miss');
  });
  it('งดตามแพทย์สั่งไม่ทำให้พลาด', () => {
    expect(streakDay(meds, [log(-1, 'morning'), log(-1, 'evening', 'skipped')], day(-1), day(0)).state).toBe('ok');
    expect(streakDay(meds, [log(-1, 'morning', 'skipped'), log(-1, 'evening', 'skipped')], day(-1), day(0)).state).toBe('rest');
  });
  it('วันนี้ยังไม่ครบ = pending ไม่ใช่ miss', () => {
    expect(streakDay(meds, [log(0, 'morning')], day(0), day(0)).state).toBe('pending');
  });
  it('วันนี้มีมื้อที่กินช้า = fail', () => {
    expect(streakDay(meds, [log(0, 'morning', 'taken', { lateMinutes: 30 })], day(0), day(0)).state).toBe('fail');
  });
  it('ไม่มียาในตารางวันนั้น = none', () => {
    expect(streakDay([med({ weekdays: [] , startDate: day(5) })], [], day(0), day(0)).state).toBe('none');
  });
});

describe('computeStreak', () => {
  const meds = [med()];

  it('สะสมได้เกิน 365 วันโดยไม่มีเพดาน (เช่น 1000 วัน)', () => {
    const longMeds = [med({ startDate: day(-999) })];
    const logs: DoseLog[] = [];
    for (let i = -999; i <= -1; i++) logs.push(...fullDay(i));
    const r = computeStreak(longMeds, logs, NOW);
    expect(r.current).toBe(999);
    expect(stageOf(r.current).id).toBe('purple');
    expect(nextStageOf(r.current)).toBeNull();
  });

  it('ยังไม่มีบันทึก = 0 ต้นไม้ยังเป็นดิน', () => {
    const r = computeStreak(meds, [], NOW);
    expect(r.current).toBe(0);
    expect(stageOf(r.current).id).toBe('empty');
  });

  it('กินครบ 3 วันที่ผ่านมา + วันนี้ยังไม่ครบ = 3 (วันนี้ไม่ตัดไฟ)', () => {
    const logs = [...fullDay(-3), ...fullDay(-2), ...fullDay(-1), log(0, 'morning')];
    expect(computeStreak(meds, logs, NOW).current).toBe(3);
  });

  it('วันนี้กินครบแล้ว = นับวันนี้ด้วย', () => {
    const logs = [...fullDay(-2), ...fullDay(-1), ...fullDay(0)];
    expect(computeStreak(meds, logs, NOW).current).toBe(3);
  });

  it('พลาดวันหนึ่งขณะไฟสั้นกว่า 3 วัน = เริ่มใหม่', () => {
    const logs = [...fullDay(-4), ...fullDay(-3), log(-2, 'morning'), ...fullDay(-1)];
    const r = computeStreak(meds, logs, NOW);
    expect(r.current).toBe(1);
    expect(r.recovering).toBeNull();
  });

  it('พลาด 1 วันหลังไฟ ≥ 3 วัน: เข้าโหมดกู้ ต้องกินครบอีก 2 วัน', () => {
    const logs = [...fullDay(-4), ...fullDay(-3), ...fullDay(-2), log(-1, 'morning')];
    const r = computeStreak(meds, logs, NOW);
    expect(r.current).toBe(0);
    expect(r.recovering).toEqual({ saved: 3, run: 0, need: 2 });
  });

  it('กินครบติดกัน 2 วันหลังพลาด = ได้ไฟเดิมคืน', () => {
    const logs = [...fullDay(-6), ...fullDay(-5), ...fullDay(-4), log(-3, 'morning'), ...fullDay(-2), ...fullDay(-1)];
    const r = computeStreak(meds, logs, NOW);
    expect(r.recovering).toBeNull();
    expect(r.current).toBe(3 + 2);
    expect(r.best).toBe(5);
  });

  it('พลาดซ้ำระหว่างกู้ = กู้ไม่สำเร็จ', () => {
    const logs = [...fullDay(-6), ...fullDay(-5), ...fullDay(-4), log(-3, 'morning'), ...fullDay(-2), log(-1, 'evening')];
    const r = computeStreak(meds, logs, NOW);
    expect(r.current).toBe(0);
    expect(r.recovering).toBeNull();
    expect(r.best).toBe(3);
  });

  it('มื้อที่งดตามแพทย์สั่งไม่ตัดไฟ', () => {
    const logs = [...fullDay(-2), log(-1, 'morning'), log(-1, 'evening', 'skipped')];
    expect(computeStreak(meds, logs, NOW).current).toBe(2);
  });

  it('กินช้าตัดไฟ', () => {
    const logs = [...fullDay(-2), log(-1, 'morning', 'taken', { lateMinutes: 45 }), log(-1, 'evening')];
    expect(computeStreak(meds, logs, NOW).current).toBe(0);
  });

  it('สรุป 7 วันล่าสุดเรียงเก่า → ใหม่ วันสุดท้ายคือวันนี้', () => {
    const r = computeStreak(meds, fullDay(-1), NOW);
    expect(r.week).toHaveLength(7);
    expect(r.week[6].date).toBe(day(0));
    expect(r.week[5].state).toBe('ok');
  });
});

describe('stageOf', () => {
  it('ระดับตามจำนวนวัน', () => {
    expect(stageOf(0).id).toBe('empty');
    expect(stageOf(1).id).toBe('seed');
    expect(stageOf(2).id).toBe('seed');
    expect(stageOf(3).id).toBe('sprout');
    expect(stageOf(7).id).toBe('sapling');
    expect(stageOf(14).id).toBe('apple');
    expect(stageOf(30).id).toBe('gold');
    expect(stageOf(60).id).toBe('red');
    expect(stageOf(120).id).toBe('darkred');
    expect(stageOf(240).id).toBe('blue');
    expect(stageOf(500).id).toBe('purple');
    expect(nextStageOf(500)).toBeNull();
    expect(nextStageOf(29)?.id).toBe('gold');
  });
});
