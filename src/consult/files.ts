import type { Attachment } from '../lib/onboarding';

/**
 * ไฟล์แนบของการปรึกษา แยกจาก lib/fileStore โดยตั้งใจ
 * fileStore อัปโหลดเข้า bucket ของบ้านอัตโนมัติ ซึ่งสมาชิกทุกคนในบ้านเปิดได้ แต่รูปอาการต้องเห็นเฉพาะผู้ใช้กับผู้ให้บริการ
 * ไฟล์จะอยู่ในเครื่องจนกว่าผู้ใช้จะยืนยันส่ง
 */
const DB_NAME = 'growa_consult_files_v1';
const STORE = 'files';

export const MAX_CONSULT_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_CONSULT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
export const CONSULT_FILE_ACCEPT = ALLOWED_CONSULT_TYPES.join(',');

export const newUuid = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

/** คืนข้อความผิดพลาดภาษาไทย หรือ null ถ้าไฟล์ใช้ได้ */
export function validateConsultFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (file.size > MAX_CONSULT_FILE_BYTES) return 'ไฟล์ใหญ่เกิน 20 MB';
  if (!ALLOWED_CONSULT_TYPES.includes(file.type)) return 'แนบได้เฉพาะรูปภาพหรือไฟล์ PDF';
  return null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexeddb-unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveLocalFile(file: File): Promise<Attachment> {
  const problem = validateConsultFile(file);
  if (problem) throw new Error(problem);
  const id = newUuid();
  await run('readwrite', (store) => store.put(file, id));
  return { id, name: file.name, type: file.type, size: file.size };
}

/** เก็บสำเนาไฟล์จากข้อมูลสุขภาพ เพื่อส่งไปกับรายงานภายใต้สิทธิ์ของการปรึกษานี้ */
export const putLocalFile = (id: string, blob: Blob) => run('readwrite', (store) => store.put(blob, id));

export const getLocalFile = (id: string) => run<Blob | undefined>('readonly', (store) => store.get(id));

export async function deleteLocalFile(id: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    // ลบไม่สำเร็จไม่กระทบการใช้งาน
  }
}
