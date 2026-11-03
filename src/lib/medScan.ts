import { matchDrugInText, type DrugInfo } from '../data/drugDb';
import type { DosePeriod, MealTiming } from './meds';

/** สิ่งที่อ่านได้จากรูปซองยา ทุกช่องอาจว่างถ้าอ่านไม่เจอ ผู้ใช้ต้องตรวจก่อนบันทึก */
export interface ScanResult {
  rawText: string;
  drug?: DrugInfo;
  name?: string;
  perDose?: number;
  unit?: string;
  periods?: DosePeriod[];
  meal?: MealTiming;
  quantity?: number;
}

/** ย่อรูปให้ด้านยาวไม่เกิน maxSide เพื่อให้อ่านเร็วขึ้น */
async function shrink(file: File, maxSide = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('load-failed'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * อ่านตัวอักษรบนรูปซองยาด้วย OCR ในเบราว์เซอร์ (tesseract.js ภาษาไทย + อังกฤษ)
 * ครั้งแรกต้องดาวน์โหลดข้อมูลภาษาจากอินเทอร์เน็ต จึงช้าและต้องออนไลน์
 */
export async function scanMedPhoto(file: File, onProgress?: (percent: number) => void): Promise<ScanResult> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['tha', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const image = await shrink(file);
    const { data } = await worker.recognize(image);
    return parseLabelText(data.text ?? '');
  } finally {
    await worker.terminate();
  }
}

const UNIT_WORDS: [RegExp, string][] = [
  [/แคปซูล|capsule/i, 'แคปซูล'],
  [/ช้อนชา|tsp/i, 'ช้อนชา'],
  [/ช้อนโต๊ะ|tbsp/i, 'ช้อนโต๊ะ'],
  [/ซีซี|มล|ml/i, 'มล.'],
  [/หยด|drop/i, 'หยด'],
  [/พ่น|puff/i, 'พ่น'],
  [/ซอง/, 'ซอง'],
  [/เม็ด|tab/i, 'เม็ด'],
];

const unitOf = (word: string) => UNIT_WORDS.find(([re]) => re.test(word))?.[1];

const parseNumber = (s: string): number | undefined => {
  if (/ครึ่ง|½|1\/2/.test(s)) return 0.5;
  const thaiDigits = s.replace(/[๐-๙]/g, (c) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
  const n = parseFloat(thaiDigits);
  if (Number.isFinite(n)) return n;
  const words: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4 };
  return Object.entries(words).find(([w]) => s.includes(w))?.[1];
};

/** แยกข้อมูลยาจากข้อความบนซอง (ชื่อยา ขนาด ครั้งละ วันละกี่ครั้ง ช่วงเวลา ก่อน/หลังอาหาร จำนวน) */
export function parseLabelText(rawText: string): ScanResult {
  // OCR ภาษาไทยมักเว้นวรรคแทรกระหว่างตัวอักษร: ใช้แบบไม่มีช่องว่างเพื่อหาคำไทย
  const compact = rawText.replace(/[ \t]+/g, '');
  const result: ScanResult = { rawText };

  const drug = matchDrugInText(rawText) ?? matchDrugInText(compact);
  if (drug) result.drug = drug;

  const strength = rawText.match(/(\d+(?:[.,]\d+)?)\s*(mcg|µg|mg|ml|g|มิลลิกรัม|มก\.?)(?![a-z])/i);
  const strengthText = strength ? `${strength[1].replace(',', '.')} ${/มก|มิลลิกรัม/.test(strength[2]) ? 'mg' : strength[2].toLowerCase()}` : '';
  if (drug) result.name = [drug.generic, strengthText].filter(Boolean).join(' ');

  const dose = compact.match(/ครั้งละ([0-9๐-๙.]+|ครึ่ง|½|1\/2|หนึ่ง|สอง|สาม)(เม็ด|แคปซูล|ช้อนชา|ช้อนโต๊ะ|ซีซี|มล\.?|หยด|พ่น|ซอง)?/);
  if (dose) {
    result.perDose = parseNumber(dose[1]);
    if (dose[2]) result.unit = unitOf(dose[2]);
  }

  const periods = new Set<DosePeriod>();
  if (/เช้า/.test(compact)) periods.add('morning');
  if (/กลางวัน|เที่ยง/.test(compact)) periods.add('noon');
  if (/เย็น/.test(compact)) periods.add('evening');
  if (/ก่อนนอน/.test(compact)) periods.add('bedtime');
  if (periods.size === 0) {
    const times = compact.match(/วันละ([0-9๐-๙]|หนึ่ง|สอง|สาม|สี่)ครั้ง/);
    const n = times ? parseNumber(times[1]) : undefined;
    const byCount: Record<number, DosePeriod[]> = {
      1: ['morning'],
      2: ['morning', 'evening'],
      3: ['morning', 'noon', 'evening'],
      4: ['morning', 'noon', 'evening', 'bedtime'],
    };
    if (n && byCount[n]) byCount[n].forEach((p) => periods.add(p));
  }
  if (periods.size > 0) result.periods = [...periods];

  if (/ก่อนอาหาร/.test(compact)) result.meal = 'before';
  else if (/หลังอาหาร/.test(compact)) result.meal = 'after';
  else if (/พร้อมอาหาร/.test(compact)) result.meal = 'with';
  else if (drug?.meal) result.meal = drug.meal;

  const qty = compact.match(/(?:จำนวน|รวม|บรรจุ|qty)[:：]?([0-9๐-๙]+)(เม็ด|แคปซูล|ซอง|หลอด)?/i);
  if (qty) result.quantity = parseNumber(qty[1]);

  if (!result.unit && result.drug) {
    result.unit = result.drug.form === 'capsule' ? 'แคปซูล' : result.drug.form === 'tablet' ? 'เม็ด' : undefined;
  }
  return result;
}

/** มีข้อมูลที่ใช้ได้อย่างน้อยหนึ่งช่องไหม */
export const hasScanData = (r: ScanResult) =>
  !!(r.name || r.perDose || r.unit || r.periods?.length || r.meal || r.quantity);
