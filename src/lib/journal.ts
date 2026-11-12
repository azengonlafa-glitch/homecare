import { queueSync } from '../cloud/queue';
import type { Attachment } from './onboarding';
import type { MoodKey } from '../data/journalOptions';
import type { VitalValues } from './dailyRecord';

const JOURNAL_KEY = 'growa_journal_v1';

export interface JournalComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface JournalPost {
  id: string;
  authorId: string;
  authorName: string;
  /** บันทึกอาการของใคร เช่น "ตัวฉันเอง" "พ่อสมชาย" */
  about: string;
  title: string;
  content: string;
  symptoms: string[];
  moodMain: MoodKey | null;
  moodDetails: string[];
  /** รูปประกอบ 1 รูป (ตัวไฟล์เก็บใน IndexedDB) */
  photo: Attachment | null;
  /** ค่าสุขภาพที่วัดพร้อมบันทึกนี้ (ไม่มี = ไม่ได้วัด) ถูกคัดลอกไปเป็นประวัติสุขภาพของสมาชิกด้วย */
  vitals?: VitalValues | null;
  createdAt: string;
  editedAt: string | null;
  /** รหัสผู้ใช้ที่กดถูกใจ */
  likes: string[];
  comments: JournalComment[];
}

export interface JournalUser {
  id: string;
  name: string;
}

export const SELF_LABEL = 'ตัวฉันเอง';

export const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** ผู้ใช้ปัจจุบันจากข้อมูลล็อกอินจำลอง (ยังไม่มีเซิร์ฟเวอร์ รหัสผู้ใช้ใช้อีเมล) */
export function currentJournalUser(): JournalUser {
  try {
    const saved = localStorage.getItem('growa_auth_user');
    if (saved) {
      const user = JSON.parse(saved) as { id?: string; name?: string; email?: string };
      const id = user.id || user.email || 'guest';
      return { id, name: user.name || user.email?.split('@')[0] || 'ฉัน' };
    }
  } catch {
    // ข้อมูลล็อกอินเสีย: ใช้ค่าเริ่มต้น
  }
  return { id: 'guest', name: 'ฉัน' };
}

/** โพสต์ใหม่สุดอยู่บน */
export function loadPosts(): JournalPost[] {
  try {
    const item = localStorage.getItem(JOURNAL_KEY);
    if (item) {
      const posts = JSON.parse(item) as JournalPost[];
      return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  } catch {
    // ข้อมูลเสีย: เริ่มใหม่
  }
  return [];
}

export const JOURNAL_CHANGED_EVENT = 'growa-journal-changed';

export function savePosts(posts: JournalPost[]): void {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(posts));
  } catch (err) {
    console.error('Failed to save journal to localStorage', err);
  }
  queueSync('journal');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(JOURNAL_CHANGED_EVENT));
  }
}

export function clearJournal(): void {
  try {
    localStorage.removeItem(JOURNAL_KEY);
  } catch {
    // ข้ามได้
  }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "วันนี้" / "เมื่อวาน" / "1 พฤศจิกายน 2569" ใช้จัดกลุ่มโพสต์ตามวัน */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';
  return date.toLocaleDateString('th-TH', { dateStyle: 'long' });
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
