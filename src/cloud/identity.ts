import { cloudEnabled } from './client';

/** ข้อมูลผู้ใช้ที่ล็อกอินอยู่ (เก็บใน localStorage เพื่อให้ส่วนอื่นของแอปอ่านได้แบบ synchronous) */
export interface AuthUser {
  id?: string;
  email?: string;
  name?: string;
}

export const AUTH_KEY = 'growa_auth_user';

export function readAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * รหัสสมาชิกของผู้ใช้ปัจจุบัน: โหมดคลาวด์ใช้รหัสผู้ใช้จริง, โหมดต้นแบบใช้ 'me'
 * (คำนวณตอนโหลดหน้า เพราะหลังเข้าสู่ระบบ/ออกจากระบบจะโหลดหน้าใหม่เสมอ)
 */
export const CURRENT_MEMBER_ID: string = (cloudEnabled && readAuthUser()?.id) || 'me';
