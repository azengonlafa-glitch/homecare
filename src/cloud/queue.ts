/**
 * จุดเชื่อมบางๆ ให้ไฟล์ข้อมูลใน lib/ บอกว่า "ข้อมูลก้อนนี้เปลี่ยนแล้ว ช่วยส่งขึ้นเซิร์ฟเวอร์"
 * (แยกไฟล์เพื่อไม่ให้เกิด import วนกับ engine)
 */
export type StoreName = 'settings' | 'records' | 'meds' | 'calendar' | 'journal' | 'access' | 'notices' | 'onboarding';

type Handler = (store: StoreName, ids?: string[]) => void;

let handler: Handler | null = null;

export function setSyncHandler(next: Handler | null): void {
  handler = next;
}

/** แจ้งว่าข้อมูลเปลี่ยน (ids = ระบุเฉพาะรายการที่เปลี่ยน ถ้าไม่ระบุจะเทียบทั้งชุด) ไม่ทำอะไรในโหมดต้นแบบ */
export function queueSync(store: StoreName, ids?: string[]): void {
  handler?.(store, ids);
}

/** แจ้งส่วนต่างๆ ของแอปว่าข้อมูลจากเซิร์ฟเวอร์เข้ามาใหม่ (หน้าที่อ่านข้อมูลครั้งเดียวใช้ฟังเหตุการณ์นี้เพื่อโหลดใหม่) */
export const CLOUD_UPDATED_EVENT = 'growa-cloud-updated';
