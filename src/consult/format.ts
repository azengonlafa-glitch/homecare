/** ตัวช่วยจัดรูปแบบและตรวจข้อมูลติดต่อของผู้ให้บริการและทีมงาน ใช้ร่วมกันทั้งฟอร์มและ Mock */

export const PHONE_PATTERN = /^0\d{8,9}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** ทีมงานต่อร้านสูงสุด ตรงกับกติกาในฐานข้อมูล (admin_assign_staff) */
export const MAX_STAFF_PER_PROVIDER = 5;

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** 0812345678 → 081-234-5678, 021234567 → 02-123-4567 ถ้าไม่ใช่เบอร์ไทยคืนค่าเดิม */
export function formatPhone(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return raw;
}

/** รับเฉพาะลิงก์ https ที่เปิดได้จริง ป้องกัน javascript: และลิงก์ที่ไม่ปลอดภัย */
export function isHttpsUrl(value: string): boolean {
  const text = value.trim();
  if (!/^https:\/\/\S+$/i.test(text)) return false;
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

/** ใช้ได้ทั้งรูปที่ย่อแล้วและลิงก์ https เดิม */
export const isSafePhoto = (value: string): boolean =>
  value === '' || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || isHttpsUrl(value);
