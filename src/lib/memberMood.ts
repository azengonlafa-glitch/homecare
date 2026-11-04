import { Frown, Meh, Smile, type LucideIcon } from 'lucide-react';
import { MOOD_TONE, moodMeta, type MoodKey } from '../data/journalOptions';
import { CURRENT_MEMBER_ID } from './settings';
import { JOURNAL_CHANGED_EVENT, loadPosts, newId, savePosts, type JournalPost } from './journal';
import { loadMemberRecord, saveMemberRecord, type MemberRecord } from './members';

export const MOOD_ICON: Record<MoodKey, LucideIcon> = {
  great: Smile,
  complicated: Meh,
  down: Frown,
};

export interface MemberTodayMood {
  main: MoodKey;
  details: string[];
  label: string;
  detail?: string;
  Icon: LucideIcon;
  toneBadge: string;
}

export function isToday(isoOrDate: string | Date): boolean {
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function todayKey(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** ดึงอารมณ์ของสมาชิกในวันนี้ (จากโพสต์ในบันทึกอาการ หรือจากบันทึกสมาชิก) */
export function getMemberTodayMood(
  memberId: string,
  memberName: string,
  record?: MemberRecord,
  posts?: JournalPost[]
): MemberTodayMood | null {
  const allPosts = posts ?? loadPosts();
  const isMe = memberId === CURRENT_MEMBER_ID;

  // 1. ค้นหาโพสต์ที่มีอารมณ์ของวันนี้ก่อน (เรียงจากใหม่สุดอยู่แล้ว)
  const post = allPosts.find((p) => {
    if (!p.moodMain || !isToday(p.createdAt)) return false;
    if (isMe) {
      return (
        p.authorId === memberId ||
        p.about === 'ตัวฉันเอง' ||
        p.about === memberName ||
        p.authorName === memberName
      );
    }
    return (
      p.authorId === memberId ||
      p.about === memberName ||
      p.authorName === memberName
    );
  });

  if (post && post.moodMain) {
    const meta = moodMeta(post.moodMain);
    return {
      main: post.moodMain,
      details: post.moodDetails || [],
      label: meta?.label || 'รู้สึกดี',
      detail: post.moodDetails?.[0],
      Icon: MOOD_ICON[post.moodMain],
      toneBadge: MOOD_TONE[post.moodMain].badge,
    };
  }

  // 2. ถ้ายังไม่มีโพสต์ ให้ดูจากประวัติบันทึกสมาชิกของวันนี้
  const memberRecord = record ?? loadMemberRecord(memberId);
  const todayMood = memberRecord?.todayMood;
  if (todayMood && todayMood.date === todayKey() && todayMood.main) {
    const main = todayMood.main;
    const meta = moodMeta(main);
    return {
      main,
      details: todayMood.details || [],
      label: meta?.label || 'รู้สึกดี',
      detail: todayMood.details?.[0],
      Icon: MOOD_ICON[main],
      toneBadge: MOOD_TONE[main].badge,
    };
  }

  return null;
}

/** บันทึกอารมณ์ของวันนี้สำหรับสมาชิก */
export function saveMemberTodayMood(
  memberId: string,
  memberName: string,
  main: MoodKey | null,
  details: string[] = []
): void {
  const rec = loadMemberRecord(memberId);
  rec.todayMood = main
    ? {
        date: todayKey(),
        main,
        details,
      }
    : null;
  saveMemberRecord(rec);

  if (main) {
    const posts = loadPosts();
    const todayPost = posts.find((p) => {
      if (!isToday(p.createdAt)) return false;
      return (
        p.authorId === memberId ||
        (memberId === CURRENT_MEMBER_ID && p.about === 'ตัวฉันเอง') ||
        p.about === memberName
      );
    });

    if (todayPost) {
      todayPost.moodMain = main;
      todayPost.moodDetails = details;
      savePosts(posts);
    } else {
      const meta = moodMeta(main);
      posts.unshift({
        id: newId(),
        authorId: memberId,
        authorName: memberName,
        about: memberId === CURRENT_MEMBER_ID ? 'ตัวฉันเอง' : memberName,
        title: `บันทึกอารมณ์: ${meta?.label ?? 'รู้สึกดี'}`,
        content: details.length > 0 ? `รู้สึก: ${details.join(', ')}` : '',
        symptoms: [],
        moodMain: main,
        moodDetails: details,
        photo: null,
        createdAt: new Date().toISOString(),
        editedAt: null,
        likes: [],
        comments: [],
      });
      savePosts(posts);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(JOURNAL_CHANGED_EVENT));
  }
}

