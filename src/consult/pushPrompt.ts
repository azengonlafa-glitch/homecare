import { CURRENT_MEMBER_ID } from '../cloud/identity';
import type { PushState } from './push';

/**
 * หน้าต่างชวนเปิดแจ้งเตือนกินยาสำหรับผู้ใช้ใหม่ ขึ้นตอนเข้าหน้ายา
 * - ยินยอม/ถูกบล็อก/ติ๊ก "ไม่ต้องแสดงอีก" = ไม่ขึ้นอีกถาวร (ต่อบัญชีต่อเบราว์เซอร์)
 * - กด "ไว้ทีหลัง" โดยไม่ติ๊ก = ไม่ขึ้นอีกจนกว่าจะเปิดเบราว์เซอร์ใหม่/ล็อกอินรอบหน้า
 * ผู้ใช้เปิดเองได้เสมอที่ ตั้งค่า > การแจ้งเตือน
 */
// ห้ามขึ้นต้นด้วย "growa_" เพราะตอนออกจากระบบ ระบบล้างทุกคีย์ที่ขึ้นต้นแบบนั้น (wipeLocal ใน cloud/engine.ts) แล้วจะถามซ้ำทุกครั้งที่ล็อกอิน
const key = () => `prefs.growa.push_prompt_v1_${CURRENT_MEMBER_ID}`;
const sessionKey = () => `prefs.growa.push_prompt_session_${CURRENT_MEMBER_ID}`;

/** ถามเมื่อเครื่องรองรับและยังไม่เปิด (หรือ iPhone ที่ต้องเพิ่มลงหน้าจอโฮมก่อน) และยังไม่เคยตอบ */
export const shouldAskPush = (state: PushState, answered: boolean): boolean => !answered && (state === 'off' || state === 'needs-install');

export function pushPromptAnswered(): boolean {
  try {
    return localStorage.getItem(key()) !== null || sessionStorage.getItem(sessionKey()) !== null;
  } catch {
    return true; // เก็บค่าไม่ได้ (โหมดส่วนตัว ฯลฯ) ไม่ถามเพื่อไม่ให้ขึ้นซ้ำทุกครั้ง
  }
}

/** forever = false เฉพาะ "ไว้ทีหลัง" ที่ไม่ได้ติ๊ก "ไม่ต้องแสดงอีก" */
export function markPushPromptAnswered(answer: 'enabled' | 'later' | 'blocked' | 'seen', forever = true): void {
  try {
    sessionStorage.setItem(sessionKey(), answer);
    if (forever) localStorage.setItem(key(), `${answer}:${new Date().toISOString()}`);
  } catch {
    // บันทึกไม่ได้: ข้ามได้
  }
}

export function clearPushPrompt(): void {
  try {
    localStorage.removeItem(key());
    sessionStorage.removeItem(sessionKey());
  } catch {
    // ล้างไม่ได้: ไม่กระทบการใช้งาน
  }
}
