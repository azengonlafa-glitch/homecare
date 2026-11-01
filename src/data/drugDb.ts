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
  warnings: string[];
}

export const DRUGS: DrugInfo[] = [
  { id: 'paracetamol', generic: 'Paracetamol', thai: 'พาราเซตามอล', aliases: ['paracetamol', 'acetaminophen', 'tylenol', 'sara', 'tiffy'], purpose: 'แก้ปวด ลดไข้', form: 'tablet', warnings: ['ผู้ใหญ่ไม่ควรเกินวันละ 4,000 มก.', 'หลีกเลี่ยงแอลกอฮอล์ ระวังในผู้ที่เป็นโรคตับ'] },
  { id: 'ibuprofen', generic: 'Ibuprofen', thai: 'ไอบูโพรเฟน', aliases: ['ibuprofen', 'brufen', 'nurofen'], purpose: 'แก้ปวด ลดอักเสบ ลดไข้', form: 'tablet', meal: 'after', warnings: ['กินหลังอาหารทันที อาจระคายกระเพาะ', 'ระวังในผู้ที่เป็นโรคไต โรคกระเพาะ หรือแพ้แอสไพริน'] },
  { id: 'aspirin81', generic: 'Aspirin', thai: 'แอสไพริน', aliases: ['aspirin', 'asa', 'aspent'], purpose: 'ต้านเกล็ดเลือด ป้องกันหลอดเลือดอุดตัน', form: 'tablet', meal: 'after', warnings: ['เลือดออกง่ายขึ้น แจ้งแพทย์ก่อนทำฟันหรือผ่าตัด', 'กินหลังอาหาร'] },
  { id: 'metformin', generic: 'Metformin', thai: 'เมทฟอร์มิน', aliases: ['metformin', 'glucophage'], purpose: 'คุมน้ำตาลในเลือด (เบาหวานชนิดที่ 2)', form: 'tablet', meal: 'with', warnings: ['กินพร้อมหรือหลังอาหารเพื่อลดคลื่นไส้ ท้องเสีย', 'ระวังในผู้ที่เป็นโรคไต'] },
  { id: 'glipizide', generic: 'Glipizide', thai: 'กลิพิไซด์', aliases: ['glipizide'], purpose: 'คุมน้ำตาลในเลือด', form: 'tablet', meal: 'before', warnings: ['อาจทำให้น้ำตาลต่ำ มีลูกอมติดตัว', 'อย่างดมื้ออาหารหลังกินยา'] },
  { id: 'glibenclamide', generic: 'Glibenclamide', thai: 'ไกลเบนคลาไมด์', aliases: ['glibenclamide', 'glyburide', 'daonil'], purpose: 'คุมน้ำตาลในเลือด', form: 'tablet', meal: 'before', warnings: ['อาจทำให้น้ำตาลต่ำ โดยเฉพาะผู้สูงอายุ', 'อย่างดมื้ออาหารหลังกินยา'] },
  { id: 'gliclazide', generic: 'Gliclazide', thai: 'กลิคลาไซด์', aliases: ['gliclazide', 'diamicron'], purpose: 'คุมน้ำตาลในเลือด', form: 'tablet', meal: 'with', warnings: ['อาจทำให้น้ำตาลต่ำ'] },
  { id: 'amlodipine', generic: 'Amlodipine', thai: 'แอมโลดิพีน', aliases: ['amlodipine', 'norvasc'], purpose: 'ลดความดันโลหิต', form: 'tablet', warnings: ['อาจมีข้อเท้าบวม หน้าแดง ปวดศีรษะ', 'อย่าหยุดยาเอง'] },
  { id: 'losartan', generic: 'Losartan', thai: 'โลซาร์แทน', aliases: ['losartan', 'cozaar'], purpose: 'ลดความดันโลหิต ช่วยถนอมไต', form: 'tablet', warnings: ['อาจเวียนหัวเมื่อลุกเร็ว', 'ห้ามใช้ในหญิงตั้งครรภ์'] },
  { id: 'enalapril', generic: 'Enalapril', thai: 'อีนาลาพริล', aliases: ['enalapril', 'renitec'], purpose: 'ลดความดันโลหิต รักษาหัวใจล้มเหลว', form: 'tablet', warnings: ['อาจไอแห้ง ๆ ได้ แจ้งแพทย์ถ้ารบกวนมาก', 'ห้ามใช้ในหญิงตั้งครรภ์'] },
  { id: 'hctz', generic: 'Hydrochlorothiazide', thai: 'ไฮโดรคลอโรไทอะไซด์', aliases: ['hydrochlorothiazide', 'hctz'], purpose: 'ขับปัสสาวะ ลดความดันโลหิต', form: 'tablet', warnings: ['ควรกินตอนเช้า ไม่ต้องตื่นมาปัสสาวะกลางคืน', 'อาจทำให้เกลือแร่ต่ำ'] },
  { id: 'furosemide', generic: 'Furosemide', thai: 'ฟูโรซีไมด์', aliases: ['furosemide', 'lasix'], purpose: 'ขับปัสสาวะ ลดบวมน้ำ', form: 'tablet', warnings: ['กินตอนเช้า', 'อาจทำให้โพแทสเซียมต่ำ'] },
  { id: 'atenolol', generic: 'Atenolol', thai: 'อะทีโนลอล', aliases: ['atenolol', 'tenormin'], purpose: 'ลดความดัน ลดอัตราการเต้นของหัวใจ', form: 'tablet', warnings: ['ห้ามหยุดยาทันที', 'ระวังในผู้ที่เป็นหอบหืด'] },
  { id: 'metoprolol', generic: 'Metoprolol', thai: 'เมโทโพรลอล', aliases: ['metoprolol', 'betaloc'], purpose: 'ลดความดัน ลดอัตราการเต้นของหัวใจ', form: 'tablet', meal: 'with', warnings: ['ห้ามหยุดยาทันที'] },
  { id: 'atorvastatin', generic: 'Atorvastatin', thai: 'อะทอร์วาสแตติน', aliases: ['atorvastatin', 'lipitor'], purpose: 'ลดไขมันในเลือด', form: 'tablet', warnings: ['ถ้าปวดกล้ามเนื้อผิดปกติ ให้แจ้งแพทย์'] },
  { id: 'simvastatin', generic: 'Simvastatin', thai: 'ซิมวาสแตติน', aliases: ['simvastatin', 'zocor'], purpose: 'ลดไขมันในเลือด', form: 'tablet', warnings: ['ควรกินตอนเย็นหรือก่อนนอน', 'หลีกเลี่ยงน้ำเกรปฟรุต'] },
  { id: 'warfarin', generic: 'Warfarin', thai: 'วาร์ฟาริน', aliases: ['warfarin', 'orfarin'], purpose: 'ต้านการแข็งตัวของเลือด', form: 'tablet', warnings: ['ต้องตรวจเลือด (INR) ตามนัด', 'ยาและอาหารเสริมหลายชนิดตีกับยานี้ แจ้งเภสัชกรทุกครั้ง', 'ถ้ามีเลือดออกผิดปกติ ไปโรงพยาบาล'] },
  { id: 'clopidogrel', generic: 'Clopidogrel', thai: 'โคลพิโดเกรล', aliases: ['clopidogrel', 'plavix'], purpose: 'ต้านเกล็ดเลือด', form: 'tablet', warnings: ['เลือดออกง่ายขึ้น แจ้งแพทย์ก่อนทำฟันหรือผ่าตัด'] },
  { id: 'omeprazole', generic: 'Omeprazole', thai: 'โอเมพราโซล', aliases: ['omeprazole', 'miracid', 'losec'], purpose: 'ลดกรดในกระเพาะ รักษากรดไหลย้อน', form: 'capsule', meal: 'before', warnings: ['กินก่อนอาหารเช้าประมาณ 30 นาที'] },
  { id: 'domperidone', generic: 'Domperidone', thai: 'ดอมเพอริโดน', aliases: ['domperidone', 'motilium'], purpose: 'แก้คลื่นไส้ อาเจียน ท้องอืด', form: 'tablet', meal: 'before', warnings: ['กินก่อนอาหาร 15–30 นาที'] },
  { id: 'cetirizine', generic: 'Cetirizine', thai: 'เซทิริซีน', aliases: ['cetirizine', 'zyrtec'], purpose: 'แก้แพ้ ผื่นคัน น้ำมูกจากภูมิแพ้', form: 'tablet', warnings: ['อาจง่วง ระวังการขับรถ'] },
  { id: 'loratadine', generic: 'Loratadine', thai: 'ลอราทาดีน', aliases: ['loratadine', 'clarityne'], purpose: 'แก้แพ้ ง่วงน้อย', form: 'tablet', warnings: [] },
  { id: 'chlorpheniramine', generic: 'Chlorpheniramine', thai: 'คลอร์เฟนิรามีน', aliases: ['chlorpheniramine', 'cpm'], purpose: 'แก้แพ้ ลดน้ำมูก', form: 'tablet', warnings: ['ง่วงมาก ห้ามขับรถ ห้ามดื่มแอลกอฮอล์'] },
  { id: 'amoxicillin', generic: 'Amoxicillin', thai: 'อะม็อกซิซิลลิน', aliases: ['amoxicillin', 'amoxy'], purpose: 'ยาปฏิชีวนะ ฆ่าเชื้อแบคทีเรีย', form: 'capsule', warnings: ['กินให้ครบตามสั่งแม้อาการดีขึ้น', 'ห้ามใช้ถ้าแพ้เพนิซิลลิน'] },
  { id: 'levothyroxine', generic: 'Levothyroxine', thai: 'เลโวไทรอกซีน', aliases: ['levothyroxine', 'eltroxin', 'thyroxine'], purpose: 'ฮอร์โมนไทรอยด์ (ไทรอยด์ต่ำ)', form: 'tablet', meal: 'before', warnings: ['กินตอนท้องว่างเช้า ก่อนอาหาร 30–60 นาที', 'เว้นห่างจากแคลเซียมและธาตุเหล็ก 4 ชั่วโมง'] },
  { id: 'allopurinol', generic: 'Allopurinol', thai: 'อัลโลพูรินอล', aliases: ['allopurinol', 'zyloric'], purpose: 'ลดกรดยูริก ป้องกันเกาต์', form: 'tablet', meal: 'after', warnings: ['ดื่มน้ำมาก ๆ', 'ถ้ามีผื่นขึ้น หยุดยาและไปพบแพทย์ทันที'] },
  { id: 'colchicine', generic: 'Colchicine', thai: 'โคลชิซีน', aliases: ['colchicine'], purpose: 'รักษาเกาต์กำเริบ', form: 'tablet', warnings: ['ถ้าท้องเสียมาก ให้หยุดยาและปรึกษาแพทย์'] },
  { id: 'calcium', generic: 'Calcium carbonate', thai: 'แคลเซียมคาร์บอเนต', aliases: ['calcium', 'caltrate', 'แคลเซียม'], purpose: 'เสริมแคลเซียม บำรุงกระดูก', form: 'tablet', meal: 'after', warnings: ['เว้นห่างจากยาไทรอยด์และธาตุเหล็ก'] },
  { id: 'vitd', generic: 'Vitamin D', thai: 'วิตามินดี', aliases: ['vitamin d', 'ergocalciferol', 'calciferol', 'วิตามินดี'], purpose: 'เสริมวิตามินดี', form: 'capsule', meal: 'after', warnings: [] },
  { id: 'folic', generic: 'Folic acid', thai: 'กรดโฟลิก', aliases: ['folic', 'folic acid', 'โฟลิก'], purpose: 'บำรุงเลือด', form: 'tablet', warnings: [] },
  { id: 'ferrous', generic: 'Ferrous fumarate', thai: 'ธาตุเหล็ก', aliases: ['ferrous', 'ferrous fumarate', 'ferrous sulfate', 'ธาตุเหล็ก'], purpose: 'รักษาโลหิตจางจากขาดธาตุเหล็ก', form: 'tablet', meal: 'after', warnings: ['อุจจาระสีดำได้ เป็นเรื่องปกติ', 'เว้นห่างจากนม แคลเซียม และยาลดกรด'] },
  { id: 'diazepam', generic: 'Diazepam', thai: 'ไดอะซีแพม', aliases: ['diazepam', 'valium'], purpose: 'คลายกังวล ช่วยให้นอนหลับ คลายกล้ามเนื้อ', form: 'tablet', warnings: ['ง่วงมาก ห้ามขับรถ ห้ามดื่มแอลกอฮอล์', 'ใช้นานอาจติดยา ห้ามหยุดยาเองทันที'] },
  { id: 'salbutamol', generic: 'Salbutamol', thai: 'ซาลบูทามอล', aliases: ['salbutamol', 'ventolin', 'albuterol'], purpose: 'ขยายหลอดลม บรรเทาหอบ', form: 'spray', warnings: ['ถ้าต้องใช้บ่อยขึ้น แปลว่าคุมอาการไม่ได้ ควรพบแพทย์'] },
  { id: 'loperamide', generic: 'Loperamide', thai: 'โลเพอราไมด์', aliases: ['loperamide', 'imodium'], purpose: 'แก้ท้องเสีย', form: 'capsule', warnings: ['ห้ามใช้ถ้าถ่ายเป็นเลือดหรือมีไข้สูง'] },
  { id: 'tears', generic: 'Artificial tears', thai: 'น้ำตาเทียม', aliases: ['artificial tears', 'tears naturale', 'น้ำตาเทียม'], purpose: 'เพิ่มความชุ่มชื้น ลดตาแห้ง', form: 'drops', warnings: ['ล้างมือก่อนหยอด ปลายขวดอย่าแตะตา'] },
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
