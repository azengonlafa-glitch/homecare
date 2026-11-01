import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useToast } from '../../components/ui/Toast';
import { PageLayout } from '../../components/settings/PageLayout';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
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

const PERMISSION_OPTIONS: { value: MemberPermission; label: string }[] = [
  { value: 'edit', label: PERMISSION_LABELS.edit },
  { value: 'view', label: PERMISSION_LABELS.view },
];

const badgeClass = (permission: MemberPermission) =>
  cn(
    'shrink-0 inline-flex items-center px-3 min-h-[36px] rounded-full text-base font-bold border',
    permission === 'edit'
      ? 'bg-purple-100 text-purple-900 border-purple-200'
      : 'bg-slate-100 text-slate-700 border-slate-300'
  );

/** ตั้งค่า > สมาชิกในบ้าน */
export const MembersSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [removing, setRemoving] = useState<HouseholdMember | null>(null);
  const toast = useToast();

  const current = getCurrentMember(settings);
  // เฉพาะผู้ดูแลหลักที่มีสิทธิ์ "แก้ไขได้" เท่านั้นที่เปลี่ยนสิทธิ์หรือนำสมาชิกออกได้
  const canManage = !!current?.isOwner && current.permission === 'edit';
  const members = settings.members;

  const changePermission = (id: string, permission: MemberPermission) => {
    const next = saveSettings({
      ...settings,
      members: settings.members.map((member) => (member.id === id ? { ...member, permission } : member)),
    });
    setSettings(next);
    toast.show(`เปลี่ยนสิทธิ์เป็น ${PERMISSION_LABELS[permission]} แล้ว`);
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
    toast.show(`นำ ${name} ออกจากบ้านแล้ว`);
  };

  return (
    <PageLayout
      title="สมาชิกในบ้าน"
      description="แก้ไขได้ = เพิ่ม/แก้ไขยาได้ · ดูอย่างเดียว = ดูได้อย่างเดียว"
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
            {members.map((member) => {
              // ตัวควบคุมสิทธิ์แสดงเฉพาะแถวของสมาชิกอื่น และเฉพาะผู้ที่จัดการได้
              const editable = canManage && !member.isOwner;
              return (
                <li key={member.id} className="px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-900 break-words">
                        {member.name}
                        {member.id === CURRENT_MEMBER_ID && (
                          <span className="font-normal text-slate-600"> (คุณ)</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-base text-slate-600 break-words">
                        {member.relation}
                        {member.isOwner && ' · ผู้ดูแลหลัก'}
                      </p>
                    </div>

                    {/* สถานะเดียวต่อคน: ถ้าแก้ไขได้จะแสดงเป็นตัวเลือกด้านล่างแทน */}
                    {!editable && (
                      <span className={badgeClass(member.permission)}>
                        {PERMISSION_LABELS[member.permission]}
                      </span>
                    )}
                  </div>

                  {editable && (
                    <div className="mt-4">
                      <SegmentedControl
                        name={`permission-${member.id}`}
                        legend={`สิทธิ์ของ ${member.name}`}
                        options={PERMISSION_OPTIONS}
                        value={member.permission}
                        onChange={(permission) => changePermission(member.id, permission)}
                      />
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setRemoving(member)}
                          className="inline-flex items-center min-h-[48px] px-3 -mr-3 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
                        >
                          นำออก
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!removing}
        title={`นำ ${removing?.name ?? ''} ออกจากบ้าน?`}
        message={`${removing?.name ?? 'สมาชิกคนนี้'} จะเปิดดูข้อมูลของบ้านนี้ไม่ได้อีก ถ้าต้องการให้กลับมา ต้องชวนด้วยรหัสอีกครั้ง`}
        confirmLabel="นำออก"
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </PageLayout>
  );
};
