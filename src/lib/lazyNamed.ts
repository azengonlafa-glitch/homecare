import { lazy, type ComponentType } from 'react';

/** React.lazy สำหรับโมดูลที่ส่งออกแบบมีชื่อ (ไม่ใช่ default) ใช้แยกหน้าที่ไม่ได้ใช้ทุกครั้งออกจากไฟล์หลัก ให้เปิดเว็บเร็วขึ้น */
export function lazyNamed<K extends string, T extends ComponentType<any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  load: () => Promise<Record<K, T>>,
  name: K
) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}
