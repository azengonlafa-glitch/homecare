/**
 * ข้อมูลสมาชิกแต่ละคนเก็บบนเซิร์ฟเวอร์เป็น 2 แถว (ดู supabase/health_privacy.sql)
 *   member_records = ส่วนที่ทุกคนในบ้านเห็น (อายุ เพศ รูป ค่าความเป็นส่วนตัว ฯลฯ)
 *   member_health  = ส่วนสุขภาพ ฐานข้อมูลส่งให้เฉพาะคนที่มีสิทธิ์ดู
 * ในเครื่องยังเก็บเป็นก้อนเดียวเหมือนเดิม ไฟล์นี้แยก/รวมให้
 */
export const PUBLIC_COLLECTION = 'member_records';
export const HEALTH_COLLECTION = 'member_health';

/** ฟิลด์ที่เป็นข้อมูลสุขภาพ (ต้องตรงกับ health_keys ใน supabase/health_privacy.sql) */
export const HEALTH_KEYS = ['health', 'meds', 'vitals', 'doseLogs', 'heightCm', 'weightKg'] as const;

/**
 * ป้ายในเครื่องเท่านั้น: เซิร์ฟเวอร์ไม่ส่งส่วนสุขภาพของคนนี้มา (เราไม่มีสิทธิ์ดู)
 * ใช้กันไม่ให้แอปส่งค่าว่างขึ้นไปทับข้อมูลจริงของเขา ไม่ส่งขึ้นเซิร์ฟเวอร์
 */
export const HIDDEN_FLAG = 'healthHidden';

type Rec = Record<string, unknown>;

export function splitRecord(record: Rec): { pub: Rec; health: Rec | null } {
  const pub: Rec = {};
  const health: Rec = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === HIDDEN_FLAG) continue;
    if ((HEALTH_KEYS as readonly string[]).includes(key)) {
      if (value !== undefined) health[key] = value;
    } else pub[key] = value;
  }
  // ส่วนสุขภาพที่เราไม่ได้รับมา ห้ามส่งกลับ (จะเป็นค่าว่างไปทับของจริง)
  return { pub, health: record[HIDDEN_FLAG] ? null : health };
}

/** รวมสองแถวกลับเป็นก้อนเดียว ถ้าไม่มีแถวสุขภาพ (ไม่มีสิทธิ์ดู) ติดป้ายซ่อนไว้ ยกเว้นข้อมูลของตัวเอง */
export function mergeRecord(id: string, pub: Rec | undefined, health: Rec | undefined, selfId: string): Rec {
  const merged: Rec = { ...(pub ?? {}), ...(health ?? {}), id };
  // ข้อมูลแบบเดิม (ก่อนรัน health_privacy.sql) ยังมีส่วนสุขภาพอยู่ในแถวเดียวกัน: ถือว่าได้รับมาแล้ว ไม่ติดป้ายซ่อน
  const legacyHealth = !!pub && HEALTH_KEYS.some((k) => k in pub);
  if (!health && !legacyHealth && id !== selfId) merged[HIDDEN_FLAG] = true;
  return merged;
}

/** รหัสรายการในคิวซิงก์: "collection:id" */
export const itemKey = (collection: string, id: string): string => `${collection}:${id}`;

export function parseItemKey(key: string): { collection: string; id: string } {
  const i = key.indexOf(':');
  return { collection: key.slice(0, i), id: key.slice(i + 1) };
}
