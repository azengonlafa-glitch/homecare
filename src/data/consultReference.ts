/**
 * ข้อมูลอ้างอิงของแบบสอบถามปรึกษา
 *
 * ระบบนี้ใช้อัปเดตอาการให้ผู้ให้บริการอ่าน ไม่ประเมินหรือตัดสินอาการแทนผู้ใช้
 * ตัวเลือกอาการร่วมแปลจากแหล่งที่ระบุ ตรวจเมื่อ 2026-11-05 ห้ามเติมเองจากความจำ
 * (NHS เป็นแนวทางของสหราชอาณาจักร เภสัชกรไทยควรตรวจก่อนใช้งานจริง)
 */
export interface SymptomOption {
  id: string;
  label: string;
}

/** https://www.nhs.uk/conditions/headaches/ */
export const HEADACHE_OPTIONS: SymptomOption[] = [
  { id: 'ha_seizure', label: 'มีอาการชัก' },
  { id: 'ha_numb', label: 'ชาหรืออ่อนแรงที่ร่างกายหรือใบหน้า' },
  { id: 'ha_sudden', label: 'ปวดขึ้นมาทันทีและปวดรุนแรงมาก' },
  { id: 'ha_injury', label: 'ศีรษะกระแทกหรือได้รับบาดเจ็บภายใน 3 เดือนที่ผ่านมา' },
  { id: 'ha_function', label: 'พูด ทรงตัว เดิน หรือจำสิ่งต่าง ๆ ได้ยากขึ้น' },
  { id: 'ha_drowsy', label: 'ง่วงซึมหรือสับสน' },
  { id: 'ha_vision_loss', label: 'มองไม่เห็น' },
  { id: 'ha_rash', label: 'มีผื่นที่ไม่จางเมื่อกลิ้งแก้วกดลงบนผื่น' },
  { id: 'ha_meningeal', label: 'ไข้สูงมาก คอแข็ง หรือแสงจ้าทำให้ทนไม่ได้' },
  { id: 'ha_eye', label: 'มีปัญหาการมองเห็นหรือปัญหาที่ตา' },
  { id: 'ha_trigger', label: 'ปวดมากขึ้นเมื่อไอ จาม ก้มตัว หรือออกกำลังกาย' },
  { id: 'ha_vomit', label: 'อาเจียนร่วมด้วย' },
  { id: 'ha_jaw', label: 'ปวดกรามตอนเคี้ยว หรือหนังศีรษะเจ็บเมื่อแตะ' },
];

/** https://www.nhs.uk/symptoms/stomach-ache/ */
export const STOMACH_OPTIONS: SymptomOption[] = [
  { id: 'st_sudden', label: 'ปวดขึ้นมาทันทีและปวดรุนแรง' },
  { id: 'st_vomit_blood', label: 'อาเจียนเป็นเลือด อาเจียนสีเขียว หรือเหมือนกากกาแฟ' },
  { id: 'st_bleeding', label: 'เลือดออกทางทวารหนักจำนวนมาก หรืออุจจาระดำเหนียว' },
  { id: 'st_no_urine', label: 'ปัสสาวะไม่ออกเลย' },
  { id: 'st_no_stool', label: 'ไม่ถ่ายและไม่ผายลมเลย' },
  { id: 'st_rash', label: 'มีจุดหรือผื่นที่ไม่จางเมื่อกด' },
  { id: 'st_breathing', label: 'หายใจลำบาก' },
  { id: 'st_worse', label: 'ปวดมากขึ้นอย่างรวดเร็ว' },
  { id: 'st_pregnant', label: 'กำลังตั้งครรภ์' },
  { id: 'st_blood_stool', label: 'มีเลือดปนในอุจจาระ' },
  { id: 'st_vaginal', label: 'มีเลือดออกผิดปกติหรือตกขาวผิดปกติทางช่องคลอด' },
  { id: 'st_persistent', label: 'ท้องเสียหรืออาเจียนหลายวันแล้วไม่หาย' },
];

/** https://www.nhs.uk/symptoms/fever-in-adults/ */
export const FEVER_OPTIONS: SymptomOption[] = [{ id: 'fv_not_better', label: 'มีไข้สูง ดูแลตัวเองที่บ้านแล้วไม่ดีขึ้นหรือแย่ลง' }];

/** กรอบคำถามมาตรฐานของเภสัชกร (WWHAM) ใช้เป็นคำถามแนะนำในพื้นที่ทำงานเภสัชกร */
export const SUGGESTED_QUESTIONS_SOURCE = {
  title: 'Pharmacy Mnemonics: WWHAM (Who, What, How long, Action taken, Medication)',
  url: 'https://resourcepharm.com/pre-reg-pharmacist/pharmacy-mnemonics.html',
};

export const SUGGESTED_QUESTIONS: string[] = [
  'อาการนี้เกิดกับตัวคุณเองหรือคนอื่นครับ/คะ',
  'ช่วยเล่าอาการที่เป็นอยู่ตอนนี้เพิ่มเติมได้ไหมครับ/คะ',
  'เป็นมานานแค่ไหนแล้วครับ/คะ',
  'ก่อนหน้านี้ได้ทำอะไรหรือลองใช้ยาอะไรไปแล้วบ้างครับ/คะ',
  'ตอนนี้ใช้ยาอะไรอยู่บ้าง รวมถึงยาที่ไม่ได้อยู่ในรายการครับ/คะ',
];
