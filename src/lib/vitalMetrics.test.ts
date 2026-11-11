import { describe, expect, it } from 'vitest';
import { seriesOf, summarize } from './vitalMetrics';
import type { VitalReading } from './members';

const r = (id: string, at: string, rest: Partial<VitalReading>): VitalReading => ({ id, at, ...rest });

describe('seriesOf', () => {
  it('เรียงจากเก่าไปใหม่และข้ามครั้งที่ไม่มีค่านั้น', () => {
    const list = [
      r('b', '2026-11-05T08:00:00.000Z', { pulseBpm: 80 }),
      r('a', '2026-11-01T08:00:00.000Z', { pulseBpm: 70 }),
      r('c', '2026-11-03T08:00:00.000Z', { weightKg: 60 }),
    ];
    expect(seriesOf(list, (x) => x.pulseBpm).map((p) => p.v)).toEqual([70, 80]);
  });
});

describe('summarize', () => {
  it('คำนวณการเปลี่ยนแปลงจากครั้งแรกถึงล่าสุด', () => {
    const pts = [
      { t: 1, v: 60.5 },
      { t: 2, v: 59.7 },
    ];
    expect(summarize(pts, 1)).toMatchObject({ first: 60.5, last: 59.7, delta: -0.8, direction: 'down', count: 2 });
  });
  it('ไม่มีข้อมูลคืน null และค่าเท่าเดิมคือ flat', () => {
    expect(summarize([])).toBeNull();
    expect(summarize([{ t: 1, v: 5 }, { t: 2, v: 5 }])?.direction).toBe('flat');
  });
});
