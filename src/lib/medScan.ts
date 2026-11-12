import { matchDrugInText, type DrugInfo } from '../data/drugDb';
import type { DosePeriod, MealTiming } from './meds';

/**
 * อ่านซองยา/ฉลากยาจากรูปถ่าย ทั้งหมดทำในเครื่อง (tesseract.js) รูปไม่ถูกส่งออกไปไหน
 *
 * ขั้นตอน: ปรับภาพให้ชัด (ขาวดำ ยืดความต่างสี ขยายรูปเล็ก) -> อ่านตัวอักษรไทย+อังกฤษ
 * -> ถ้าไม่เจออะไรเลย ลองหมุนรูป (ฉลากมักถูกถ่ายตะแคง) -> แยกข้อมูลด้วยตัวจับคำที่ทนตัวอักษรเพี้ยนของ OCR
 * ผลทุกช่องเป็นแค่ "คำแนะนำ" ผู้ใช้ต้องตรวจก่อนบันทึกเสมอ
 */

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
  /** ฉลากบอกว่าใช้เมื่อมีอาการ (ไม่มีเวลาประจำ) */
  asNeeded?: boolean;
  /** ความมั่นใจของ OCR 0-100 (ต่ำ = รูปไม่ชัด ควรตรวจละเอียด) */
  confidence?: number;
}

export interface ScanProgress {
  /** ขั้นตอนตอนนี้ (ข้อความสำหรับผู้ใช้) */
  stage: string;
  /** 0-100 */
  percent: number;
}

// ---------- เตรียมภาพ ----------

/**
 * ปรับภาพก่อนอ่าน: ด้านยาว ~2000px (รูปเล็กขยาย รูปใหญ่ย่อ), ขาวดำ, ยืดความต่างสีจากค่าจริงของภาพ
 * (ตัดค่ามืด/สว่างสุด 1% ทิ้ง) ทำให้ตัวหนังสือบนซองสีหรือแสงไม่พอชัดขึ้น หมุนภาพได้ทีละ 90 องศา
 */
async function prepare(file: Blob, rotate: 0 | 90 | 180 | 270 = 0, targetSide = 2000): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('load-failed'));
      el.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = Math.min(2.5, targetSide / long);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const sideways = rotate === 90 || rotate === 270;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? h : w;
    canvas.height = sideways ? w : h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const hist = new Uint32Array(256);
    const gray = new Uint8ClampedArray(px.length / 4);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      gray[j] = g;
      hist[gray[j]]++;
    }
    // ยืดความต่างสี: หาเกณฑ์มืด/สว่าง 1%
    const total = gray.length;
    let lo = 0;
    let hi = 255;
    for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
    for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
    const range = Math.max(1, hi - lo);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const v = Math.max(0, Math.min(255, ((gray[j] - lo) * 255) / range));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- ตัวอ่าน (ใช้ซ้ำ ไม่ต้องโหลดใหม่ทุกครั้ง) ----------

type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
let workerPromise: Promise<Worker> | null = null;
let progressSink: ((p: ScanProgress) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['tha', 'eng'], 1, {
        logger: (m: { status: string; progress: number }) => {
          if (!progressSink) return;
          if (m.status === 'recognizing text') progressSink({ stage: 'กำลังอ่านตัวหนังสือ', percent: Math.round(m.progress * 100) });
          else if (/load|initializ/i.test(m.status)) progressSink({ stage: 'กำลังเตรียมตัวอ่านภาษาไทย (ครั้งแรกใช้เวลาสักครู่)', percent: Math.round(m.progress * 100) });
        },
      });
      // ฉลากยามักเป็นข้อความหลายบรรทัดเรียงกัน: แบ่งหน้าแบบอัตโนมัติ และเก็บช่องว่างระหว่างคำ
      await worker.setParameters({ preserve_interword_spaces: '1' } as Record<string, string>);
      return worker;
    })().catch((err) => {
      workerPromise = null; // โหลดไม่สำเร็จ (เช่น ออฟไลน์ครั้งแรก) ให้ลองใหม่ได้
      throw err;
    });
  }
  return workerPromise;
}

/** เริ่มโหลดตัวอ่านไว้ล่วงหน้า (เรียกตอนเปิดฟอร์มยา) ให้กดถ่ายรูปแล้วอ่านได้เร็วขึ้น */
export function preloadMedScanner(): void {
  if (typeof window === 'undefined') return;
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
  idle(() => void getWorker().catch(() => undefined));
}

/** จำนวนช่องที่อ่านได้ ใช้เลือกผลที่ดีที่สุดระหว่างหลายรอบ */
const score = (r: ScanResult) =>
  (r.drug ? 3 : r.name ? 2 : 0) + (r.perDose ? 1 : 0) + (r.periods?.length ? 1 : 0) + (r.meal ? 1 : 0) + (r.quantity ? 1 : 0) + (r.asNeeded ? 1 : 0);

/**
 * อ่านรูปซองยา: รอบแรกภาพตรง ถ้าแทบไม่ได้อะไร ลองหมุน 90 / 270 องศา แล้วเลือกผลที่อ่านได้มากที่สุด
 * ครั้งแรกต้องออนไลน์เพื่อโหลดข้อมูลภาษา (หลังจากนั้นเบราว์เซอร์เก็บไว้ ใช้ออฟไลน์ได้)
 */
export async function scanMedPhoto(file: File, onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
  progressSink = onProgress ?? null;
  try {
    onProgress?.({ stage: 'กำลังเตรียมตัวอ่านภาษาไทย', percent: 0 });
    const worker = await getWorker();
    let best: ScanResult | null = null;
    const rotations: (0 | 90 | 270)[] = [0, 90, 270];
    for (let i = 0; i < rotations.length; i++) {
      if (i > 0) onProgress?.({ stage: `ยังอ่านได้น้อย ลองหมุนรูป (${i}/2)`, percent: 0 });
      const image = await prepare(file, rotations[i]);
      const { data } = await worker.recognize(image);
      const result = { ...parseLabelText(data.text ?? ''), confidence: Math.round(data.confidence ?? 0) };
      if (!best || score(result) > score(best)) best = result;
      // ได้ข้อมูลพอแล้ว (ชื่อยา หรืออย่างน้อย 2 ช่อง) ไม่ต้องหมุนต่อ
      if (score(best) >= 3) break;
    }
    return best as ScanResult;
  } finally {
    progressSink = null;
  }
}

// ---------- แยกข้อมูลจากข้อความ ----------


/**
 * ทำข้อความให้จับคำง่าย: ตัวเลขไทยเป็นอารบิก, รวมสระอำที่ถูกแยก, ตัดไม้หันอากาศ/วรรณยุกต์/ไม้ไต่คู้/การันต์
 * (OCR มักอ่านหล่นหรือเกิน), ตัดช่องว่าง (OCR ไทยมักเว้นวรรคแทรกทุกตัว)
 * คำที่ใช้ค้นหาทุกคำก็ผ่านฟังก์ชันนี้ด้วย จึงเทียบกันได้เสมอ
 */
export function normalizeOcr(text: string): string {
  return text
    .replace(/[๐-๙]/g, (c) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)))
    .replace(/ํา/g, 'ำ')
    .replace(/[ั็-๎]/g, '')
    .replace(/[ \t]+/g, '');
}

/** คำ (ภาษาไทยปกติ) -> รูปแบบหลังทำให้เรียบ ใช้สร้างตัวค้นหา */
const N = (word: string) => normalizeOcr(word);
const anyOf = (...words: string[]) => words.map(N).join('|');

const UNIT_WORDS: [RegExp, string][] = [
  [new RegExp(`${anyOf('แคปซูล', 'แคปซุล')}|cap`, 'i'), 'แคปซูล'],
  [new RegExp(`${anyOf('ช้อนชา')}|tsp|teaspoon`, 'i'), 'ช้อนชา'],
  [new RegExp(`${anyOf('ช้อนโต๊ะ')}|tbsp|tablespoon`, 'i'), 'ช้อนโต๊ะ'],
  [new RegExp(`${anyOf('ซีซี', 'มล')}|ml|cc`, 'i'), 'มล.'],
  [new RegExp(`${anyOf('หยด')}|drop`, 'i'), 'หยด'],
  [new RegExp(`${anyOf('พ่น')}|puff`, 'i'), 'พ่น'],
  [new RegExp(`${anyOf('ซอง')}|sachet`, 'i'), 'ซอง'],
  [new RegExp(`${anyOf('เม็ด')}|tab`, 'i'), 'เม็ด'],
];
const unitOf = (word: string) => UNIT_WORDS.find(([re]) => re.test(word))?.[1];

const NUM_WORDS: [string, number][] = [
  [N('ครึ่ง'), 0.5],
  [N('หนึ่ง'), 1],
  [N('สอง'), 2],
  [N('สาม'), 3],
  [N('สี่'), 4],
  [N('ห้า'), 5],
];
const parseNumber = (s: string): number | undefined => {
  if (/½|1\/2/.test(s)) return 0.5;
  const n = parseFloat(s.replace(',', '.'));
  if (Number.isFinite(n)) return n;
  return NUM_WORDS.find(([w]) => s.startsWith(w))?.[1];
};

const NUM = `([0-9]+(?:[.,][0-9]+)?|1/2|½|${NUM_WORDS.map(([w]) => w).join('|')})`;
const UNIT_RE = `(${anyOf('เม็ด', 'แคปซูล', 'แคปซุล', 'ช้อนชา', 'ช้อนโต๊ะ', 'ซีซี', 'มล', 'หยด', 'พ่น', 'ซอง')})`;
/** "ครั้ง" หลังทำให้เรียบ (ตัดไม้หันอากาศที่ OCR มักอ่านหล่นด้วย) */
const KRANG = N('ครั้ง');

/** แยกข้อมูลยาจากข้อความบนซอง (ชื่อยา ขนาด ครั้งละ วันละกี่ครั้ง ช่วงเวลา ก่อน/หลังอาหาร จำนวน ใช้เมื่อมีอาการ) */
export function parseLabelText(rawText: string): ScanResult {
  const n = normalizeOcr(rawText);
  const lower = rawText.toLowerCase();
  const has = (...words: string[]) => words.some((w) => n.includes(N(w)));
  const result: ScanResult = { rawText };

  // ---- ชื่อยา: เทียบกับฐานข้อมูลยา (ข้อความเดิม แล้วแบบไม่มีช่องว่าง)
  const drug = matchDrugInText(rawText) ?? matchDrugInText(rawText.replace(/\s+/g, ''));
  if (drug) result.drug = drug;

  const strength = rawText.match(/(\d+(?:[.,]\d+)?)\s*(mcg|µg|mg|ml|g|iu|มิลลิกรัม|มก\.?)(?![a-z])/i);
  const strengthText = strength
    ? `${strength[1].replace(',', '.')} ${/มก|มิลลิกรัม/.test(strength[2]) ? 'mg' : strength[2].toLowerCase()}`
    : '';
  if (drug) {
    result.name = [drug.generic, strengthText].filter(Boolean).join(' ');
  } else {
    // ไม่มีในฐานข้อมูล: ใช้บรรทัดที่เป็นชื่ออังกฤษตามด้วยความแรง เช่น "AMLODIPINE 5 MG"
    for (const line of rawText.split(/\n/)) {
      const m = line.match(/([A-Za-z][A-Za-z-]{3,}(?: [A-Za-z-]{2,}){0,2})\s*(\d+(?:[.,]\d+)?)\s*(mcg|µg|mg|g|iu)\b/i);
      if (m) {
        const word = m[1].trim();
        result.name = `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()} ${m[2].replace(',', '.')} ${m[3].toLowerCase()}`;
        break;
      }
    }
  }

  // ---- ครั้งละ: "ครั้งละ 1 เม็ด" หรือ "รับประทาน 1 เม็ด" หรืออังกฤษ "take 1 tablet"
  const dose =
    n.match(new RegExp(`${KRANG}ละ${NUM}${UNIT_RE}?`)) ??
    n.match(new RegExp(`(?:${anyOf('รับประทาน', 'ทาน', 'กิน', 'ใช้')})${NUM}${UNIT_RE}`));
  if (dose) {
    result.perDose = parseNumber(dose[1]);
    if (dose[2]) result.unit = unitOf(dose[2]);
  } else {
    const en = lower.match(/\b(\d+(?:\.\d+)?|one|two|half)\s*(tablets?|tabs?|capsules?|caps?|tsp|teaspoons?|ml|drops?|puffs?|sachets?)\b/);
    if (en) {
      const words: Record<string, number> = { one: 1, two: 2, half: 0.5 };
      result.perDose = words[en[1]] ?? parseFloat(en[1]);
      result.unit = unitOf(en[2]);
    }
  }

  // ---- ใช้เมื่อมีอาการ (ไม่มีเวลาประจำ)
  if (
    has('เมื่อมีอาการ', 'เวลามีอาการ', 'เวลาปวด', 'เมื่อปวด', 'เมื่อมีไข้', 'เวลามีไข้', 'เมื่อจำเป็น') ||
    new RegExp(`${N('ทุก')}[0-9]+(?:-[0-9]+)?${N('ชั่วโมง')}`).test(n) ||
    /\bprn\b|as needed|when needed|if needed|every \d+(?:-\d+)? ?h/.test(lower)
  ) {
    result.asNeeded = true;
  }

  // ---- ช่วงเวลา
  const periods = new Set<DosePeriod>();
  if (has('เช้า') || /\bmorning\b|breakfast/.test(lower)) periods.add('morning');
  if (has('กลางวัน', 'เที่ยง') || /\b(noon|lunch)\b/.test(lower)) periods.add('noon');
  if (has('เย็น') || /\b(evening|dinner)\b/.test(lower)) periods.add('evening');
  if (has('ก่อนนอน') || /\b(bedtime|at night)\b|\bhs\b/.test(lower)) periods.add('bedtime');
  if (periods.size === 0) {
    const byCount: Record<number, DosePeriod[]> = {
      1: ['morning'],
      2: ['morning', 'evening'],
      3: ['morning', 'noon', 'evening'],
      4: ['morning', 'noon', 'evening', 'bedtime'],
    };
    const times = n.match(new RegExp(`${N('วันละ')}${NUM}${KRANG}`));
    let count = times ? parseNumber(times[1]) : undefined;
    if (!count) {
      const en = lower.match(/\b(once|twice|three|four|\d)\s*(?:times?\s*)?(?:a|per)\s*day\b|\b(od|bid|tid|qid)\b/);
      const map: Record<string, number> = { once: 1, twice: 2, three: 3, four: 4, od: 1, bid: 2, tid: 3, qid: 4 };
      if (en) count = en[2] ? map[en[2]] : (map[en[1]] ?? parseFloat(en[1]));
    }
    if (count && byCount[count]) byCount[count].forEach((p) => periods.add(p));
  }
  if (periods.size > 0) result.periods = [...periods];

  // ---- ก่อน/หลัง/พร้อมอาหาร
  if (has('ก่อนอาหาร') || /before (meals?|food)|\bac\b/.test(lower)) result.meal = 'before';
  else if (has('หลังอาหาร') || /after (meals?|food)|\bpc\b/.test(lower)) result.meal = 'after';
  else if (has('พร้อมอาหาร') || /with (meals?|food)/.test(lower)) result.meal = 'with';
  else if (drug?.meal) result.meal = drug.meal;

  // ---- จำนวนในซอง
  const qty =
    n.match(new RegExp(`(?:${anyOf('จำนวน', 'รวม', 'บรรจุ')}|qty|#)[:：]?([0-9]+)`, 'i')) ??
    lower.match(/#\s*(\d+)|\b(\d+)\s*(?:tabs?|tablets?|caps?|capsules?)\b(?!\s*(?:a|per)\s*day)/);
  if (qty) {
    const value = parseNumber(qty[1] ?? qty[2] ?? '');
    // ต้องมากกว่า "ครั้งละ" (กันจับเลขครั้งละมาเป็นจำนวนในซอง)
    if (value && value >= 2 && value <= 1000 && value !== result.perDose) result.quantity = value;
  }

  if (!result.unit && result.drug) {
    result.unit = result.drug.form === 'capsule' ? 'แคปซูล' : result.drug.form === 'tablet' ? 'เม็ด' : undefined;
  }
  return result;
}

/** มีข้อมูลที่ใช้ได้อย่างน้อยหนึ่งช่องไหม */
export const hasScanData = (r: ScanResult) =>
  !!(r.name || r.perDose || r.unit || r.periods?.length || r.meal || r.quantity || r.asNeeded);
