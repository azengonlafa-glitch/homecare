/** ตัวเลือกทั้งหมดของฟอร์มข้อมูลพื้นฐาน (onboarding) */

export interface Option {
  value: string;
  label: string;
}

const same = (labels: string[]): Option[] => labels.map((label) => ({ value: label, label }));

export const GENDERS = same(['หญิง', 'ชาย', 'อื่น ๆ', 'ไม่ระบุ']);

export const MONTHS: Option[] = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
].map((label, index) => ({ value: String(index + 1), label }));

export const DAYS: Option[] = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export const OCCUPATIONS = same([
  'พนักงานออฟฟิศ',
  'งานกะกลางคืน',
  'ขับรถ / ขนส่ง',
  'รับราชการ',
  'เกษตรกร',
  'ค้าขาย / ธุรกิจส่วนตัว',
  'งานสัมผัสสารเคมี',
  'นักเรียน / นักศึกษา',
  'เกษียณอายุ',
  'แม่บ้าน / พ่อบ้าน',
  'อื่น ๆ',
]);

export const BLOOD_TYPES = same(['A', 'B', 'AB', 'O', 'ไม่ทราบ']);
export const SMOKING = same(['ไม่สูบ', 'เคยสูบ เลิกแล้ว', 'สูบอยู่']);
export const ALCOHOL = same(['ไม่ดื่ม', 'นาน ๆ ครั้ง', 'ดื่มเป็นประจำ']);
export const EXERCISE = same(['แทบไม่ออกกำลังกาย', '1–2 ครั้ง / สัปดาห์', '3 ครั้งขึ้นไป / สัปดาห์']);

export const SEVERITIES: Option[] = [
  { value: 'mild', label: 'เล็กน้อย' },
  { value: 'moderate', label: 'ปานกลาง' },
  { value: 'severe', label: 'รุนแรง' },
];

export const OTHER_ALLERGIES = same([
  'อาหารทะเล',
  'ถั่ว',
  'นมวัว',
  'ไข่',
  'แป้งสาลี / กลูเตน',
  'ฝุ่น / ละอองเกสร',
  'ยางลาเท็กซ์',
  'แมลงกัดต่อย',
]);

export interface StepMeta {
  title: string;
  subtitle: string;
}

export const STEPS: StepMeta[] = [
  { title: 'ข้อมูลส่วนตัว', subtitle: 'ชื่อ วันเกิด เพศ และอาชีพ' },
  { title: 'ร่างกายและไลฟ์สไตล์', subtitle: 'ส่วนสูง น้ำหนัก หมู่เลือด และนิสัยด้านสุขภาพ' },
  { title: 'ประวัติการแพ้', subtitle: 'แพ้ยา อาหาร และสิ่งอื่น ๆ' },
  { title: 'โรคและยาที่ใช้', subtitle: 'โรคประจำตัว ยาที่ใช้อยู่ และประวัติการรักษา' },
  { title: 'ประวัติครอบครัว', subtitle: 'โรคที่คนในครอบครัวเคยเป็น' },
  { title: 'ติดต่อและที่อยู่', subtitle: 'ผู้ติดต่อฉุกเฉินและที่อยู่จัดส่ง' },
  { title: 'เอกสารทางการแพทย์', subtitle: 'ผลตรวจและข้อมูลอื่น ๆ (ไม่บังคับ)' },
  { title: 'ความยินยอม', subtitle: 'อ่านเอกสารให้ครบแล้วกดยอมรับ' },
];
