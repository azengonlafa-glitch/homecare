/**
 * ข้อมูลร้านยาที่ใช้ร่วมกันทั้งแอป (หน้า "ร้านยาของเรา" และหน้า "ถามเภสัชกร")
 * ทั้งหมดเป็นข้อมูลสมมติของต้นแบบ ยังไม่มีข้อมูลจริง
 */
export const PHARMACY = {
  name: 'ร้านยาสุขใจเภสัช',
  /** เบอร์โทรที่แสดงให้ผู้ใช้เห็น */
  phoneLabel: '02-123-4567',
  /** ลิงก์สำหรับกดโทร (ไม่มีขีด) */
  phoneHref: 'tel:021234567',
  /** ชื่อบัญชีไลน์ของร้าน */
  lineLabel: '@growapharmacy',
  /** ลิงก์เปิดแชตไลน์ของร้าน */
  lineUrl: 'https://line.me/R/ti/p/@growapharmacy',
} as const;

/** ลิงก์แบบฟอร์มส่งความคิดเห็น (แสดงเฉพาะโหมดทดสอบ ?test=1) */
export const FEEDBACK_URL = 'https://example.com/growa-homecare-feedback';
