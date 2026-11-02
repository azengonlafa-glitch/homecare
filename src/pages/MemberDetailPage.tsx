import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ChevronLeft,
  Clock,
  HeartPulse,
  Lock,
  PencilLine,
  Pill,
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
  saveMemberRecord,
  memberMeds,
  type MemberMed,
  type MemberRecord,
} from '../lib/members';
import {
  ACCESS_CHANGED_EVENT,
  canEditMember,
  canViewMember,
  decideRequest,
  requestAccess,
  requestsFor,
  useAccessRequests,
} from '../lib/access';
import { PERIOD_LABEL, PERIODS, type DosePeriod } from '../lib/meds';

const DEFAULT_TIME: Record<DosePeriod, string> = {
  morning: '08:00',
  noon: '12:00',
  evening: '18:00',
  bedtime: '21:00',
};

const newMedId = () => `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const SectionTitle: React.FC<{ icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({
  icon: Icon,
  children,
}) => (
  <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900">
    <Icon className="h-6 w-6 text-purple-700 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </h2>
);

const roleBadge = 'inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700';

// ---------- หน้าต่างขออนุญาต ----------

const RequestDialog: React.FC<{
  memberName: string;
  scope: 'view' | 'edit';
  onClose: () => void;
  onSubmit: (message: string) => void;
}> = ({ memberName, scope, onClose, onSubmit }) => {
  const [message, setMessage] = useState(
    scope === 'edit' ? `ขออนุญาตจัดตารางยาให้ ${memberName} นะคะ` : `ขออนุญาตดูข้อมูลสุขภาพของ ${memberName}`
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={scope === 'edit' ? 'ขออนุญาตแก้ไขข้อมูล' : 'ขออนุญาตดูข้อมูล'}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={() => onSubmit(message.trim())}>
            ส่งคำขอ
          </Button>
        </div>
      }
    >
      <div className="py-4 space-y-4">
        <p className="text-base text-slate-700">
          ส่งข้อความบอก {memberName} ว่าทำไมคุณต้องการ
          {scope === 'edit' ? 'แก้ไขและจัดตารางยา' : 'ดูข้อมูล'}
        </p>
        <TextField
          id="request-message"
          label="ข้อความบอกเหตุผล"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="เช่น ช่วยจัดตารางมื้อเช้าให้ จะได้ไม่ลืม"
        />
      </div>
    </Modal>
  );
};

// ---------- ตัวแก้ไขตารางยาและการดูแล ----------

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
      title={`แก้ไขตารางยาและการดูแลของ ${memberName}`}
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
        {meds.length === 0 && <p className="text-base text-slate-600">ยังไม่มีรายการยาในตาราง เพิ่มรายการแรกได้เลย</p>}

        {meds.map((med) => (
          <div key={med.id} className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-3">
                <TextField
                  id={`med-name-${med.id}`}
                  label="ชื่อยา หรือสิ่งดูแล (เช่น ยาลดความดัน, ยาฉีดเบาหวาน)"
                  value={med.name}
                  onChange={(e) => patch(med.id, { name: e.target.value })}
                />
                <TextField
                  id={`med-dose-${med.id}`}
                  label="ขนาดที่ใช้ต่อครั้ง (เช่น 1 เม็ด, 10 ยูนิต)"
                  value={med.dose}
                  onChange={(e) => patch(med.id, { dose: e.target.value })}
                />
              </div>
              <button
                type="button"
                aria-label={`ลบ ${med.name || 'รายการยา'}`}
                onClick={() => setMeds((prev) => prev.filter((m) => m.id !== med.id))}
                className="mt-8 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
              >
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">ช่วงเวลา / มื้อ</p>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => (
                  <Chip key={p.value} selected={med.periods.includes(p.value)} onClick={() => togglePeriod(med, p.value)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </div>

            {med.periods.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                {med.periods.map((p) => (
                  <label key={p} className="flex min-h-[48px] items-center justify-between gap-3">
                    <span className="text-base text-slate-700 font-medium">เวลา {PERIOD_LABEL[p]}</span>
                    <input
                      type="time"
                      value={med.times[p] ?? DEFAULT_TIME[p]}
                      onChange={(e) => patch(med.id, { times: { ...med.times, [p]: e.target.value } })}
                      className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base bg-white"
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
              { id: newMedId(), name: '', dose: '1 เม็ด', periods: ['morning'], times: { morning: DEFAULT_TIME.morning } },
            ])
          }
        >
          + เพิ่มรายการยา / การดูแล
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

/** รายละเอียดสมาชิก: ยาและการดูแล + ประวัติสุขภาพ พร้อมระบบขออนุญาตดู/แก้ไขข้อมูล */
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

  const meds: MemberMed[] = memberMeds(record).slice().sort((a: MemberMed, b: MemberMed) => {
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
          : `อนุญาตตลอดแล้ว · ${member.name} แก้ไขข้อมูลได้ทุกเมื่อ`
    );
  };

  const saveSchedule = (nextMeds: MemberMed[], note: string) => {
    const updated: MemberRecord = {
      ...record,
      meds: nextMeds,
      health: { ...record.health, note },
    };
    saveMemberRecord(updated);
    setRecord(updated);
    setDialog(null);
    toast.show('บันทึกตารางยาและการดูแลแล้ว');
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Link
        to="/members"
        className="inline-flex items-center gap-1.5 text-lg font-bold text-slate-700 hover:text-purple-800 transition-colors"
      >
        <ChevronLeft className="w-6 h-6 shrink-0" aria-hidden="true" />
        <span>สมาชิกในบ้าน</span>
      </Link>

      {/* บัตรประจำตัวสมาชิก */}
      <Card className="shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar src={photo} name={member.name} className="h-20 w-20 text-3xl shadow-xs" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight break-words">
              {member.name}
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
            'shadow-xs',
            editable
              ? 'border-emerald-200 bg-emerald-50/60'
              : latestEditRequest?.decision === 'pending'
                ? 'border-amber-200 bg-amber-50/60'
                : 'border-slate-200'
          )}
        >
          <SectionTitle icon={ShieldCheck}>สิทธิ์เข้าถึงข้อมูล</SectionTitle>

          {editable ? (
            <div className="space-y-3 mt-3">
              <p className="text-base font-bold text-emerald-900">
                คุณแก้ไขข้อมูลและจัดตารางยาของ {member.name} ได้
                {latestEditRequest?.decision === 'once' && ' (อนุญาตครั้งนี้)'}
              </p>
              <Button fullWidth onClick={() => setDialog('schedule')}>
                <PencilLine className="w-5 h-5" aria-hidden="true" />
                <span>แก้ไขตารางยาและการดูแล</span>
              </Button>
            </div>
          ) : latestEditRequest?.decision === 'pending' ? (
            <div className="space-y-3 mt-3">
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
            <div className="space-y-3 mt-3">
              {latestEditRequest?.decision === 'denied' && (
                <p className="text-base font-bold text-red-800">
                  {member.name} ไม่อนุญาตให้แก้ไขข้อมูล (ตอบเมื่อ{' '}
                  {new Date(latestEditRequest.decidedAt ?? latestEditRequest.createdAt).toLocaleDateString('th-TH')})
                </p>
              )}
              <p className="text-base text-slate-700">
                {member.name} ยังไม่ได้ให้สิทธิ์แก้ไขข้อมูล ถ้าต้องจัดตารางยาหรือสิ่งดูแลให้ ส่งคำขอไปก่อนได้
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
        <Card className="text-center py-12 shadow-xs">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* คอลัมน์ซ้าย: ยาและการดูแล */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-4">
                <SectionTitle icon={Pill}>ยาและการดูแล</SectionTitle>
                {editable && (
                  <Button size="sm" variant="soft" onClick={() => setDialog('schedule')}>
                    <PencilLine className="w-4 h-4" aria-hidden="true" />
                    <span>จัดการ</span>
                  </Button>
                )}
              </div>

              {meds.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-base text-slate-600">ยังไม่มีรายการยาหรือการดูแลที่บันทึกไว้</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {meds.map((med: MemberMed) => (
                    <li key={med.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <p className="text-base sm:text-lg font-bold text-slate-900 break-words">{med.name}</p>
                        {med.form && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            {med.form}
                          </span>
                        )}
                        {med.condition && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
                            {med.condition}
                          </span>
                        )}
                      </div>

                      <p className="text-sm sm:text-base font-medium text-slate-700">
                        ครั้งละ {med.dose}
                        {med.instruction ? ` · ${med.instruction}` : ''}
                      </p>

                      <ul className="mt-2.5 flex flex-wrap gap-2">
                        {med.periods.map((p: DosePeriod) => (
                          <li
                            key={p}
                            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-bold text-purple-900"
                          >
                            <Clock className="w-3.5 h-3.5 text-purple-600" aria-hidden="true" />
                            <span>{PERIOD_LABEL[p]} · {med.times[p] ?? DEFAULT_TIME[p]} น.</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* คอลัมน์ขวา: ประวัติสุขภาพ */}
          <div className="lg:col-span-6 space-y-6">
            <Card className="shadow-xs">
              <SectionTitle icon={HeartPulse}>ประวัติสุขภาพ</SectionTitle>

              {/* Vitals */}
              <div className="grid gap-3 sm:grid-cols-2 mt-4">
                <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/30 p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">ความดันล่าสุด</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">
                    {record.health.bloodPressure || 'ไม่มีข้อมูล'}
                  </p>
                  {record.health.bloodPressure && (
                    <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                      ปกติ
                    </span>
                  )}
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-purple-50/30 p-4 border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">น้ำตาลในเลือดล่าสุด</p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">
                    {record.health.bloodSugar ? `${record.health.bloodSugar} มก./ดล.` : 'ไม่มีข้อมูล'}
                  </p>
                  {record.health.bloodSugar && (
                    <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                      ปกติ
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-700">โรคประจำตัว</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {record.health.conditions.length === 0 ? (
                      <span className="text-sm text-slate-500">ไม่มีประวัติโรคประจำตัว</span>
                    ) : (
                      record.health.conditions.map((c) => (
                        <span key={c} className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm font-bold text-red-800">
                          {c}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-700">การแพ้ยา / แพ้อาหาร</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {record.health.allergies.length === 0 ? (
                      <span className="text-sm text-slate-500">ไม่มีข้อมูลการแพ้</span>
                    ) : (
                      record.health.allergies.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-sm font-bold text-amber-900">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                          <span>{a}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {record.health.note && (
                  <div>
                    <p className="text-sm font-bold text-slate-700">บันทึกเพิ่มเติม</p>
                    <p className="mt-1 text-base text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 break-words">
                      {record.health.note}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-bold text-slate-700">ประวัติการรักษาและการพบแพทย์</p>
                  {record.health.history.length === 0 ? (
                    <p className="mt-1 text-sm text-slate-500">ยังไม่มีประวัติการรักษา</p>
                  ) : (
                    <ul className="mt-2.5 space-y-2.5">
                      {record.health.history.map((h) => (
                        <li key={h.id} className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
                          <p className="text-xs font-semibold text-slate-500">
                            {new Date(h.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-base font-bold text-slate-900 break-words mt-0.5">{h.label}</p>
                          <p className="text-sm text-slate-600 break-words mt-0.5">{h.detail}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {isMe && !record.sharing.shareData && (
        <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50/70 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <p className="text-base font-semibold text-amber-900">
            ตอนนี้คุณซ่อนข้อมูลนี้จากคนในบ้าน — คนอื่นจะเห็นเพียงชื่อ อายุ และบทบาท
          </p>
          <Link
            to="/settings/privacy"
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-5 text-base font-bold text-amber-900 hover:bg-amber-100 transition-colors"
          >
            เปิดให้ดูข้อมูล
          </Link>
        </Card>
      )}

      {isMe && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <p className="text-base text-slate-700">รายการยาและการดูแลของคุณเอง สามารถเพิ่มหรือแก้ไขได้ที่หน้ายาและการดูแล</p>
          <Link
            to="/meds"
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 px-5 text-base font-bold text-purple-900 hover:bg-purple-100 transition-colors"
          >
            ไปที่ยาและการดูแล
          </Link>
        </Card>
      )}

      {!isMe && (
        <Card className="flex items-start gap-3 shadow-xs">
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
          onSubmit={(msg) => sendRequest('view', msg)}
        />
      )}

      {dialog === 'edit' && (
        <RequestDialog
          memberName={member.name}
          scope="edit"
          onClose={() => setDialog(null)}
          onSubmit={(msg) => sendRequest('edit', msg)}
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
