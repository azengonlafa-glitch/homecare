import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, House, Lock, Smile, Users } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { MoodPickerModal } from '../components/journal/MoodPickerModal';
import { cn } from '../lib/cn';
import { CURRENT_MEMBER_ID, ROLE_META, canManageHome, loadSettings, type HouseholdMember } from '../lib/settings';
import { genderLabel, loadMemberRecords, MEMBERS_CHANGED_EVENT, type MemberRecord } from '../lib/members';
import { canViewMember, pendingIncoming, useAccessRequests } from '../lib/access';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';
import { JOURNAL_CHANGED_EVENT, loadPosts, type JournalPost } from '../lib/journal';
import { getMemberTodayMood, saveMemberTodayMood, type MemberTodayMood } from '../lib/memberMood';
import type { MoodKey } from '../data/journalOptions';

/** ป้ายบทบาทแบบสั้น (ให้พอดีบัตรสี่เหลี่ยม) */
const SHORT_ROLE: Record<HouseholdMember['role'], string> = {
  owner: 'ผู้ดูแลหลัก',
  member: 'สมาชิก',
  external: 'ผู้ดูแลภายนอก',
};

/** บัตรสมาชิก: รูปโปรไฟล์ใหญ่ขึ้น ชื่อ อายุ เพศ บทบาท และอารมณ์ในวันนั้น */
const MemberTile: React.FC<{
  member: HouseholdMember;
  record: MemberRecord;
  viewable: boolean;
  todayMood: MemberTodayMood | null;
  onOpenMoodPicker?: () => void;
}> = ({ member, record, viewable, todayMood, onOpenMoodPicker }) => {
  const isMe = member.id === CURRENT_MEMBER_ID;
  const photo = isMe ? loadSettings().profile.photo : record.photo;
  const hiddenFromOthers = isMe ? !record.sharing.shareData : !viewable;

  return (
    <Link
      to={`/members/${member.id}`}
      className={cn(
        'group flex min-h-[210px] sm:min-h-[230px] h-full flex-col items-center justify-center gap-1.5 rounded-3xl border-2 bg-white p-4 sm:p-5 text-center hover-lift',
        'hover:border-purple-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600',
        isMe ? 'border-purple-300 bg-purple-50/50' : 'border-slate-200'
      )}
    >
      <Avatar
        src={photo}
        name={member.name}
        className="h-16 w-16 shrink-0 text-2xl sm:h-20 sm:w-20 sm:text-3xl shadow-xs ring-2 ring-white"
      />
      <span className="mt-1 w-full shrink-0 truncate text-base font-bold text-slate-900 sm:text-lg">
        {member.name}
      </span>
      <span className="shrink-0 text-xs sm:text-sm text-slate-600">
        {record.age ? `${record.age} ปี` : 'ไม่ระบุอายุ'} · {genderLabel(record.gender)}
      </span>

      {/* แถวป้าย: บทบาท และ อารมณ์ในวันนั้น */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 max-w-full">
        {/* ป้ายบทบาท */}
        <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
          <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', ROLE_META[member.role].dot)} />
          <span className="truncate">{SHORT_ROLE[member.role]}</span>
        </span>

        {/* ป้ายอารมณ์ในวันนั้น */}
        {todayMood ? (
          <span
            onClick={(e) => {
              if (isMe && onOpenMoodPicker) {
                e.preventDefault();
                e.stopPropagation();
                onOpenMoodPicker();
              }
            }}
            title={
              isMe
                ? `อารมณ์วันนี้: ${todayMood.label}${todayMood.detail ? ` (${todayMood.detail})` : ''} · แตะเพื่อเปลี่ยน`
                : `อารมณ์วันนี้: ${todayMood.label}${todayMood.detail ? ` (${todayMood.detail})` : ''}`
            }
            className={cn(
              'inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border transition-transform',
              todayMood.toneBadge,
              isMe && 'cursor-pointer hover:scale-105 active:scale-95'
            )}
          >
            <todayMood.Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{todayMood.detail || todayMood.label}</span>
          </span>
        ) : isMe && onOpenMoodPicker ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenMoodPicker();
            }}
            title="แตะเพื่อบันทึกอารมณ์ของคุณวันนี้"
            className="relative inline-flex max-w-full shrink-0 items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-sm font-bold text-purple-700 hover:bg-purple-100 cursor-pointer transition-transform hover:scale-105 active:scale-95 before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
          >
            <Smile className="w-3.5 h-3.5 shrink-0 text-purple-600" aria-hidden="true" />
            <span className="truncate sm:hidden">+ อารมณ์</span>
            <span className="truncate hidden sm:inline">+ บันทึกอารมณ์</span>
          </button>
        ) : (
          <span
            title="ยังไม่มีบันทึกอารมณ์ในวันนี้"
            className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-sm font-medium text-slate-600"
          >
            <Smile className="w-3.5 h-3.5 shrink-0 text-slate-300" aria-hidden="true" />
            <span className="truncate sm:hidden">ยังไม่ระบุ</span>
            <span className="truncate hidden sm:inline">ยังไม่ระบุอารมณ์</span>
          </span>
        )}
      </div>

      {hiddenFromOthers && (
        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-800">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          {isMe ? 'คุณซ่อนข้อมูลอยู่' : 'ข้อมูลถูกซ่อน'}
        </span>
      )}
    </Link>
  );
};

/**
 * สมาชิกในบ้าน: การ์ดสี่เหลี่ยมของทุกคนในบ้าน (รูป ชื่อ อายุ เพศ บทบาท และอารมณ์ในวันนั้น)
 * แตะการ์ดเพื่อดูตารางยาและประวัติสุขภาพของคนนั้น และขออนุญาตแก้ไขข้อมูลได้
 */
export const MembersPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [records, setRecords] = useState(loadMemberRecords);
  const [posts, setPosts] = useState<JournalPost[]>(loadPosts);
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const requests = useAccessRequests();

  const refresh = () => {
    setSettings(loadSettings());
    setRecords(loadMemberRecords());
    setPosts(loadPosts());
  };

  useEffect(() => {
    window.addEventListener(MEMBERS_CHANGED_EVENT, refresh);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener(JOURNAL_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(MEMBERS_CHANGED_EVENT, refresh);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const myMember = settings.members.find((m) => m.id === CURRENT_MEMBER_ID);
  const myName = myMember?.name || [settings.profile.firstName, settings.profile.lastName].filter(Boolean).join(' ') || 'ฉัน';
  const myMood = getMemberTodayMood(CURRENT_MEMBER_ID, myName, records[CURRENT_MEMBER_ID], posts);

  const handleSaveMyMood = (main: MoodKey | null, details: string[]) => {
    saveMemberTodayMood(CURRENT_MEMBER_ID, myName, main, details);
    setMoodPickerOpen(false);
    refresh();
  };

  const pending = pendingIncoming(requests).length;
  const isOwner = canManageHome(settings);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ระบบบ้าน"
        title="สมาชิกในบ้าน"
        description="แตะที่บัตรของใคร เพื่อดูตารางยาและประวัติสุขภาพของคนนั้น"
      />

      {pending > 0 && (
        <Link to="/settings/privacy" className="block">
          <Card interactive className="flex items-center gap-3 border-amber-200 bg-amber-50/70">
            <Users className="w-6 h-6 shrink-0 text-amber-700" aria-hidden="true" />
            <span className="flex-1 min-w-0 text-base font-bold text-slate-900">
              มีคำขออนุญาตเข้าถึงข้อมูลรอคุณตอบ {pending} รายการ
            </span>
            <ChevronRight className="w-6 h-6 shrink-0 text-slate-500" aria-hidden="true" />
          </Card>
        </Link>
      )}

      <ul className="stagger tile-cycle grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
        {settings.members.map((member) => {
          const record = records[member.id];
          if (!record) return null;
          const todayMood = getMemberTodayMood(member.id, member.name, record, posts);
          return (
            <li key={member.id}>
              <MemberTile
                member={member}
                record={record}
                viewable={canViewMember(record, CURRENT_MEMBER_ID, requests)}
                todayMood={todayMood}
                onOpenMoodPicker={member.id === CURRENT_MEMBER_ID ? () => setMoodPickerOpen(true) : undefined}
              />
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <Link
          to="/home-settings"
          className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-base font-bold text-slate-900 hover:border-purple-300 hover:bg-purple-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
        >
          <House className="h-5 w-5" aria-hidden="true" />
          ตั้งค่าบ้าน
        </Link>
      )}

      <MoodPickerModal
        open={moodPickerOpen}
        onClose={() => setMoodPickerOpen(false)}
        main={myMood?.main ?? null}
        details={myMood?.details ?? []}
        onSave={handleSaveMyMood}
      />
    </div>
  );
};
