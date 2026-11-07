import { getFile } from '../lib/fileStore';
import type { FolderDoc } from '../lib/folders';
import type { Attachment } from '../lib/onboarding';
import { newUuid, putLocalFile, validateConsultFile } from './files';

/**
 * เลือกเอกสารจากโฟลเดอร์ส่งให้ผู้เชี่ยวชาญ: ทำสำเนาไว้ในที่เก็บไฟล์ของระบบปรึกษา (แยกจากที่เก็บของบ้านโดยตั้งใจ)
 * ต้นฉบับในโฟลเดอร์ไม่ถูกแตะ และสำเนาไปถึงผู้เชี่ยวชาญก็ต่อเมื่อผู้ใช้กดส่งเอง
 */

/** ส่งได้เฉพาะรูปกับ PDF ขนาดไม่เกินที่ระบบปรึกษากำหนด คืนเหตุผลถ้าส่งไม่ได้ */
export const consultBlocker = (doc: FolderDoc): string | null => validateConsultFile({ size: doc.attachment.size, type: doc.attachment.type });

const extensionOf = (name: string) => (name.match(/\.[^.]{1,8}$/)?.[0] ?? '').toLowerCase();

export async function copyToConsult(doc: FolderDoc): Promise<Attachment> {
  const blocker = consultBlocker(doc);
  if (blocker) throw new Error(`${doc.title}: ${blocker}`);
  const blob = await getFile(doc.attachment.id);
  if (!blob) throw new Error(`${doc.title}: หาไฟล์ไม่เจอในเครื่องนี้ ลองเปิดดูไฟล์ในโฟลเดอร์ก่อน`);
  const id = newUuid();
  await putLocalFile(id, blob);
  return { id, name: `${doc.title}${extensionOf(doc.attachment.name)}`, type: doc.attachment.type, size: doc.attachment.size };
}

/** คัดลอกหลายไฟล์ ไฟล์ไหนไม่ได้ก็แจ้งแยก ไม่ล้มทั้งชุด */
export async function copyManyToConsult(docs: FolderDoc[]): Promise<{ attached: Attachment[]; problems: string[] }> {
  const attached: Attachment[] = [];
  const problems: string[] = [];
  for (const doc of docs) {
    try {
      attached.push(await copyToConsult(doc));
    } catch (err) {
      problems.push(err instanceof Error ? err.message : `${doc.title}: แนบไม่สำเร็จ`);
    }
  }
  return { attached, problems };
}
