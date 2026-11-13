import type { OnboardingProfile } from './onboarding';

/**
 * เทียบข้อมูลโปรไฟล์กับเกณฑ์ที่มีแหล่งอ้างอิง (ไม่ใช่การวินิจฉัยโรค) ที่มาทั้งหมด: docs/HEALTH_CRITERIA_AND_LEGAL.pdf (ต้นฉบับ .html)
 * - BMI: WHO ภูมิภาคแปซิฟิกตะวันตก 2000 (เกณฑ์เอเชีย) ใช้กับอายุ 19 ปีขึ้นไป อายุน้อยกว่านี้ต้องใช้ BMI ตามอายุ (WHO 2007)
 * - ความดัน: เกณฑ์วัดที่บ้าน Thai Hypertension Society 2022 (ตรงกับ classifyBp ใน memberDashboard.ts)
 * - น้ำตาลตอนอดอาหาร: ADA Standards of Care 2025
 * ไม่มีคะแนนรวม: ไม่มีมาตรฐานใดรองรับการรวมหลายค่าเป็นคะแนนเดียว
 */

export type Tone = 'good' | 'warn' | 'bad';

export interface Zone {
  from: number;
  to: number;
  label: string;
  tone: Tone;
}

export interface GaugeSpec {
  key: string;
  title: string;
  unit: string;
  min: number;
  max: number;
  zones: Zone[];
  decimals: number;
}

export const BMI_GAUGE: GaugeSpec = {
  key: 'bmi',
  title: 'ดัชนีมวลกาย (BMI)',
  unit: 'กก./ตร.ม.',
  min: 15,
  max: 35,
  decimals: 1,
  zones: [
    { from: 15, to: 18.5, label: 'ผอม', tone: 'warn' },
    { from: 18.5, to: 23, label: 'สมส่วน', tone: 'good' },
    { from: 23, to: 25, label: 'ท้วม', tone: 'warn' },
    { from: 25, to: 30, label: 'อ้วน', tone: 'bad' },
    { from: 30, to: 35, label: 'อ้วนมาก', tone: 'bad' },
  ],
};

export const SYSTOLIC_GAUGE: GaugeSpec = {
  key: 'systolic',
  title: 'ความดันตัวบน',
  unit: 'mmHg',
  min: 70,
  max: 200,
  decimals: 0,
  zones: [
    { from: 70, to: 90, label: 'ต่ำ', tone: 'warn' },
    { from: 90, to: 125, label: 'ปกติ', tone: 'good' },
    { from: 125, to: 135, label: 'สูงกว่าปกติเล็กน้อย', tone: 'warn' },
    { from: 135, to: 180, label: 'สูง', tone: 'bad' },
    { from: 180, to: 200, label: 'สูงมาก', tone: 'bad' },
  ],
};

export const DIASTOLIC_GAUGE: GaugeSpec = {
  key: 'diastolic',
  title: 'ความดันตัวล่าง',
  unit: 'mmHg',
  min: 40,
  max: 120,
  decimals: 0,
  zones: [
    { from: 40, to: 60, label: 'ต่ำ', tone: 'warn' },
    { from: 60, to: 75, label: 'ปกติ', tone: 'good' },
    { from: 75, to: 85, label: 'สูงกว่าปกติเล็กน้อย', tone: 'warn' },
    { from: 85, to: 110, label: 'สูง', tone: 'bad' },
    { from: 110, to: 120, label: 'สูงมาก', tone: 'bad' },
  ],
};

export const GLUCOSE_GAUGE: GaugeSpec = {
  key: 'glucose',
  title: 'น้ำตาลในเลือดตอนอดอาหาร',
  unit: 'มก./ดล.',
  min: 50,
  max: 180,
  decimals: 0,
  zones: [
    { from: 50, to: 70, label: 'ต่ำ', tone: 'warn' },
    { from: 70, to: 100, label: 'ปกติ', tone: 'good' },
    { from: 100, to: 126, label: 'สูงกว่าปกติ', tone: 'warn' },
    { from: 126, to: 180, label: 'สูง ควรตรวจยืนยัน', tone: 'bad' },
  ],
};

export const zoneOf = (spec: GaugeSpec, value: number): Zone => {
  if (value < spec.zones[0].from) return spec.zones[0];
  return spec.zones.find((z) => value >= z.from && value < z.to) ?? spec.zones[spec.zones.length - 1];
};

const toNumber = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export const ageOf = (p: OnboardingProfile): number | null => {
  if (!/^\d{4}$/.test(p.birthYear)) return null;
  const age = new Date().getFullYear() + 543 - Number(p.birthYear);
  return age >= 0 && age <= 120 ? age : null;
};

export const bmiOf = (p: OnboardingProfile): number | null => {
  const h = toNumber(p.heightCm);
  const w = toNumber(p.weightKg);
  if (!h || !w || h < 30) return null;
  return Math.round((w / (h / 100) ** 2) * 10) / 10;
};

/** ช่วงน้ำหนักที่สมส่วน (BMI 18.5–22.9) สำหรับส่วนสูงนี้ */
export const healthyWeightRange = (p: OnboardingProfile): [number, number] | null => {
  const h = toNumber(p.heightCm);
  if (!h || h < 30) return null;
  const m2 = (h / 100) ** 2;
  return [Math.round(18.5 * m2 * 10) / 10, Math.round(22.9 * m2 * 10) / 10];
};

export const vitalsOf = (p: OnboardingProfile) => ({
  systolic: toNumber(p.systolic),
  diastolic: toNumber(p.diastolic),
  glucose: toNumber(p.fastingGlucose),
});

/** BMI แบบผู้ใหญ่ใช้กับอายุ 19 ปีขึ้นไป (WHO growth reference 2007 ครอบคลุม 5–19 ปี) */
export const ADULT_BMI_AGE = 19;
export const isAdultForBmi = (p: OnboardingProfile): boolean => {
  const age = ageOf(p);
  return age === null || age >= ADULT_BMI_AGE;
};

const isDiabetic = (p: OnboardingProfile) => p.conditions.some((c) => c.includes('เบาหวาน'));

const worstZone = (zones: (Zone | null)[]): Zone | null =>
  zones.filter((z): z is Zone => z !== null).sort((x, y) => rank(y.tone) - rank(x.tone))[0] ?? null;

// ---------- รายการเทียบกับเกณฑ์ (แทนคะแนนรวมเดิมที่ไม่มีมาตรฐานรองรับ) ----------

export interface CheckItem {
  key: string;
  label: string;
  /** ค่าของผู้ใช้ หรือ null = ยังไม่มีข้อมูล */
  value: string | null;
  /** สถานะเทียบเกณฑ์ (null = ไม่มีเกณฑ์ให้ตัดสิน แสดงแค่คำแนะนำ) */
  status: string | null;
  tone: Tone | null;
  /** เกณฑ์และที่มาแบบสั้น */
  standard: string;
}

export function checklist(p: OnboardingProfile): CheckItem[] {
  const bmi = bmiOf(p);
  const adult = isAdultForBmi(p);
  const { systolic, diastolic, glucose } = vitalsOf(p);
  const bpZone = worstZone([
    systolic !== null ? zoneOf(SYSTOLIC_GAUGE, systolic) : null,
    diastolic !== null ? zoneOf(DIASTOLIC_GAUGE, diastolic) : null,
  ]);
  const diabetic = isDiabetic(p);

  let glu: { status: string; tone: Tone } | null = null;
  if (glucose !== null) {
    if (glucose < 54) glu = { status: 'ต่ำมาก', tone: 'bad' };
    else if (glucose < 70) glu = { status: 'ต่ำ', tone: 'warn' };
    else if (diabetic) glu = glucose > 130 ? { status: 'สูงกว่าเป้าทั่วไป', tone: 'warn' } : { status: 'ตามเป้าทั่วไป', tone: 'good' };
    else {
      const z = zoneOf(GLUCOSE_GAUGE, glucose);
      glu = { status: z.label, tone: z.tone };
    }
  }

  const drinks = !!p.alcohol && p.alcohol !== 'ไม่ดื่ม';
  const lowExercise = p.exercise.startsWith('แทบไม่');
  return [
    {
      key: 'weight',
      label: 'น้ำหนัก (BMI)',
      value: bmi === null ? null : `BMI ${bmi}`,
      status: bmi === null ? null : adult ? zoneOf(BMI_GAUGE, bmi).label : 'อายุต่ำกว่า 19 ปี ต้องใช้เกณฑ์ตามอายุ',
      tone: bmi === null || !adult ? null : zoneOf(BMI_GAUGE, bmi).tone,
      standard: 'เกณฑ์เอเชีย-แปซิฟิก (WHO 2000) สมส่วน 18.5–22.9',
    },
    {
      key: 'bp',
      label: 'ความดัน',
      value: systolic === null && diastolic === null ? null : `${systolic ?? '–'}/${diastolic ?? '–'} mmHg`,
      status: bpZone?.label ?? null,
      tone: bpZone?.tone ?? null,
      standard: 'วัดที่บ้าน (สมาคมความดันโลหิตสูงแห่งประเทศไทย 2022) ปกติต่ำกว่า 125/75 ดูจากค่าเฉลี่ย 7 วัน',
    },
    {
      key: 'glucose',
      label: 'น้ำตาลตอนอดอาหาร',
      value: glucose === null ? null : `${glucose} มก./ดล.`,
      status: glu?.status ?? null,
      tone: glu?.tone ?? null,
      standard: diabetic
        ? 'ADA 2025 เป้าทั่วไปก่อนอาหาร 80–130 (แพทย์อาจตั้งเป้าต่างไป)'
        : 'ADA 2025 ปกติต่ำกว่า 100 · ค่าจากปลายนิ้วต้องตรวจยืนยันที่สถานพยาบาล',
    },
    {
      key: 'exercise',
      label: 'ออกกำลังกาย',
      value: p.exercise || null,
      status: lowExercise ? 'น้อยกว่าที่แนะนำ' : null,
      tone: lowExercise ? 'warn' : null,
      standard: 'WHO 2020 แนะนำระดับปานกลาง 150–300 นาทีต่อสัปดาห์',
    },
    {
      key: 'smoking',
      label: 'บุหรี่',
      value: p.smoking || null,
      status: p.smoking === 'สูบอยู่' ? 'ควรเลิก' : null,
      tone: p.smoking === 'สูบอยู่' ? 'bad' : p.smoking ? 'good' : null,
      standard: 'ปรึกษาเลิกบุหรี่ฟรี สายด่วน 1600',
    },
    {
      key: 'alcohol',
      label: 'แอลกอฮอล์',
      value: p.alcohol || null,
      status: drinks ? 'ไม่มีปริมาณที่ปลอดภัย' : null,
      tone: drinks ? 'warn' : p.alcohol ? 'good' : null,
      standard: 'WHO 2023 ไม่มีปริมาณการดื่มที่ปลอดภัยต่อสุขภาพ',
    },
  ];
}

// ---------- ข้อสังเกต ----------

export interface Insight {
  tone: Tone;
  text: string;
}

export function buildInsights(p: OnboardingProfile): Insight[] {
  const out: Insight[] = [];
  const bmi = bmiOf(p);
  const range = healthyWeightRange(p);
  const weight = toNumber(p.weightKg);
  const { systolic, diastolic, glucose } = vitalsOf(p);

  if (bmi !== null && isAdultForBmi(p)) {
    const zone = zoneOf(BMI_GAUGE, bmi);
    if (zone.tone === 'good') {
      out.push({ tone: 'good', text: `BMI ${bmi} อยู่ในช่วงสมส่วน รักษาน้ำหนักนี้ไว้` });
    } else if (range && weight !== null) {
      const diff = weight > range[1] ? weight - range[1] : range[0] - weight;
      out.push({
        tone: zone.tone,
        text: `BMI ${bmi} อยู่ในช่วง “${zone.label}” น้ำหนักที่เหมาะกับส่วนสูงของคุณคือ ${range[0]}–${range[1]} กก. ${
          weight > range[1] ? 'เกิน' : 'ต่ำกว่า'
        }ประมาณ ${Math.round(diff * 10) / 10} กก.`,
      });
    }
  }

  if (systolic !== null || diastolic !== null) {
    const zs = systolic !== null ? zoneOf(SYSTOLIC_GAUGE, systolic) : null;
    const zd = diastolic !== null ? zoneOf(DIASTOLIC_GAUGE, diastolic) : null;
    const worst = [zs, zd].filter((z): z is Zone => z !== null).sort((a, b) => rank(b.tone) - rank(a.tone))[0];
    out.push({
      tone: worst.tone,
      text:
        worst.tone === 'good'
          ? 'ความดันโลหิตอยู่ในเกณฑ์ปกติ'
          : worst.label === 'ต่ำ'
            ? 'ความดันค่อนข้างต่ำ ถ้ามีอาการหน้ามืด เวียนหัว หรือเป็นลมบ่อย ควรปรึกษาแพทย์'
            : `ความดันอยู่ในช่วง “${worst.label}” ค่าครั้งเดียวยังสรุปไม่ได้ แนวทางให้วัดเช้าและก่อนนอน 7 วันแล้วดูค่าเฉลี่ย ถ้าค่าเฉลี่ยสูงควรปรึกษาแพทย์`,
    });
  }

  if (glucose !== null) {
    const zone = zoneOf(GLUCOSE_GAUGE, glucose);
    const diabetic = isDiabetic(p);
    out.push({
      tone: zone.tone,
      text:
        zone.tone === 'good'
          ? 'น้ำตาลตอนอดอาหารอยู่ในเกณฑ์ปกติ'
          : diabetic
            ? `น้ำตาลตอนอดอาหาร ${glucose} มก./ดล. เป้าทั่วไปของผู้เป็นเบาหวานคือ 80–130 แต่ให้ใช้เป้าที่แพทย์กำหนด`
            : `น้ำตาลตอนอดอาหารอยู่ในช่วง “${zone.label}” ค่าจากเครื่องเจาะปลายนิ้วใช้วินิจฉัยไม่ได้ ควรตรวจยืนยันที่สถานพยาบาล`,
    });
  }

  if (p.smoking === 'สูบอยู่') {
    out.push({
      tone: 'bad',
      text: 'การสูบบุหรี่เพิ่มความเสี่ยงโรคหัวใจ หลอดเลือด และปอด ขอคำปรึกษาเลิกบุหรี่ได้ที่สายด่วน 1600',
    });
  }
  if (p.alcohol && p.alcohol !== 'ไม่ดื่ม') {
    out.push({ tone: 'warn', text: 'องค์การอนามัยโลกระบุว่าไม่มีปริมาณการดื่มแอลกอฮอล์ที่ปลอดภัยต่อสุขภาพ ยิ่งดื่มน้อยยิ่งดี' });
  }
  if (p.exercise.startsWith('แทบไม่')) {
    out.push({
      tone: 'warn',
      text: 'องค์การอนามัยโลกแนะนำออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์ เริ่มจากเดินวันละ 15–20 นาทีก็ช่วยได้',
    });
  } else if (p.exercise.startsWith('3')) {
    out.push({ tone: 'good', text: 'ออกกำลังกายสม่ำเสมอ องค์การอนามัยโลกแนะนำรวมให้ได้ 150–300 นาทีต่อสัปดาห์' });
  }

  // โรคในครอบครัวที่ควรตรวจเพิ่ม
  const family = p.familyHistory.join(' ');
  if (family.includes('เบาหวาน') && glucose === null) {
    out.push({ tone: 'warn', text: 'ครอบครัวมีประวัติเบาหวาน ถ้าเคยตรวจน้ำตาล บันทึกค่าไว้ที่นี่ และปรึกษาแพทย์เรื่องการตรวจคัดกรอง' });
  }
  if ((family.includes('ความดัน') || family.includes('หัวใจ')) && systolic === null && diastolic === null) {
    out.push({ tone: 'warn', text: 'ครอบครัวมีประวัติโรคความดันหรือหัวใจ ถ้าเคยวัดความดัน บันทึกค่าไว้ที่นี่ และปรึกษาแพทย์เรื่องการตรวจคัดกรอง' });
  }

  return out;
}

const rank = (t: Tone) => (t === 'good' ? 0 : t === 'warn' ? 1 : 2);
