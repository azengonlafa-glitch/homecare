import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lock, Users } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { cn } from '../lib/cn';
import { CURRENT_MEMBER_ID, ROLE_META, loadSettings, type HouseholdMember } from '../lib/settings';
import { genderLabel, loadMemberRecords, MEMBERS_CHANGED_EVENT, type MemberRecord } from '../lib/members';
import { canViewMember, pendingIncoming, useAccessRequests } from '../lib/access';
import { SETTINGS_CHANGED_EVENT } from '../lib/settings';

/** ป้ายบทบาทแบบสั้น (ให้พอดีบัตรสี่เหลี่ยม) */
const SHORT_ROLE: Record<HouseholdMember['role'], string> = {
  owner: 'ผู้ดูแลบ้าน',
  member: 'สมาชิก',
  external: 'ผู้ดูแลภายนอก',
};

/** บัตรสมาชิกแบบสี่เหลี่ยมจัตุรัส: รูป ชื่อ อายุ เพศ และบทบาท */
const MemberTile: React.FC<{ member: HouseholdMember; record: MemberRecord; viewable: boolean }> = ({
  member,
  record,
  viewable,
}) => {
  const isMe = member.id === CURRENT_MEMBER_ID;
  const photo = isMe ? loadSettings().profile.photo : record.photo;
  const hiddenFromOthers = isMe ? !record.sharing.shareData : !viewable;

  return (
    <Link
      to={`/members/${member.id}`}
      className={cn(
        'group flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl border-2 bg-white p-3 text-center hover-lift',
        'hover:border-purple-300 hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600',
        isMe ? 'border-purple-300 bg-purple-50/60' : 'border-slate-200'
      )}
    >
      <Avatar src={photo} name={member.name} className="h-12 w-12 shrink-0 text-xl sm:h-14 sm:w-14 sm:text-2xl" />
      <span className="mt-1 w-full shrink-0 truncate text-base font-bold text-slate-900 sm:text-lg">
        {member.name}
      </span>
      <span className="shrink-0 text-sm text-slate-600">
        {record.age ? `${record.age} ปี` : 'ไม่ระบุอายุ'} · {genderLabel(record.gender)}
      </span>
      <span className="mt-1 inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
        <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', ROLE_META[member.role].dot)} />
        <span className="truncate">{SHORT_ROLE[member.role]}</span>
      </span>
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
 * สมาชิกในบ้าน: การ์ดสี่เหลี่ยมของทุกคนในบ้าน (รูป ชื่อ อายุ เพศ บทบาท)
 * แตะการ์ดเพื่อดูตารางยาและประวัติสุขภาพของคนนั้น และขออนุญาตแก้ไขข้อมูลได้
 */
export const MembersPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [records, setRecords] = useState(loadMemberRecords);
  const requests = useAccessRequests();

  useEffect(() => {
    const refresh = () => {
      setSettings(loadSettings());
      setRecords(loadMemberRecords());
    };
    window.addEventListener(MEMBERS_CHANGED_EVENT, refresh);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(MEMBERS_CHANGED_EVENT, refresh);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
    };
  }, []);

  const pending = pendingIncoming(requests).length;

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

      <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {settings.members.map((member) => {
          const record = records[member.id];
          if (!record) return null;
          return (
            <li key={member.id}>
              <MemberTile
                member={member}
                record={record}
                viewable={canViewMember(record, CURRENT_MEMBER_ID, requests)}
              />
            </li>
          );
        })}
      </ul>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-base sm:text-lg font-bold text-slate-900">ความเป็นส่วนตัวของฉัน</p>
          <p className="mt-0.5 text-base text-slate-600">
            เลือกได้ว่าใครดูข้อมูลของฉันได้ และใครแก้ไขได้บ้าง
          </p>
        </div>
        <Link
          to="/settings/privacy"
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 px-5 text-base font-bold text-purple-900 hover:bg-purple-100"
        >
          ตั้งค่าความเป็นส่วนตัว
        </Link>
      </Card>
    </div>
  );
};
