import type { Attachment } from './onboarding';

/**
 * เก็บไฟล์ที่ผู้ใช้แนบไว้ใน IndexedDB ของเบราว์เซอร์
 * (localStorage เก็บไฟล์ไม่ได้เพราะจำกัดประมาณ 5 MB และเก็บได้แต่ข้อความ)
 * ใน localStorage เก็บแค่ข้อมูลอ้างอิงไฟล์ (Attachment) เท่านั้น
 */
const DB_NAME = 'growa_files_v1';
const STORE = 'files';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_LABEL = '20 MB';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('indexeddb-unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // ถ้าเปิดไม่สำเร็จ ให้ลองใหม่ได้ในครั้งถัดไป
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function saveFile(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error('too-large');
  const id = newId();
  await run('readwrite', (store) => store.put(file, id));
  return { id, name: file.name, type: file.type, size: file.size };
}

export async function getFile(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', (store) => store.get(id));
}

export async function deleteFile(id: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(id));
  } catch {
    // ลบไม่สำเร็จไม่กระทบการใช้งาน
  }
}

export const deleteFiles = (items: Attachment[] = []) => Promise.all(items.map((a) => deleteFile(a.id)));

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** เปิดไฟล์ในแท็บใหม่ (รูป/PDF) ถ้าเบราว์เซอร์เปิดไม่ได้จะดาวน์โหลดแทน */
export async function openAttachment(attachment: Attachment): Promise<boolean> {
  const blob = await getFile(attachment.id);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const previewable = attachment.type.startsWith('image/') || attachment.type === 'application/pdf';
  if (previewable && window.open(url, '_blank')) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** ลบไฟล์แนบทั้งหมด (ใช้ตอนเริ่มต้น Demo ใหม่) */
export async function clearAllFiles(): Promise<void> {
  try {
    await run('readwrite', (store) => store.clear());
  } catch {
    // เปิดที่เก็บไฟล์ไม่ได้: ไม่มีอะไรให้ลบ
  }
}
