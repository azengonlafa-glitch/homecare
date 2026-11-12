import React, { useEffect, useState } from 'react';
import { Check, Eye, ShieldCheck, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageLayout } from '../../components/settings/PageLayout';
import { SwitchRow } from '../../components/settings/SwitchRow';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useToast } from '../../components/ui/Toast';
import { CURRENT_MEMBER_ID, loadSettings } from '../../lib/settings';
import {
  MEMBERS_CHANGED_EVENT,
  loadMemberRecord,
  saveMemberRecord,
  type MemberRecord,
} from '../../lib/members';
import {
  DECISION_LABEL,
  SCOPE_LABEL,
  decideRequest,
  memberNameById,
  pendingIncoming,
  useAccessRequests,
} from '../../lib/access';

type EditorChoice = 'allow' | 'block';

const requestCardClass = 'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs';

/**
 * ตั้งค่า › ความเป็นส่วนตัว
 * - เปิด/ปิดให้คนในบ้านดูข้อมูลของฉัน
 * - เลือกได้ว่าอนุญาตให้ใครแก้ไขข้อมูล (ทุกคน หรือเป็นรายคน / ห้าม)
 * - ตอบคำขออนุญาตที่ส่งมาถึงฉัน (อนุญาตครั้งนี้ / อนุญาตตลอด / ไม่อนุญาต)
 * - จัดเลย์เอาต์ responsive พอดีกับจอ: 2 คอลัมน์บนจอคอมพิวเตอร์/แท็บเล็ต และ 1 คอลัมน์บนมือถือ
 */
export const PrivacySettingsPage: React.FC = () => {
  const [record, setRecord] = useState<MemberRecord>(() => loadMemberRecord(CURRENT_MEMBER_ID));
  const requests = useAccessRequests();
  const toast = useToast();
  const settings = loadSettings();

  useEffect(() => {
    const refresh = () => setRecord(loadMemberRecord(CURRENT_MEMBER_ID));
    window.addEventListener(MEMBERS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(MEMBERS_CHANGED_EVENT, refresh);
  }, []);

  const update = (patch: Partial<MemberRecord['sharing']>) => {
    const next: MemberRecord = { ...record, sharing: { ...record.sharing, ...patch } };
    setRecord(next);
    saveMemberRecord(next);
    toast.show('บันทึกแล้ว');
  };

  const others = settings.members.filter((m) => m.id !== CURRENT_MEMBER_ID);
  const incoming = pendingIncoming(requests);
  const outgoing = requests.filter((r) => r.requesterId === CURRENT_MEMBER_ID && r.targetId !== CURRENT_MEMBER_ID);

  const decide = (id: string, decision: 'once' | 'always' | 'denied') => {
    decideRequest(id, decision);
    toast.show(`ตอบคำขอแล้ว: ${DECISION_LABEL[decision]}`);
  };

  const editorChoice = (memberId: string): EditorChoice =>
    record.sharing.blockedEditors.includes(memberId) ? 'block' : 'allow';

  const setEditorChoice = (memberId: string, choice: EditorChoice) => {
    const allowed = record.sharing.allowedEditors.filter((x) => x !== memberId);
    const blocked = record.sharing.blockedEditors.filter((x) => x !== memberId);
    update({
      allowedEditors: choice === 'allow' ? [...allowed, memberId] : allowed,
      blockedEditors: choice === 'block' ? [...blocked, memberId] : blocked,
    });
  };

  return (
    <PageLayout
      wide
      columns="custom"
      title="ความเป็นส่วนตัว"
      description="เลือกว่าใครดูข้อมูลของคุณได้ และใครแก้ไขได้"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* คอลัมน์ซ้าย: คำขอที่รอการตอบ และสิทธิ์การเข้าถึงข้อมูล */}
        <div className="space-y-6 lg:col-span-6">
          {/* คำขอที่ส่งมาถึงฉัน */}
          {incoming.length > 0 && (
            <Card className="shadow-xs border-amber-200">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
                <ShieldCheck className="w-6 h-6 text-purple-700 shrink-0" aria-hidden="true" />
                <span>คำขอที่ส่งมาถึงคุณ ({incoming.length})</span>
              </h2>

              <ul className="space-y-3">
                {incoming.map((req) => (
                  <li key={req.id} className={requestCardClass}>
                    <p className="text-base font-bold text-slate-900">
                      {memberNameById(req.requesterId)} ขอ{SCOPE_LABEL[req.scope]}
                    </p>
                    {req.message && (
                      <p className="mt-1 text-base text-slate-700 break-words">“{req.message}”</p>
                    )}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => decide(req.id, 'once')}
                        className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 text-base font-bold text-purple-900 hover:bg-purple-50 cursor-pointer transition-colors"
                      >
                        <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>อนุญาตครั้งนี้</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(req.id, 'always')}
                        className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-purple-700 px-3 text-base font-bold text-white hover:bg-purple-800 cursor-pointer transition-colors shadow-xs"
                      >
                        <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>อนุญาตตลอด</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(req.id, 'denied')}
                        className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-base font-bold text-red-700 hover:bg-red-50 cursor-pointer transition-colors"
                      >
                        <X className="w-5 h-5 shrink-0" aria-hidden="true" />
                        <span>ไม่อนุญาต</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* การเปิดเผยข้อมูลของฉัน */}
          <Card className="p-0 overflow-hidden shadow-xs">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">การเข้าถึงข้อมูลของฉัน</h2>
              <p className="text-sm text-slate-600 mt-0.5">กำหนดความยินยอมในการดูและแก้ไขข้อมูลสุขภาพ</p>
            </div>
            <div className="divide-y divide-slate-200">
              <SwitchRow
                className="rounded-none px-5 py-4"
                label="ให้คนในบ้านดูข้อมูลของฉัน"
                description="ถ้าปิดไว้ สมาชิกคนอื่นจะเห็นเพียงชื่อและบทบาท ไม่เห็นตารางยาและประวัติสุขภาพ"
                checked={record.sharing.shareData}
                onChange={(checked) => update({ shareData: checked })}
              />
              <SwitchRow
                className="rounded-none px-5 py-4"
                label="ให้ทุกคนในบ้านแก้ไขข้อมูลของฉันได้"
                description="ถ้าปิดไว้ จะอนุญาตเป็นรายคนด้านข้าง และยังต้องกดอนุมัติเมื่อมีคำขอ"
                checked={record.sharing.editPolicy === 'all'}
                onChange={(checked) => update({ editPolicy: checked ? 'all' : 'choose' })}
              />
            </div>
          </Card>

          {/* คำขอที่ฉันส่งไป */}
          {outgoing.length > 0 && (
            <Card className="shadow-xs">
              <h2 className="mb-3 text-lg font-bold text-slate-900">คำขอที่ฉันส่งไป</h2>
              <ul className="space-y-2">
                {outgoing.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-slate-200 p-3.5 bg-slate-50/50">
                    <p className="text-base font-bold text-slate-900">
                      ขอ{SCOPE_LABEL[r.scope]} · {memberNameById(r.targetId)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-600">
                      สถานะ: {DECISION_LABEL[r.decision]}
                      {r.decision === 'once' && r.usedAt ? ' (ใช้สิทธิ์แล้ว)' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* คอลัมน์ขวา: สิทธิ์แก้ไขรายบุคคล */}
        <div className="lg:col-span-6">
          <Card className="shadow-xs">
            <div className="mb-5">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Eye className="w-6 h-6 text-purple-700 shrink-0" aria-hidden="true" />
                <span>อนุญาตหรือห้ามรายคน</span>
              </h2>
              <p className="mt-1 text-base text-slate-600">
                “ห้าม” จะมีผลเหนือทุกอย่าง แม้จะเปิดให้ทุกคนแก้ไขก็ตาม
              </p>
            </div>

            {others.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-base text-slate-600">ยังไม่มีสมาชิกคนอื่นในบ้าน</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {others.map((m) => (
                  <li key={m.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="fit-row justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-slate-900 break-words">{m.name}</p>
                        <p className="text-sm font-medium text-slate-500">{m.relation}</p>
                      </div>
                      <div className="w-full sm:w-52 shrink-0 ml-auto">
                        <SegmentedControl
                          name={`editor-${m.id}`}
                          legend={`สิทธิ์แก้ไขข้อมูลของฉันสำหรับ ${m.name}`}
                          options={[
                            { value: 'allow', label: 'อนุญาต' },
                            { value: 'block', label: 'ห้าม' },
                          ]}
                          value={editorChoice(m.id)}
                          onChange={(v) => setEditorChoice(m.id, v)}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};
