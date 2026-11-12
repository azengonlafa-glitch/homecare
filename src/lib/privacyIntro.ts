import { CURRENT_MEMBER_ID } from './settings';

/**
 * หน้าต่างอธิบายความเป็นส่วนตัวตอนเข้าบ้านครั้งแรก
 * - กด "ตั้งค่าตอนนี้" หรือติ๊ก "ไม่ต้องแสดงอีก" = ไม่ขึ้นอีกถาวร (ต่อบัญชีต่อเบราว์เซอร์)
 * - กด "ไว้ทีหลัง" โดยไม่ติ๊ก = ไม่ขึ้นอีกจนกว่าจะเปิดเบราว์เซอร์ใหม่/ล็อกอินรอบหน้า
 * ผู้ใช้กลับมาปรับได้เสมอที่ ตั้งค่า > ความเป็นส่วนตัว
 *
 * ชื่อคีย์ต้องไม่ขึ้นต้นด้วย "growa_" เพราะตอนออกจากระบบ/สลับบัญชี ระบบล้างทุกคีย์ที่ขึ้นต้นแบบนั้น
 * (wipeLocal ใน cloud/engine.ts) ค่านี้ไม่ใช่ข้อมูลสุขภาพ จึงเก็บไว้ข้ามการออกจากระบบได้
 */
const foreverKey = () => `prefs.growa.privacy_intro_v1_${CURRENT_MEMBER_ID}`;
const sessionKey = () => `prefs.growa.privacy_intro_session_${CURRENT_MEMBER_ID}`;

export function privacyIntroAnswered(): boolean {
  try {
    return localStorage.getItem(foreverKey()) !== null || sessionStorage.getItem(sessionKey()) !== null;
  } catch {
    return true; // เก็บค่าไม่ได้ (โหมดส่วนตัว ฯลฯ) ไม่ถามเพื่อไม่ให้ขึ้นซ้ำทุกครั้ง
  }
}

/** forever = true เมื่อกด "ตั้งค่าตอนนี้" หรือติ๊ก "ไม่ต้องแสดงอีก" */
export function markPrivacyIntroAnswered(answer: 'later' | 'now', forever: boolean): void {
  try {
    sessionStorage.setItem(sessionKey(), answer);
    if (forever) localStorage.setItem(foreverKey(), `${answer}:${new Date().toISOString()}`);
  } catch {
    // บันทึกไม่ได้: ข้ามได้
  }
}

export function clearPrivacyIntro(): void {
  try {
    localStorage.removeItem(foreverKey());
    sessionStorage.removeItem(sessionKey());
  } catch {
    // ล้างไม่ได้: ไม่กระทบการใช้งาน
  }
}
