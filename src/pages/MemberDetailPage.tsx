import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Clock,
  HeartPulse,
  Lock,
  PencilLine,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Chip } from '../components/ui/ChoiceChips';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';
import {
  CURRENT_MEMBER_ID,
  ROLE_META,
  SETTINGS_CHANGED_EVENT,
  loadSettings,
  type HouseholdMember,
} from '../lib/settings';
import {
  GENDER_LABEL,
  MEMBERS_CHANGED_EVENT,
  loadMemberRecord,
  memberMeds,
  saveMemberRecord,
  type MemberMed,
  type MemberRecord,
} from '../lib/members';
import {
  ACCESS_CHANGED_EVENT,
  REQUEST_MESSAGE_MAX,
  canEditMember,
  canViewMember,
  consumeOnce,
  decideRequest,
  requestsFor,
  requestAccess,
  useAccessRequests,
} from '../lib/access';
import { PERIODS, PERIOD_LABEL, type DosePeriod } from '../lib/meds';

const DEFAULT_TIME: Record<DosePeriod, string> = {
  morning: '08:00',
  noon: '12:00',
  evening: '18:00',
  bedtime: '21:00',
};

const newMedId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const roleBadge = 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700';

const SectionTitle: React.FC<{ icon: React.ElementType; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
    <Icon className="w-6 h-6 text-purple-700" aria-hidden="true" />
    <span>{children}</span>
  </h2>
);

// ---------- กล่องขออนุญาต ----------

const RequestDialog: React.FC<{
  memberName: string;
  scope: 'view' | 'edit';
  onClose: () => void;
  onSend: (message: string) => void;
}> = ({ memberName, scope, onClose, onSend }) => {
  const [message, setMessage] = useState(
    scope === 'edit' ? `ขออนุญาตจัดตารางยาให้${memberName}นะคะ` : `ขออนุญาตดูข้อมูลสุขภาพของ${memberName}`
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={scope === 'edit' ? 'ขออนุญาตแก้ไขข้อมูล' : 'ขออนุญาตดูข้อมูล'}
      initialFocusSelector="#access-message"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={() => onSend(message)}>
            <Send className="w-5 h-5" aria-hidden="true" />
            <span>ส่งคำขอ</span>
          </Button>
        </div>
      }
    >
      <div className="py-5 space-y-4">
        <p className="text-base text-slate-700">
          ระบบจะส่งการแจ้งเตือนไปหา <span className="font-bold">{memberName}</span> เพื่อขออนุญาต
          {scope === 'edit' ? 'แก้ไขข้อมูลและจัดตารางยา' : 'ดูข้อมูล'}
        </p>
        <TextField
          id="access-message"
          label="ข้อความถึงเจ้าของข้อมูล"
          hint={`ไม่เกิน ${REQUEST_MESSAGE_MAX} ตัวอักษร`}
          value={message}
          maxLength={REQUEST_MESSAGE_MAX}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
    </Modal>
  );
};

// ---------- ตัวแก้ไขตารางยา ----------

const ScheduleDialog: React.FC<{
  record: MemberRecord;
  memberName: string;
  onClose: () => void;
  onSave: (meds: MemberMed[], note: string) => void;
}> = ({ record, memberName, onClose, onSave }) => {
  const [meds, setMeds] = useState<MemberMed[]>(record.meds);
  const [note, setNote] = useState(record.health.note);

  const patch = (id: string, changes: Partial<MemberMed>) =>
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));

  const togglePeriod = (med: MemberMed, period: DosePeriod) => {
    const has = med.periods.includes(period);
    const periods = has ? med.periods.filter((p) => p !== period) : [...med.periods, period];
    patch(med.id, {
      periods,
      times: has ? med.times : { ...med.times, [period]: med.times[period] ?? DEFAULT_TIME[period] },
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`แก้ไขตารางยาของ ${memberName}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={() => onSave(meds.filter((m) => m.name.trim()), note)}>
            บันทึก
          </Button>
        </div>
      }
    >
      <div className="py-5 space-y-4">
        {meds.length === 0 && <p className="text-base text-slate-600">ยังไม่มียาในตาราง เพิ่มรายการแรกได้เลย</p>}

        {meds.map((med) => (
          <div key={med.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <TextField
                  id={`med-name-${med.id}`}
                  label="ชื่อยา"
                  value={med.name}
                  onChange={(e) => patch(med.id, { name: e.target.value })}
                />
              </div>
              <button
                type="button"
                aria-label={`ลบ ${med.name || 'รายการยา'}`}
                onClick={() => setMeds((prev) => prev.filter((m) => m.id !== med.id))}
                className="mt-8 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">มื้อที่กิน</p>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => (
                  <Chip key={p.value} selected={med.periods.includes(p.value)} onClick={() => togglePeriod(med, p.value)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>

            {med.periods.length > 0 && (
              <div className="space-y-2">
                {med.periods.map((p) => (
                  <label key={p} className="flex min-h-[48px] items-center justify-between gap-3">
                    <span className="text-base text-slate-700">เวลา {PERIOD_LABEL[p]}</span>
                    <input
                      type="time"
                      value={med.times[p] ?? DEFAULT_TIME[p]}
                      onChange={(e) => patch(med.id, { times: { ...med.times, [p]: e.target.value } })}
                      className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        <Button
          variant="soft"
          fullWidth
          onClick={() =>
            setMeds((prev) => [
              ...prev,
              { id: newMedId(), name: '', dose: '', periods: ['morning'], times: { morning: DEFAULT_TIME.morning } },
            ])
          }
        >
          + เพิ่มรายการยา
        </Button>

        <TextField
          id="member-note"
          label="บันทึกเพิ่มเติมด้านสุขภาพ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
};

// ---------- หน้าหลัก ----------

/** รายละเอียดสมาชิก: ตารางยา + ประวัติสุขภาพ พร้อมระบบขออนุญาตดู/แก้ไขข้อมูล */
export const MemberDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const requests = useAccessRequests();
  const [settings, setSettings] = useState(loadSettings);
  const [record, setRecord] = useState<MemberRecord>(() => loadMemberRecord(id));
  const [dialog, setDialog] = useState<'view' | 'edit' | 'schedule' | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSettings(loadSettings());
      setRecord(loadMemberRecord(id));
    };
    window.addEventListener(MEMBERS_CHANGED_EVENT, refresh);
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    refresh();
    return () => {
      window.removeEventListener(MEMBERS_CHANGED_EVENT, refresh);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
    };
  }, [id]);

  const member: HouseholdMember | undefined = settings.members.find((m) => m.id === id);

  if (!member) {
    return (
      <div className="space-y-4">
        <Link to="/members" className="inline-flex items-center gap-1 text-lg font-semibold text-purple-800">
          <ChevronLeft className="w-6 h-6" aria-hidden="true" /> สมาชิกในบ้าน
        </Link>
        <Card>
          <p className="text-lg font-bold text-slate-900">ไม่พบสมาชิกคนนี้ในบ้าน</p>
          <p className="mt-1 text-base text-slate-600">อาจถูกนำออกจากบ้านไปแล้ว</p>
        </Card>
      </div>
    );
  }

  const isMe = member.id === CURRENT_MEMBER_ID;
  const photo = isMe ? settings.profile.photo : record.photo;
  const viewable = canViewMember(record, CURRENT_MEMBER_ID, requests);
  const editable = canEditMember(record, CURRENT_MEMBER_ID, requests);

  const editHistory = requestsFor(member.id, CURRENT_MEMBER_ID, requests)
    .filter((r) => r.scope === 'edit')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestEditRequest = editHistory[0];
  const viewRequest = requestsFor(member.id, CURRENT_MEMBER_ID, requests)
    .filter((r) => r.scope === 'view')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const meds = memberMeds(record).slice().sort((a, b) => {
    const time = (m: MemberMed) => m.times[m.periods[0]] ?? '99:99';
    return time(a).localeCompare(time(b));
  });

  const sendRequest = (scope: 'view' | 'edit', message: string) => {
    requestAccess(member.id, scope, message);
    setDialog(null);
    toast.show(`ส่งคำขอไปหา ${member.name} แล้ว รอการอนุมัติ`);
  };

  const answerAsTarget = (decision: 'once' | 'always' | 'denied') => {
    if (!latestEditRequest) return;
    decideRequest(latestEditRequest.id, decision);
    toast.show(
      decision === 'denied'
        ? `ไม่อนุญาตให้ ${member.name} แก้ไขข้อมูล`
        : decision === 'once'
          ? `อนุญาตครั้งนี้แล้ว · ${member.name} เข้าไปแก้ไขได้ 1 ครั้ง`
          : `อนุญาตตลอดแล้ว · ${member.name} แก้ไขได้ทุกครั้ง`
    );
  };

  const saveSchedule = (nextMeds: MemberMed[], note: string) => {
    saveMemberRecord({ ...record, meds: nextMeds, health: { ...record.health, note } });
    if (latestEditRequest?.decision === 'once' && !latestEditRequest.usedAt) consumeOnce(latestEditRequest.id);
    setDialog(null);
    toast.show('บันทึกตารางยาแล้ว');
  };

  return (
    <div className="space-y-5">
      <Link
        to="/members"
        className="inline-flex min-h-[48px] items-center gap-1 rounded-xl pr-4 text-lg font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-800"
      >
        <ChevronLeft className="w-6 h-6" aria-hidden="true" />
        <span>สมาชิกในบ้าน</span>
      </Link>

      {/* ข้อมูลส่วนตัว */}
      <Card>
        <div className="flex items-start gap-4">
          <Avatar src={photo} name={member.name} className="h-20 w-20 text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-slate-900 break-words">
              {member.name}
              {isMe && <span className="ml-1 text-base font-semibold text-purple-800">(คุณ)</span>}
            </h1>
            <p className="mt-1 text-base text-slate-700">
              {isMe ? 'ฉัน' : member.relation} · {record.age ? `${record.age} ปี` : 'ไม่ระบุอายุ'} ·{' '}
              {record.gender ? GENDER_LABEL[record.gender] : 'ไม่ระบุเพศ'}
            </p>
            <p className={cn(roleBadge, 'mt-2')}>
              <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', ROLE_META[member.role].dot)} />
              {ROLE_META[member.role].label}
            </p>
          </div>
        </div>
      </Card>

      {/* สถานะสิทธิ์การเข้าถึง */}
      {!isMe && (
        <Card
          className={cn(
            editable
              ? 'border-emerald-200 bg-emerald-50/60'
              : latestEditRequest?.decision === 'pending'
                ? 'border-amber-200 bg-amber-50/60'
                : 'border-slate-200'
          )}
        >
          <SectionTitle icon={ShieldCheck}>สิทธิ์เข้าถึงข้อมูล</SectionTitle>

          {editable ? (
            <div className="space-y-3">
              <p className="text-base font-bold text-emerald-900">
                คุณแก้ไขข้อมูลและจัดตารางยาของ {member.name} ได้
                {latestEditRequest?.decision === 'once' && ' (อนุญาตครั้งนี้)'}
              </p>
              <Button fullWidth onClick={() => setDialog('schedule')}>
                <PencilLine className="w-5 h-5" aria-hidden="true" />
                <span>แก้ไขตารางยา</span>
              </Button>
            </div>
          ) : latestEditRequest?.decision === 'pending' ? (
            <div className="space-y-3">
              <p className="text-base font-bold text-amber-900">
                ส่งคำขอไปแล้ว · รอ {member.name} อนุมัติ
              </p>
              <p className="text-base text-slate-700">“{latestEditRequest.message}”</p>
              <p className="text-sm text-slate-600">
                ต้นแบบนี้ยังไม่มีเซิร์ฟเวอร์ ส่งคำตอบแทน {member.name} เพื่อทดลองต่อได้เลย
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button size="sm" onClick={() => answerAsTarget('once')}>
                  อนุญาตครั้งนี้
                </Button>
                <Button size="sm" variant="soft" onClick={() => answerAsTarget('always')}>
                  อนุญาตตลอด
                </Button>
                <Button size="sm" variant="neutral" onClick={() => answerAsTarget('denied')}>
                  ไม่อนุญาต
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {latestEditRequest?.decision === 'denied' && (
                <p className="text-base font-bold text-red-800">
                  {member.name} ไม่อนุญาตให้แก้ไขข้อมูล (ตอบเมื่อ{' '}
                  {new Date(latestEditRequest.decidedAt ?? latestEditRequest.createdAt).toLocaleDateString('th-TH')})
                </p>
              )}
              <p className="text-base text-slate-700">
                {member.name} ยังไม่ได้ให้สิทธิ์แก้ไขข้อมูล ถ้าต้องจัดตารางยาให้ ส่งคำขอไปก่อนได้
              </p>
              <Button fullWidth onClick={() => setDialog('edit')}>
                <Send className="w-5 h-5" aria-hidden="true" />
                <span>ขออนุญาตแก้ไขข้อมูล</span>
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ข้อมูลถูกซ่อน */}
      {!viewable ? (
        <Card className="text-center">
          <Lock className="mx-auto h-12 w-12 text-amber-700" aria-hidden="true" />
          <p className="mt-3 text-lg font-bold text-slate-900">ข้อมูลนี้ถูกซ่อนไว้</p>
          <p className="mt-1 text-base text-slate-600">
            {member.name} ตั้งค่าไม่ให้คนในบ้านดูข้อมูลสุขภาพและตารางยา
          </p>
          {viewRequest?.decision === 'pending' ? (
            <p className="mt-4 text-base font-bold text-amber-800">ส่งคำขอไปแล้ว · รอการอนุมัติ</p>
          ) : (
            <Button className="mt-4" onClick={() => setDialog('view')}>
              ขออนุญาตดูข้อมูล
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* ตารางยา */}
          <Card>
            <SectionTitle icon={Clock}>ตารางยา</SectionTitle>
            {meds.length === 0 ? (
              <p className="text-base text-slate-600">ยังไม่มีการใช้ยาที่บันทึกไว้</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {meds.map((med) => (
                  <li key={med.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-base sm:text-lg font-bold text-slate-900 break-words">{med.name}</p>
                    {med.dose && <p className="text-sm text-slate-600">ครั้งละ {med.dose}</p>}
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {med.periods.map((p) => (
                        <li
                          key={p}
                          className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-900"
                        >
                          {PERIOD_LABEL[p]} · {med.times[p] ?? DEFAULT_TIME[p]} น.
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ประวัติสุขภาพ */}
          <Card>
            <SectionTitle icon={HeartPulse}>ประวัติสุขภาพ</SectionTitle>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-600">ความดันล่าสุด</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">
                  {record.health.bloodPressure || 'ไม่มีข้อมูล'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-600">น้ำตาลในเลือดล่าสุด</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">
                  {record.health.bloodSugar ? `${record.health.bloodSugar} มก./ดล.` : 'ไม่มีข้อมูล'}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-600">โรคประจำตัว</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {record.health.conditions.length === 0 ? (
                    <span className="text-base text-slate-600">ไม่มีข้อมูล</span>
                  ) : (
                    record.health.conditions.map((c) => (
                      <span key={c} className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-800">
                        {c}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-600">การแพ้ยา / อื่น ๆ</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {record.health.allergies.length === 0 ? (
                    <span className="text-base text-slate-600">ไม่มีข้อมูล</span>
                  ) : (
                    record.health.allergies.map((a) => (
                      <span key={a} className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
                        {a}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {record.health.note && (
                <div>
                  <p className="text-sm font-bold text-slate-600">บันทึกเพิ่มเติม</p>
                  <p className="mt-1 text-base text-slate-800 break-words">{record.health.note}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-bold text-slate-600">ประวัติการรักษา</p>
                {record.health.history.length === 0 ? (
                  <p className="mt-1 text-base text-slate-600">ยังไม่มีประวัติ</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {record.health.history.map((h) => (
                      <li key={h.id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-500">
                          {new Date(h.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-base font-bold text-slate-900 break-words">{h.label}</p>
                        <p className="text-sm text-slate-600 break-words">{h.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {isMe && !record.sharing.shareData && (
        <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50/70 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-semibold text-amber-900">
            ตอนนี้คุณซ่อนข้อมูลนี้จากคนในบ้าน — คนอื่นจะเห็นเพียงชื่อ อายุ และบทบาท
          </p>
          <Link
            to="/settings/privacy"
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-5 text-base font-bold text-amber-900 hover:bg-amber-100"
          >
            เปิดให้ดูข้อมูล
          </Link>
        </Card>
      )}

      {isMe && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-slate-700">ตารางยาของคุณเอง แก้ไขได้ที่หน้าตู้ยา</p>
          <Link
            to="/meds"
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 px-5 text-base font-bold text-purple-900 hover:bg-purple-100"
          >
            ไปที่ตู้ยา
          </Link>
        </Card>
      )}

      {!isMe && (
        <Card className="flex items-start gap-3">
          <Users className="mt-0.5 h-6 w-6 shrink-0 text-purple-700" aria-hidden="true" />
          <p className="text-base text-slate-700">
            ข้อมูลนี้เป็นของ {member.name} ถ้าต้องการให้คนอื่นเข้าถึงข้อมูลของคุณเอง ตั้งได้ที่ ตั้งค่า ›
            ความเป็นส่วนตัว
          </p>
        </Card>
      )}

      {dialog === 'view' && (
        <RequestDialog
          memberName={member.name}
          scope="view"
          onClose={() => setDialog(null)}
          onSend={(message) => sendRequest('view', message)}
        />
      )}
      {dialog === 'edit' && (
        <RequestDialog
          memberName={member.name}
          scope="edit"
          onClose={() => setDialog(null)}
          onSend={(message) => sendRequest('edit', message)}
        />
      )}
      {dialog === 'schedule' && (
        <ScheduleDialog
          record={record}
          memberName={member.name}
          onClose={() => setDialog(null)}
          onSave={saveSchedule}
        />
      )}
    </div>
  );
};
