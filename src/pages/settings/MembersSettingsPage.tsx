import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/ChoiceChips';
import { PageLayout } from '../../components/settings/PageLayout';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { SavedNote } from '../../components/settings/SavedNote';
import { cn } from '../../lib/cn';
import {
  CURRENT_MEMBER_ID,
  PERMISSION_LABELS,
  getCurrentMember,
  loadSettings,
  saveSettings,
  type HouseholdMember,
  type MemberPermission,
} from '../../lib/settings';

const badgeClass = (permission: MemberPermission) =>
  cn(
    'shrink-0 inline-flex items-center px-3 min-h-[32px] rounded-full text-sm font-bold border',
    permission === 'edit'
      ? 'bg-purple-100 text-purple-900 border-purple-200'
      : 'bg-slate-100 text-slate-700 border-slate-200'
  );

/** ตั้งค่า > สมาชิกในบ้าน */
export const MembersSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [removing, setRemoving] = useState<HouseholdMember | null>(null);
  const [status, setStatus] = useState('');

  const current = getCurrentMember(settings);
  const canManage = !!current?.isOwner && current.permission === 'edit';
  const members = settings.members;

  const changePermission = (id: string, permission: MemberPermission) => {
    const next = saveSettings({
      ...settings,
      members: settings.members.map((member) => (member.id === id ? { ...member, permission } : member)),
    });
    setSettings(next);
    setStatus(`เปลี่ยนสิทธิ์เป็น ${PERMISSION_LABELS[permission]} แล้ว`);
  };

  const confirmRemove = () => {
    if (!removing) return;
    const name = removing.name;
    const next = saveSettings({
      ...settings,
      members: settings.members.filter((member) => member.id !== removing.id),
    });
    setSettings(next);
    setRemoving(null);
    setStatus(`นำ ${name} ออกจากบ้านแล้ว`);
  };

  return (
    <PageLayout
      title="สมาชิกในบ้าน"
      description="ให้สิทธิ์เท่าที่จำเป็นกับคนในครอบครัว"
    >
      {!canManage && (
        <Card className="bg-amber-50 border-amber-200">
          <p className="text-base font-semibold text-amber-900 break-words">
            คุณมีสิทธิ์ “ดูอย่างเดียว” จึงเปลี่ยนสิทธิ์หรือนำสมาชิกออกไม่ได้
          </p>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {members.length === 0 ? (
          <p className="px-5 py-10 text-center text-base text-slate-600">ยังไม่มีสมาชิกในบ้านนี้</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {members.map((member) => (
              <li key={member.id} className="px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-bold text-slate-900 break-words">
                      {member.name}
                      {member.id === CURRENT_MEMBER_ID && (
                        <span className="font-normal text-slate-600"> (คุณ)</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600 break-words">
                      {member.relation}
                      {member.isOwner && ' · ผู้ดูแลหลัก'}
                    </p>
                  </div>
                  <span className={badgeClass(member.permission)}>{PERMISSION_LABELS[member.permission]}</span>
                </div>

                {canManage && !member.isOwner && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Chip
                      selected={member.permission === 'edit'}
                      onClick={() => changePermission(member.id, 'edit')}
                    >
                      แก้ไขได้
                    </Chip>
                    <Chip
                      selected={member.permission === 'view'}
                      onClick={() => changePermission(member.id, 'view')}
                    >
                      ดูอย่างเดียว
                    </Chip>

                    <button
                      type="button"
                      onClick={() => setRemoving(member)}
                      className="ml-auto inline-flex items-center gap-1.5 min-h-[48px] px-4 rounded-full bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 text-base font-bold text-red-700 transition-colors cursor-pointer"
                    >
                      <UserMinus className="w-5 h-5" aria-hidden="true" />
                      <span>นำออก</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SavedNote show={!!status}>{status}</SavedNote>

      <ConfirmDialog
        open={!!removing}
        title={`นำ ${removing?.name ?? ''} ออกจากบ้าน?`}
        message={`เมื่อนำออกแล้ว ${removing?.name ?? 'สมาชิกคนนี้'} จะเปิดดูข้อมูลของบ้านนี้ไม่ได้อีก`}
        confirmLabel="นำออก"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </PageLayout>
  );
};
