import type { VitalReading } from './members';

/**
 * รายการค่าสุขภาพทั้งหมดที่บันทึกได้ แบ่งเป็นหมวด และตัวช่วยทำกราฟแนวโน้ม
 *
 * หมายเหตุ: ช่วง min/max ใช้ตรวจว่า "พิมพ์ผิดหรือไม่" เท่านั้น (เช่น ใส่ 720 แทน 72)
 * ไม่ใช่เกณฑ์ปกติ/ผิดปกติ ระบบจึงไม่ตัดสินว่าค่าใดดีหรือไม่ดี แสดงเฉพาะการเปลี่ยนแปลงตามเวลา
 */

export type MetricCategoryId = 'vitals' | 'sugar' | 'body' | 'comfort' | 'intake' | 'lab';

export interface MetricCategory {
  id: MetricCategoryId;
  label: string;
  /** อธิบายสั้น ๆ ว่ามีค่าอะไรบ้าง */
  hint: string;
  /** สีพื้นไอคอน (คลาส Tailwind) */
  tint: string;
  /** หมวดที่ผู้ดูแลมืออาชีพหรือผลแล็บใช้เป็นหลัก */
  pro?: boolean;
}

export const METRIC_CATEGORIES: MetricCategory[] = [
  { id: 'vitals', label: 'สัญญาณชีพ', hint: 'ความดัน ชีพจร ไข้ ออกซิเจน', tint: 'bg-rose-100 text-rose-700' },
  { id: 'sugar', label: 'น้ำตาลในเลือด', hint: 'เจาะปลายนิ้ว หรือค่าน้ำตาลสะสม', tint: 'bg-amber-100 text-amber-700' },
  { id: 'body', label: 'ร่างกายและสัดส่วน', hint: 'น้ำหนัก ส่วนสูง รอบเอว', tint: 'bg-emerald-100 text-emerald-700' },
  { id: 'comfort', label: 'ความปวดและการนอน', hint: 'ปวดมากแค่ไหน นอนกี่ชั่วโมง', tint: 'bg-sky-100 text-sky-700' },
  { id: 'intake', label: 'การกินและขับถ่าย', hint: 'ดื่มน้ำ กินข้าว ขับถ่าย', tint: 'bg-teal-100 text-teal-700' },
  { id: 'lab', label: 'ผลตรวจเลือด', hint: 'ตัวเลขจากใบผลแล็บ', tint: 'bg-violet-100 text-violet-700', pro: true },
];

/** ช่องตัวเลขเดิมใน VitalReading (ค่าใหม่ที่ไม่มีช่องเฉพาะเก็บใน more) */
export type VitalField =
  | 'systolic'
  | 'diastolic'
  | 'glucose'
  | 'weightKg'
  | 'pulseBpm'
  | 'spo2'
  | 'tempC'
  | 'hba1c'
  | 'waistCm'
  | 'painScore'
  | 'sleepHours';

export interface ExtraMetric {
  key: string;
  /** ช่องเฉพาะใน VitalReading (ไม่มี = เก็บใน reading.more[key]) */
  field?: VitalField;
  label: string;
  unit: string;
  decimals: number;
  step: number;
  /** ช่วงที่เป็นไปได้ ใช้กันพิมพ์ผิด */
  min: number;
  max: number;
  placeholder: string;
  color: string;
  category: MetricCategoryId;
  /** หัวข้อย่อยในหมวด เช่น "ไขมันในเลือด" */
  group?: string;
}

const m = (
  category: MetricCategoryId,
  key: string,
  label: string,
  unit: string,
  decimals: number,
  min: number,
  max: number,
  placeholder: string,
  color: string,
  extra: Partial<ExtraMetric> = {}
): ExtraMetric => ({ category, key, label, unit, decimals, step: decimals ? 1 / 10 ** decimals : 1, min, max, placeholder, color, ...extra });

/** ค่าหลัก 4 ตัวที่มีการแสดงผลเฉพาะ (ความดันเป็นคู่ น้ำตาลมีช่วงที่ตรวจ น้ำหนักใช้คิด BMI) */
export const CORE_METRICS: ExtraMetric[] = [
  m('vitals', 'systolic', 'ความดันตัวบน', 'mmHg', 0, 40, 300, 'เช่น 125', '#15703A', { field: 'systolic' }),
  m('vitals', 'diastolic', 'ความดันตัวล่าง', 'mmHg', 0, 20, 200, 'เช่น 80', '#E5557A', { field: 'diastolic' }),
  m('sugar', 'glucose', 'ค่าน้ำตาลในเลือด', 'มก./ดล.', 0, 10, 800, 'เช่น 105', '#E8913A', { field: 'glucose' }),
  m('body', 'weight', 'น้ำหนัก', 'กก.', 1, 2, 400, 'เช่น 58.5', '#1FA38A', { field: 'weightKg' }),
];

/** ค่าอื่นทั้งหมด (แสดงเป็นกราฟรายตัว) */
export const EXTRA_METRICS: ExtraMetric[] = [
  // สัญญาณชีพ
  m('vitals', 'pulse', 'ชีพจร', 'ครั้ง/นาที', 0, 20, 250, 'เช่น 72', '#E5557A', { field: 'pulseBpm' }),
  m('vitals', 'rr', 'อัตราการหายใจ', 'ครั้ง/นาที', 0, 4, 80, 'เช่น 18', '#0EA5A4'),
  m('vitals', 'temp', 'อุณหภูมิร่างกาย', '°C', 1, 30, 45, 'เช่น 36.8', '#E8913A', { field: 'tempC' }),
  m('vitals', 'spo2', 'ออกซิเจนในเลือด (SpO₂)', '%', 0, 50, 100, 'เช่น 98', '#2B9FD6', { field: 'spo2' }),
  // น้ำตาล
  m('sugar', 'hba1c', 'น้ำตาลสะสม (HbA1c)', '%', 1, 3, 20, 'เช่น 6.5', '#8A63D2', { field: 'hba1c' }),
  // ร่างกาย
  m('body', 'height', 'ส่วนสูง', 'ซม.', 1, 30, 250, 'เช่น 160', '#4C6049'),
  m('body', 'waist', 'รอบเอว', 'ซม.', 1, 30, 250, 'เช่น 82', '#1FA38A', { field: 'waistCm' }),
  m('body', 'hip', 'รอบสะโพก', 'ซม.', 1, 30, 250, 'เช่น 95', '#5DBB7C'),
  m('body', 'bodyfat', 'ไขมันในร่างกาย', '%', 1, 2, 75, 'เช่น 28', '#D97706'),
  // ความปวดและการนอน
  m('comfort', 'pain', 'ระดับความปวด', '/10', 0, 0, 10, '0-10', '#D9534F', { field: 'painScore' }),
  m('comfort', 'sleep', 'ชั่วโมงนอน', 'ชม.', 1, 0, 24, 'เช่น 7', '#2F7FB8', { field: 'sleepHours', step: 0.5 }),
  // การกินและขับถ่าย
  m('intake', 'water', 'น้ำที่ดื่มทั้งวัน', 'มล.', 0, 0, 10000, 'เช่น 1500', '#2B9FD6', { step: 50 }),
  m('intake', 'mealPct', 'กินอาหารได้', '% ของมื้อ', 0, 0, 100, 'เช่น 75', '#E8913A', { step: 5 }),
  m('intake', 'urineMl', 'ปริมาณปัสสาวะ', 'มล.', 0, 0, 10000, 'เช่น 1200', '#C9A227', { step: 50 }),
  m('intake', 'urineCount', 'ปัสสาวะ', 'ครั้ง', 0, 0, 50, 'เช่น 6', '#B8860B'),
  m('intake', 'stool', 'ขับถ่ายอุจจาระ', 'ครั้ง', 0, 0, 20, 'เช่น 1', '#8B5E3C'),
  // ผลตรวจเลือด
  m('lab', 'chol', 'คอเลสเตอรอลรวม', 'มก./ดล.', 0, 50, 600, 'เช่น 190', '#D97706', { group: 'ไขมันในเลือด' }),
  m('lab', 'ldl', 'ไขมัน LDL', 'มก./ดล.', 0, 10, 400, 'เช่น 110', '#DC2626', { group: 'ไขมันในเลือด' }),
  m('lab', 'hdl', 'ไขมัน HDL', 'มก./ดล.', 0, 5, 200, 'เช่น 50', '#16A34A', { group: 'ไขมันในเลือด' }),
  m('lab', 'tg', 'ไตรกลีเซอไรด์', 'มก./ดล.', 0, 10, 3000, 'เช่น 140', '#CA8A04', { group: 'ไขมันในเลือด' }),
  m('lab', 'cr', 'ครีเอตินิน (Creatinine)', 'มก./ดล.', 2, 0.1, 20, 'เช่น 0.9', '#7C3AED', { group: 'การทำงานของไต' }),
  m('lab', 'egfr', 'eGFR', 'มล./นาที/1.73ม²', 0, 1, 200, 'เช่น 85', '#6D28D9', { group: 'การทำงานของไต' }),
  m('lab', 'bun', 'BUN', 'มก./ดล.', 0, 1, 200, 'เช่น 14', '#8B5CF6', { group: 'การทำงานของไต' }),
  m('lab', 'uric', 'กรดยูริก', 'มก./ดล.', 1, 0.5, 20, 'เช่น 6.0', '#A855F7', { group: 'การทำงานของไต' }),
  m('lab', 'ast', 'AST (SGOT)', 'U/L', 0, 1, 5000, 'เช่น 25', '#0891B2', { group: 'การทำงานของตับ' }),
  m('lab', 'alt', 'ALT (SGPT)', 'U/L', 0, 1, 5000, 'เช่น 22', '#0E7490', { group: 'การทำงานของตับ' }),
  m('lab', 'hb', 'ฮีโมโกลบิน (Hb)', 'ก./ดล.', 1, 2, 25, 'เช่น 13.2', '#B91C1C', { group: 'เม็ดเลือด' }),
  m('lab', 'wbc', 'เม็ดเลือดขาว (WBC)', '×10³/ไมโครลิตร', 1, 0.1, 100, 'เช่น 7.2', '#64748B', { group: 'เม็ดเลือด' }),
  m('lab', 'plt', 'เกล็ดเลือด (Platelet)', '×10³/ไมโครลิตร', 0, 1, 2000, 'เช่น 250', '#BE185D', { group: 'เม็ดเลือด' }),
  m('lab', 'na', 'โซเดียม (Na)', 'มิลลิโมล/ลิตร', 0, 100, 180, 'เช่น 140', '#0369A1', { group: 'เกลือแร่และการแข็งตัวของเลือด' }),
  m('lab', 'k', 'โพแทสเซียม (K)', 'มิลลิโมล/ลิตร', 1, 1, 10, 'เช่น 4.1', '#15803D', { group: 'เกลือแร่และการแข็งตัวของเลือด' }),
  m('lab', 'inr', 'INR', '', 1, 0.5, 15, 'เช่น 2.5', '#9F1239', { group: 'เกลือแร่และการแข็งตัวของเลือด' }),
];

/** ทุกค่า เรียงตามหมวด ใช้สร้างช่องกรอก */
export const ALL_METRICS: ExtraMetric[] = [...CORE_METRICS, ...EXTRA_METRICS];

export const categoryOf = (id: MetricCategoryId) => METRIC_CATEGORIES.find((c) => c.id === id) as MetricCategory;

/** ชื่อสั้นสำหรับป้าย (ตัดวงเล็บท้ายออก) */
export const shortLabel = (metric: ExtraMetric) => metric.label.replace(/\s*\(.*\)$/, '');

/** อ่านค่าของตัวชี้วัดนี้จากการวัดครั้งหนึ่ง */
export function metricValue(
  r: Partial<Pick<VitalReading, VitalField | 'more'>>,
  metric: ExtraMetric
): number | undefined {
  const v = metric.field ? r[metric.field] : r.more?.[metric.key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** ข้อความค่า + หน่วย เช่น "36.8 °C" */
export const formatMetric = (metric: ExtraMetric, v: number) =>
  `${v.toLocaleString('th-TH', { minimumFractionDigits: metric.decimals, maximumFractionDigits: metric.decimals })}${metric.unit ? (metric.unit.startsWith('/') ? metric.unit : ` ${metric.unit}`) : ''}`;

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
