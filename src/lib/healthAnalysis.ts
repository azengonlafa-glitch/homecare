import type { OnboardingProfile } from './onboarding';

/**
 * วิเคราะห์สุขภาพเบื้องต้นจากข้อมูลโปรไฟล์ เทียบกับเกณฑ์ทั่วไปของคนสุขภาพดี
 * (BMI ตามเกณฑ์เอเชีย-แปซิฟิก, ความดันและน้ำตาลตามเกณฑ์สากล) ไม่ใช่การวินิจฉัยโรค
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
  max: 180,
  decimals: 0,
  zones: [
    { from: 70, to: 90, label: 'ต่ำ', tone: 'warn' },
    { from: 90, to: 120, label: 'ปกติ', tone: 'good' },
    { from: 120, to: 140, label: 'เริ่มสูง', tone: 'warn' },
    { from: 140, to: 180, label: 'สูง', tone: 'bad' },
  ],
};

export const DIASTOLIC_GAUGE: GaugeSpec = {
  key: 'diastolic',
  title: 'ความดันตัวล่าง',
  unit: 'mmHg',
  min: 40,
  max: 110,
  decimals: 0,
  zones: [
    { from: 40, to: 60, label: 'ต่ำ', tone: 'warn' },
    { from: 60, to: 80, label: 'ปกติ', tone: 'good' },
    { from: 80, to: 90, label: 'เริ่มสูง', tone: 'warn' },
    { from: 90, to: 110, label: 'สูง', tone: 'bad' },
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
    { from: 100, to: 126, label: 'เสี่ยงเบาหวาน', tone: 'warn' },
    { from: 126, to: 180, label: 'สูง', tone: 'bad' },
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

// ---------- คะแนนรายด้าน (0–100, 100 = เหมือนคนสุขภาพดี) ----------

const bmiScore = (bmi: number) => {
  if (bmi < 17) return 40;
  if (bmi < 18.5) return 65;
  if (bmi < 23) return 100;
  if (bmi < 25) return 75;
  if (bmi < 30) return 50;
  return 25;
};

const bpScore = (sys: number | null, dia: number | null): number | null => {
  const parts: number[] = [];
  if (sys !== null) parts.push(sys >= 160 ? 20 : sys >= 140 ? 45 : sys >= 120 ? 70 : sys >= 90 ? 100 : 65);
  if (dia !== null) parts.push(dia >= 100 ? 20 : dia >= 90 ? 45 : dia >= 80 ? 70 : dia >= 60 ? 100 : 65);
  return parts.length ? Math.min(...parts) : null;
};

const glucoseScore = (g: number) => (g >= 126 ? 25 : g >= 100 ? 60 : g >= 70 ? 100 : 60);

const exerciseScore = (v: string): number | null =>
  v.startsWith('3') ? 100 : v.startsWith('1') ? 65 : v ? 30 : null;

const smokingScore = (v: string): number | null =>
  v === 'ไม่สูบ' ? 100 : v === 'เคยสูบ เลิกแล้ว' ? 70 : v === 'สูบอยู่' ? 20 : null;

const alcoholScore = (v: string): number | null =>
  v === 'ไม่ดื่ม' ? 100 : v === 'นาน ๆ ครั้ง' ? 80 : v === 'ดื่มเป็นประจำ' ? 35 : null;

const conditionScore = (p: OnboardingProfile): number | null => {
  if (p.noConditions) return 100;
  if (p.conditions.length === 0) return null;
  return Math.max(25, 100 - 15 * p.conditions.length);
};

export interface AxisScore {
  key: string;
  label: string;
  /** null = ยังไม่มีข้อมูล */
  score: number | null;
  detail: string;
}

export function axisScores(p: OnboardingProfile): AxisScore[] {
  const bmi = bmiOf(p);
  const { systolic, diastolic, glucose } = vitalsOf(p);
  const smoke = smokingScore(p.smoking);
  const alcohol = alcoholScore(p.alcohol);
  const habit = [smoke, alcohol].filter((v): v is number => v !== null);

  return [
    {
      key: 'weight',
      label: 'น้ำหนัก',
      score: bmi === null ? null : bmiScore(bmi),
      detail: bmi === null ? 'ใส่ส่วนสูงและน้ำหนัก' : `BMI ${bmi} · ${zoneOf(BMI_GAUGE, bmi).label}`,
    },
    {
      key: 'bp',
      label: 'ความดัน',
      score: bpScore(systolic, diastolic),
      detail:
        systolic === null && diastolic === null
          ? 'ใส่ค่าความดันล่าสุด'
          : `${systolic ?? '–'}/${diastolic ?? '–'} mmHg`,
    },
    {
      key: 'glucose',
      label: 'น้ำตาล',
      score: glucose === null ? null : glucoseScore(glucose),
      detail: glucose === null ? 'ใส่ค่าน้ำตาลตอนอดอาหาร' : `${glucose} มก./ดล. · ${zoneOf(GLUCOSE_GAUGE, glucose).label}`,
    },
    {
      key: 'exercise',
      label: 'ออกกำลังกาย',
      score: exerciseScore(p.exercise),
      detail: p.exercise || 'ยังไม่ได้เลือก',
    },
    {
      key: 'habit',
      label: 'บุหรี่ / แอลกอฮอล์',
      score: habit.length ? Math.round(habit.reduce((a, b) => a + b, 0) / habit.length) : null,
      detail: [p.smoking, p.alcohol].filter(Boolean).join(' · ') || 'ยังไม่ได้เลือก',
    },
    {
      key: 'conditions',
      label: 'โรคประจำตัว',
      score: conditionScore(p),
      detail: p.noConditions
        ? 'ไม่มีโรคประจำตัว'
        : p.conditions.length
          ? `${p.conditions.length} โรค`
          : 'ยังไม่ได้ระบุ',
    },
  ];
}

export const overallScore = (axes: AxisScore[]): number | null => {
  const vals = axes.map((a) => a.score).filter((v): v is number => v !== null);
  if (vals.length < 3) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

export const scoreLabel = (score: number): { label: string; tone: Tone } =>
  score >= 85
    ? { label: 'ดีมาก', tone: 'good' }
    : score >= 70
      ? { label: 'ดี', tone: 'good' }
      : score >= 50
        ? { label: 'ควรดูแลเพิ่ม', tone: 'warn' }
        : { label: 'ควรปรึกษาแพทย์', tone: 'bad' };

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

  if (bmi !== null) {
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
          : `ความดันโลหิตอยู่ในช่วง “${worst.label}” ควรวัดซ้ำสม่ำเสมอ และปรึกษาแพทย์ถ้าสูงต่อเนื่อง`,
    });
  }

  if (glucose !== null) {
    const zone = zoneOf(GLUCOSE_GAUGE, glucose);
    const diabetic = p.conditions.some((c) => c.includes('เบาหวาน'));
    out.push({
      tone: zone.tone,
      text:
        zone.tone === 'good'
          ? 'น้ำตาลตอนอดอาหารอยู่ในเกณฑ์ปกติ'
          : diabetic
            ? `น้ำตาลตอนอดอาหาร ${glucose} มก./ดล. เกณฑ์นี้ใช้กับคนทั่วไป ผู้ที่เป็นเบาหวานให้ใช้เป้าหมายที่แพทย์กำหนด`
            : `น้ำตาลตอนอดอาหารอยู่ในช่วง “${zone.label}” ควรตรวจซ้ำและปรึกษาแพทย์`,
    });
  }

  if (p.smoking === 'สูบอยู่') {
    out.push({
      tone: 'bad',
      text: 'การสูบบุหรี่เพิ่มความเสี่ยงโรคหัวใจ หลอดเลือด และปอด ขอคำปรึกษาเลิกบุหรี่ได้ที่สายด่วน 1600',
    });
  }
  if (p.alcohol === 'ดื่มเป็นประจำ') {
    out.push({ tone: 'warn', text: 'การดื่มแอลกอฮอล์เป็นประจำกระทบตับและความดัน ลองลดปริมาณลง' });
  }
  if (p.exercise.startsWith('แทบไม่')) {
    out.push({
      tone: 'warn',
      text: 'องค์การอนามัยโลกแนะนำออกกำลังกายระดับปานกลางอย่างน้อย 150 นาทีต่อสัปดาห์ เริ่มจากเดินวันละ 15–20 นาทีก็ช่วยได้',
    });
  } else if (p.exercise.startsWith('3')) {
    out.push({ tone: 'good', text: 'ออกกำลังกายสม่ำเสมอ เป็นนิสัยที่ดีต่อหัวใจและน้ำหนัก' });
  }

  // โรคในครอบครัวที่ควรตรวจเพิ่ม
  const family = p.familyHistory.join(' ');
  if (family.includes('เบาหวาน') && glucose === null) {
    out.push({ tone: 'warn', text: 'ครอบครัวมีประวัติเบาหวาน ควรตรวจน้ำตาลในเลือดปีละครั้ง แล้วบันทึกค่าไว้ที่นี่' });
  }
  if ((family.includes('ความดัน') || family.includes('หัวใจ')) && systolic === null && diastolic === null) {
    out.push({ tone: 'warn', text: 'ครอบครัวมีประวัติโรคความดันหรือหัวใจ ควรวัดความดันสม่ำเสมอ แล้วบันทึกค่าไว้ที่นี่' });
  }

  return out;
}

const rank = (t: Tone) => (t === 'good' ? 0 : t === 'warn' ? 1 : 2);
