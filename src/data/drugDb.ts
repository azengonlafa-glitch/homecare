import type { MealTiming, MedForm } from '../lib/meds';

/**
 * ฐานข้อมูลยาตัวอย่างของต้นแบบ (ยาที่พบบ่อย) ใช้เชื่อมรายการยา แสดงข้อมูลยา และจับคู่ตอนอ่านรูปซองยา
 * ข้อมูลเป็นข้อมูลทั่วไปเพื่อให้เห็นภาพเท่านั้น ควรให้เภสัชกรตรวจทานก่อนใช้งานจริง
 */
export interface DrugInfo {
  id: string;
  /** ชื่อสามัญ (อังกฤษ) */
  generic: string;
  /** ชื่อไทย */
  thai: string;
  /** คำที่ใช้ค้นหา/จับคู่ (ชื่อการค้า ชื่อสะกดอื่น) ตัวพิมพ์เล็ก */
  aliases: string[];
  /** ใช้รักษาอะไร (ภาษาชาวบ้าน) */
  purpose: string;
  form: MedForm;
  /** ช่วงอาหารที่มักแนะนำ */
  meal?: MealTiming;
}

export const DRUGS: DrugInfo[] = [
  { id: 'paracetamol', generic: 'Paracetamol', thai: 'พาราเซตามอล', aliases: ['paracetamol', 'acetaminophen', 'tylenol', 'sara', 'tiffy'], purpose: 'แก้ปวด ลดไข้', form: 'tablet' },
  { id: 'ibuprofen', generic: 'Ibuprofen', thai: 'ไอบูโพรเฟน', aliases: ['ibuprofen', 'brufen', 'nurofen'], purpose: 'แก้ปวด ลดอักเสบ ลดไข้', form: 'tablet', meal: 'after' },
  { id: 'aspirin81', generic: 'Aspirin', thai: 'แอสไพริน', aliases: ['aspirin', 'asa', 'aspent'], purpose: 'ต้านเกล็ดเลือด ป้องกันหลอดเลือดอุดตัน', form: 'tablet', meal: 'after' },
  { id: 'metformin', generic: 'Metformin', thai: 'เมทฟอร์มิน', aliases: ['metformin', 'glucophage'], purpose: 'คุมน้ำตาลในเลือด (เบาหวานชนิดที่ 2)', form: 'tablet', meal: 'with' },
  { id: 'glipizide', generic: 'Glipizide', thai: 'กลิพิไซด์', aliases: ['glipizide'], purpose: 'คุมน้ำตาลในเลือด', form: 'tablet', meal: 'before' },
  { id: 'glibenclamide', generic: 'Glibenclamide', thai: 'ไกลเบนคลาไมด์', aliases: ['glibenclamide', 'glyburide', 'daonil'], purpose: 'คุมน้ำตาลในเลือด', form: 'tablet', meal: 'before' },
  { id: 'gliclazide', generic: 'Gliclazide', thai: 'กลิคลาไซด์', aliases: ['gliclazide', 'diamicron'], purpose: 'คุมน้ำตาลในเลือด', form: 'tablet', meal: 'with' },
  { id: 'amlodipine', generic: 'Amlodipine', thai: 'แอมโลดิพีน', aliases: ['amlodipine', 'norvasc'], purpose: 'ลดความดันโลหิต', form: 'tablet' },
  { id: 'losartan', generic: 'Losartan', thai: 'โลซาร์แทน', aliases: ['losartan', 'cozaar'], purpose: 'ลดความดันโลหิต ช่วยถนอมไต', form: 'tablet' },
  { id: 'enalapril', generic: 'Enalapril', thai: 'อีนาลาพริล', aliases: ['enalapril', 'renitec'], purpose: 'ลดความดันโลหิต รักษาหัวใจล้มเหลว', form: 'tablet' },
  { id: 'hctz', generic: 'Hydrochlorothiazide', thai: 'ไฮโดรคลอโรไทอะไซด์', aliases: ['hydrochlorothiazide', 'hctz'], purpose: 'ขับปัสสาวะ ลดความดันโลหิต', form: 'tablet' },
  { id: 'furosemide', generic: 'Furosemide', thai: 'ฟูโรซีไมด์', aliases: ['furosemide', 'lasix'], purpose: 'ขับปัสสาวะ ลดบวมน้ำ', form: 'tablet' },
  { id: 'atenolol', generic: 'Atenolol', thai: 'อะทีโนลอล', aliases: ['atenolol', 'tenormin'], purpose: 'ลดความดัน ลดอัตราการเต้นของหัวใจ', form: 'tablet' },
  { id: 'metoprolol', generic: 'Metoprolol', thai: 'เมโทโพรลอล', aliases: ['metoprolol', 'betaloc'], purpose: 'ลดความดัน ลดอัตราการเต้นของหัวใจ', form: 'tablet', meal: 'with' },
  { id: 'atorvastatin', generic: 'Atorvastatin', thai: 'อะทอร์วาสแตติน', aliases: ['atorvastatin', 'lipitor'], purpose: 'ลดไขมันในเลือด', form: 'tablet' },
  { id: 'simvastatin', generic: 'Simvastatin', thai: 'ซิมวาสแตติน', aliases: ['simvastatin', 'zocor'], purpose: 'ลดไขมันในเลือด', form: 'tablet' },
  { id: 'warfarin', generic: 'Warfarin', thai: 'วาร์ฟาริน', aliases: ['warfarin', 'orfarin'], purpose: 'ต้านการแข็งตัวของเลือด', form: 'tablet' },
  { id: 'clopidogrel', generic: 'Clopidogrel', thai: 'โคลพิโดเกรล', aliases: ['clopidogrel', 'plavix'], purpose: 'ต้านเกล็ดเลือด', form: 'tablet' },
  { id: 'omeprazole', generic: 'Omeprazole', thai: 'โอเมพราโซล', aliases: ['omeprazole', 'miracid', 'losec'], purpose: 'ลดกรดในกระเพาะ รักษากรดไหลย้อน', form: 'capsule', meal: 'before' },
  { id: 'domperidone', generic: 'Domperidone', thai: 'ดอมเพอริโดน', aliases: ['domperidone', 'motilium'], purpose: 'แก้คลื่นไส้ อาเจียน ท้องอืด', form: 'tablet', meal: 'before' },
  { id: 'cetirizine', generic: 'Cetirizine', thai: 'เซทิริซีน', aliases: ['cetirizine', 'zyrtec'], purpose: 'แก้แพ้ ผื่นคัน น้ำมูกจากภูมิแพ้', form: 'tablet' },
  { id: 'loratadine', generic: 'Loratadine', thai: 'ลอราทาดีน', aliases: ['loratadine', 'clarityne'], purpose: 'แก้แพ้ ง่วงน้อย', form: 'tablet' },
  { id: 'chlorpheniramine', generic: 'Chlorpheniramine', thai: 'คลอร์เฟนิรามีน', aliases: ['chlorpheniramine', 'cpm'], purpose: 'แก้แพ้ ลดน้ำมูก', form: 'tablet' },
  { id: 'amoxicillin', generic: 'Amoxicillin', thai: 'อะม็อกซิซิลลิน', aliases: ['amoxicillin', 'amoxy'], purpose: 'ยาปฏิชีวนะ ฆ่าเชื้อแบคทีเรีย', form: 'capsule' },
  { id: 'levothyroxine', generic: 'Levothyroxine', thai: 'เลโวไทรอกซีน', aliases: ['levothyroxine', 'eltroxin', 'thyroxine'], purpose: 'ฮอร์โมนไทรอยด์ (ไทรอยด์ต่ำ)', form: 'tablet', meal: 'before' },
  { id: 'allopurinol', generic: 'Allopurinol', thai: 'อัลโลพูรินอล', aliases: ['allopurinol', 'zyloric'], purpose: 'ลดกรดยูริก ป้องกันเกาต์', form: 'tablet', meal: 'after' },
  { id: 'colchicine', generic: 'Colchicine', thai: 'โคลชิซีน', aliases: ['colchicine'], purpose: 'รักษาเกาต์กำเริบ', form: 'tablet' },
  { id: 'calcium', generic: 'Calcium carbonate', thai: 'แคลเซียมคาร์บอเนต', aliases: ['calcium', 'caltrate', 'แคลเซียม'], purpose: 'เสริมแคลเซียม บำรุงกระดูก', form: 'tablet', meal: 'after' },
  { id: 'vitd', generic: 'Vitamin D', thai: 'วิตามินดี', aliases: ['vitamin d', 'ergocalciferol', 'calciferol', 'วิตามินดี'], purpose: 'เสริมวิตามินดี', form: 'capsule', meal: 'after' },
  { id: 'folic', generic: 'Folic acid', thai: 'กรดโฟลิก', aliases: ['folic', 'folic acid', 'โฟลิก'], purpose: 'บำรุงเลือด', form: 'tablet' },
  { id: 'ferrous', generic: 'Ferrous fumarate', thai: 'ธาตุเหล็ก', aliases: ['ferrous', 'ferrous fumarate', 'ferrous sulfate', 'ธาตุเหล็ก'], purpose: 'รักษาโลหิตจางจากขาดธาตุเหล็ก', form: 'tablet', meal: 'after' },
  { id: 'diazepam', generic: 'Diazepam', thai: 'ไดอะซีแพม', aliases: ['diazepam', 'valium'], purpose: 'คลายกังวล ช่วยให้นอนหลับ คลายกล้ามเนื้อ', form: 'tablet' },
  { id: 'salbutamol', generic: 'Salbutamol', thai: 'ซาลบูทามอล', aliases: ['salbutamol', 'ventolin', 'albuterol'], purpose: 'ขยายหลอดลม บรรเทาหอบ', form: 'spray' },
  { id: 'loperamide', generic: 'Loperamide', thai: 'โลเพอราไมด์', aliases: ['loperamide', 'imodium'], purpose: 'แก้ท้องเสีย', form: 'capsule' },
  { id: 'tears', generic: 'Artificial tears', thai: 'น้ำตาเทียม', aliases: ['artificial tears', 'tears naturale', 'น้ำตาเทียม'], purpose: 'เพิ่มความชุ่มชื้น ลดตาแห้ง', form: 'drops' },
];

export const drugById = (id: string) => DRUGS.find((d) => d.id === id);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** ค้นหายาจากชื่อที่พิมพ์ (ชื่อสามัญ ชื่อไทย หรือชื่อการค้า) */
export function searchDrugs(query: string, limit = 6): DrugInfo[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return DRUGS.filter(
    (d) => norm(d.generic).includes(q) || norm(d.thai).includes(q) || d.aliases.some((a) => norm(a).includes(q))
  ).slice(0, limit);
}

/** หายาที่ชื่อปรากฏอยู่ในข้อความ (เช่น ชื่อยาที่ผู้ใช้พิมพ์ หรือข้อความที่อ่านจากรูป) */
export function matchDrugInText(text: string): DrugInfo | undefined {
  const t = norm(text);
  if (!t) return undefined;
  return DRUGS.find(
    (d) => t.includes(norm(d.generic)) || t.includes(norm(d.thai)) || d.aliases.some((a) => a.length >= 3 && t.includes(norm(a)))
  );
}
