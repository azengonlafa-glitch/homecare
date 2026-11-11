import type { VitalReading } from './members';

/**
 * ค่าสุขภาพเพิ่มเติมที่บันทึกได้ และตัวช่วยทำกราฟแนวโน้ม
 *
 * หมายเหตุ: ช่วง min/max ใช้ตรวจว่า "พิมพ์ผิดหรือไม่" เท่านั้น (เช่น ใส่ 720 แทน 72)
 * ไม่ใช่เกณฑ์ปกติ/ผิดปกติ ระบบจึงไม่ตัดสินว่าค่าใดดีหรือไม่ดี แสดงเฉพาะการเปลี่ยนแปลงตามเวลา
 */

export type ExtraMetricKey = 'pulse' | 'spo2' | 'temp' | 'hba1c' | 'waist' | 'pain' | 'sleep';

export interface ExtraMetric {
  key: ExtraMetricKey;
  field: 'pulseBpm' | 'spo2' | 'tempC' | 'hba1c' | 'waistCm' | 'painScore' | 'sleepHours';
  label: string;
  unit: string;
  decimals: number;
  step: number;
  /** ช่วงที่เป็นไปได้ ใช้กันพิมพ์ผิด */
  min: number;
  max: number;
  placeholder: string;
  color: string;
}

export const EXTRA_METRICS: ExtraMetric[] = [
  { key: 'pulse', field: 'pulseBpm', label: 'ชีพจร', unit: 'ครั้ง/นาที', decimals: 0, step: 1, min: 20, max: 250, placeholder: 'เช่น 72', color: '#E5557A' },
  { key: 'spo2', field: 'spo2', label: 'ออกซิเจนในเลือด (SpO₂)', unit: '%', decimals: 0, step: 1, min: 50, max: 100, placeholder: 'เช่น 98', color: '#2B9FD6' },
  { key: 'temp', field: 'tempC', label: 'อุณหภูมิร่างกาย', unit: '°C', decimals: 1, step: 0.1, min: 30, max: 45, placeholder: 'เช่น 36.8', color: '#E8913A' },
  { key: 'hba1c', field: 'hba1c', label: 'น้ำตาลสะสม (HbA1c)', unit: '%', decimals: 1, step: 0.1, min: 3, max: 20, placeholder: 'เช่น 6.5', color: '#8A63D2' },
  { key: 'waist', field: 'waistCm', label: 'รอบเอว', unit: 'ซม.', decimals: 1, step: 0.5, min: 30, max: 250, placeholder: 'เช่น 82', color: '#1FA38A' },
  { key: 'pain', field: 'painScore', label: 'ระดับความปวด', unit: '/10', decimals: 0, step: 1, min: 0, max: 10, placeholder: '0-10', color: '#D9534F' },
  { key: 'sleep', field: 'sleepHours', label: 'ชั่วโมงนอน', unit: 'ชม.', decimals: 1, step: 0.5, min: 0, max: 24, placeholder: 'เช่น 7', color: '#5051C3' },
];

export interface TrendPoint {
  /** เวลา (ms) */
  t: number;
  v: number;
}

/** จุดข้อมูลเรียงจากเก่าไปใหม่ (ข้ามครั้งที่ไม่มีค่านั้น) */
export function seriesOf(
  readings: VitalReading[],
  pick: (r: VitalReading) => number | null | undefined
): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const r of readings) {
    const v = pick(r);
    const t = new Date(r.at).getTime();
    if (v == null || !Number.isFinite(v) || !Number.isFinite(t)) continue;
    out.push({ t, v });
  }
  return out.sort((a, b) => a.t - b.t);
}

export interface TrendSummary {
  count: number;
  first: number;
  last: number;
  /** last - first (ปัดทศนิยมตาม decimals) */
  delta: number;
  direction: 'up' | 'down' | 'flat';
}

export function summarize(points: TrendPoint[], decimals = 1): TrendSummary | null {
  if (points.length === 0) return null;
  const first = points[0].v;
  const last = points[points.length - 1].v;
  const f = 10 ** decimals;
  const delta = Math.round((last - first) * f) / f;
  return { count: points.length, first, last, delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}
