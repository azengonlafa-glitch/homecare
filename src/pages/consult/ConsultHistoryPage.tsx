import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronDown, ChevronUp, History, Pill, ShieldOff, Trash2 } from 'lucide-react';
import { ErrorCard, LoadingCard, StatusBadge } from '../../components/consult/ConsultUI';
import { NoteSummary } from '../../components/consult/NoteSummary';
import { PushCard } from '../../components/consult/PushCard';
import { ReviewForm } from '../../components/consult/ReviewForm';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { buttonClass, Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, getBackend } from '../../consult/backend';
import { DIRECTION_LABEL, severityDirection } from '../../consult/brief';
import { useConsultData } from '../../consult/hooks';
import { SCOPE_LABEL, TREND_LABEL, symptomLabels } from '../../consult/options';
import type { FollowUp, SessionBundle } from '../../consult/types';
import { todayKey } from '../../lib/meds';

const ACCESS_LABEL: Record<string, string> = {
  consent_granted: 'คุณให้ความยินยอม',
  brief_opened: 'ผู้ให้บริการเปิดดูข้อมูลสุขภาพ',
  consent_revoked: 'คุณถอนความยินยอม',
  cancelled_by_admin: 'ผู้ดูแลระบบปิดผู้ให้บริการรายนี้ การปรึกษาถูกยกเลิก',
  claimed: 'เจ้าหน้าที่รับเรื่อง',
  released: 'เจ้าหน้าที่คืนเรื่องเข้าคิวเพื่อให้เพื่อนร่วมงานรับต่อ',
  taken_over: 'เจ้าหน้าที่อีกคนในร้านรับช่วงดูแลต่อ',
};

const FOLLOW_STATUS: Record<FollowUp['status'], string> = {
  pending: 'รออัปเดตอาการ',
  responded: 'ส่งข้อมูลให้ผู้ให้บริการแล้ว',
  reviewed: 'ผู้ให้บริการตรวจแล้ว',
};

const dateText = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('th-TH', { dateStyle: 'long' });

const AccessLog: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { data, loading, error } = useConsultData((b) => b.listAccessLog(sessionId), [sessionId]);
  if (loading) return <p className="text-base text-slate-600">กำลังโหลด...</p>;
  if (error) return <p className="text-base text-red-700">{error}</p>;
  return (
    <ul className="space-y-1 text-base text-slate-700">
      {(data ?? []).map((l) => (
        <li key={l.id}>
          {new Date(l.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} · {ACCESS_LABEL[l.action] ?? l.action}
        </li>
      ))}
    </ul>
  );
};

const Entry: React.FC<{ bundle: SessionBundle; onChanged: () => void }> = ({ bundle, onChanged }) => {
  const { session, provider, checkin, consent, note, followUps } = bundle;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = todayKey();

  const revoke = async () => {
    try {
      const backend = await getBackend();
      await backend.revokeConsent(session.id);
      setConfirmRevoke(false);
      toast.show('ถอนความยินยอมแล้ว');
      onChanged();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    }
  };

  const closed = session.status === 'completed' || session.status === 'cancelled';

  const erase = async () => {
    try {
      const backend = await getBackend();
      await backend.deleteSession(session.id);
      setConfirmDelete(false);
      toast.show('ลบข้อมูลการปรึกษานี้แล้ว');
      onChanged();
    } catch (err) {
      setConfirmDelete(false);
      toast.show(consultErrorText(err), { tone: 'error' });
    }
  };

  return (
    <li className="relative pl-8 sm:pl-10">
      <span className="absolute left-0 top-7 flex h-6 w-6 items-center justify-center rounded-full bg-purple-700 ring-4 ring-purple-100" aria-hidden="true" />
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-600">
              {new Date(session.createdAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
            <h2 className="text-lg font-bold text-slate-900 break-words">{session.topic}</h2>
            <p className="text-base text-slate-700 break-words">
              {provider?.displayName ?? 'ผู้ให้บริการ'}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>

        {checkin && (
          <p className="text-base text-slate-800 break-words">
            <span className="font-semibold">อาการขณะนั้น: </span>
            {symptomLabels(checkin).join(', ') || 'ไม่ได้ระบุ'}
            {checkin.severity !== null && ` · ${checkin.severity}/10`}
          </p>
        )}

        {note && <NoteSummary note={note} />}

        {session.status === 'completed' && <ReviewForm sessionId={session.id} providerName={provider?.displayName ?? 'ผู้ให้บริการ'} existing={bundle.review} onSaved={onChanged} />}

        {followUps.map((f) => {
          const due = f.status === 'pending' && f.dueDate <= today;
          return (
            <div key={f.id} className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3 space-y-2">
              <p className="flex items-center gap-2 text-base font-bold text-purple-950">
                <CalendarClock className="w-5 h-5 shrink-0" aria-hidden="true" />
                ติดตามผล {dateText(f.dueDate)} · {due ? 'ถึงกำหนดแล้ว' : FOLLOW_STATUS[f.status]}
              </p>
              {f.plan && <p className="text-base text-slate-800 break-words">{f.plan}</p>}
              {f.response && (
                <div className="text-base text-slate-800">
                  <p>
                    อาการล่าสุด {f.response.severity !== null ? `${f.response.severity}/10` : 'ไม่ระบุ'}
                    {f.response.trend && ` · ${TREND_LABEL[f.response.trend]}`}
                  </p>
                  {checkin && <p className="font-semibold">{DIRECTION_LABEL[severityDirection(checkin.severity, f.response.severity)]}</p>}
                  {f.response.note && <p className="break-words whitespace-pre-wrap">{f.response.note}</p>}
                </div>
              )}
              {f.status === 'pending' && (
                <Link to={`/consult/followup/${f.id}`} className={buttonClass('primary', 'sm', true)}>
                  อัปเดตอาการ
                </Link>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2">
          <Link to={`/consult/room/${session.id}`} className={buttonClass('soft', 'sm')}>
            เปิดห้องสนทนา
          </Link>
          {note?.medicationAdvice && (
            <Link to="/meds" className={buttonClass('neutral', 'sm')}>
              <Pill className="w-5 h-5" aria-hidden="true" />
              จัดการตู้ยา
            </Link>
          )}
          <Button variant="neutral" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="w-5 h-5" aria-hidden="true" /> : <ChevronDown className="w-5 h-5" aria-hidden="true" />}
            ความยินยอมและการเข้าถึง
          </Button>
        </div>

        {open && consent && (
          <div className="rounded-2xl border border-slate-200 p-3 space-y-3">
            <p className="text-base text-slate-800">
              <span className="font-semibold">เปิดเผย: </span>
              {consent.scopes.map((s) => SCOPE_LABEL[s].title).join(', ')}
            </p>
            <p className="text-base text-slate-800">
              <span className="font-semibold">สถานะ: </span>
              {consent.revokedAt ? `ถอนแล้วเมื่อ ${dateText(consent.revokedAt)}` : 'ยังมีผล'}
            </p>
            <AccessLog sessionId={session.id} />
            {!consent.revokedAt && (
              <Button variant="neutral" size="sm" onClick={() => setConfirmRevoke(true)}>
                <ShieldOff className="w-5 h-5" aria-hidden="true" />
                ถอนความยินยอม
              </Button>
            )}
            {closed ? (
              <Button variant="neutral" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-5 h-5 text-red-700" aria-hidden="true" />
                ลบข้อมูลการปรึกษานี้
              </Button>
            ) : (
              <p className="text-base text-slate-600">ลบข้อมูลได้เมื่อการปรึกษาเสร็จหรือถูกยกเลิกแล้ว</p>
            )}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmRevoke}
        title="ถอนความยินยอม?"
        message="ผู้ให้บริการจะเปิดข้อมูลสุขภาพชุดนี้ไม่ได้อีก แต่ข้อความสนทนาและบันทึกการปรึกษายังอยู่ ถ้าต้องการลบด้วย ให้กดลบข้อมูลการปรึกษานี้เมื่อการปรึกษาปิดแล้ว"
        confirmLabel="ถอนความยินยอม"
        onConfirm={() => void revoke()}
        onCancel={() => setConfirmRevoke(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="ลบข้อมูลการปรึกษานี้ถาวร?"
        message="ข้อความ ไฟล์แนบ ข้อมูลอาการ บันทึกของผู้ให้บริการ และนัดติดตามของการปรึกษานี้จะถูกลบถาวร ทั้งคุณและผู้ให้บริการจะดูไม่ได้อีก และกู้คืนไม่ได้"
        confirmLabel="ลบถาวร"
        onConfirm={() => void erase()}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  );
};

/** Module 5: ประวัติแบบ Timeline */
export const ConsultHistoryPage: React.FC = () => {
  const { data, loading, error, reload } = useConsultData((b) => b.listMyBundles(), [], { sessionId: null });
  const toast = useToast();
  const [confirmAll, setConfirmAll] = useState(false);
  const [erasing, setErasing] = useState(false);
  const closedIds = (data ?? []).filter((b) => b.session.status === 'completed' || b.session.status === 'cancelled').map((b) => b.session.id);
  const openCount = (data?.length ?? 0) - closedIds.length;

  const eraseAll = async () => {
    setConfirmAll(false);
    setErasing(true);
    let failed = 0;
    const backend = await getBackend();
    for (const id of closedIds) {
      try {
        await backend.deleteSession(id);
      } catch (err) {
        console.error('Delete session failed', err);
        failed += 1;
      }
    }
    setErasing(false);
    toast.show(failed ? `ลบไม่สำเร็จ ${failed} รายการ กรุณาลองใหม่` : 'ลบข้อมูลการปรึกษาแล้ว', { tone: failed ? 'error' : 'success' });
    reload();
  };

  return (
    <div className="space-y-5">
      <PageHeader title="ประวัติการปรึกษา" description="คำแนะนำ นัดติดตาม และสิทธิ์การเข้าถึงข้อมูลของคุณ" />
      <PushCard />
      {loading && !data ? (
        <LoadingCard label="กำลังโหลดประวัติ..." />
      ) : error && !data ? (
        <ErrorCard message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState icon={History} message="ยังไม่มีประวัติการปรึกษา" />
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-200">
          {data.map((bundle) => (
            <Entry key={bundle.session.id} bundle={bundle} onChanged={reload} />
          ))}
        </ol>
      )}

      {closedIds.length > 0 && (
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-bold text-slate-900">ลบข้อมูลของฉัน</h2>
          <p className="text-base text-slate-700">
            ลบข้อมูลการปรึกษาที่ปิดแล้ว {closedIds.length} รายการถาวร ไม่รวมข้อมูลสุขภาพและตู้ยาของคุณ ซึ่งแก้ไขได้ที่หน้าของมันเอง
            {openCount > 0 && ` การปรึกษาที่ยังเปิดอยู่ ${openCount} รายการจะไม่ถูกลบ`}
          </p>
          <Button variant="neutral" size="sm" disabled={erasing} onClick={() => setConfirmAll(true)}>
            <Trash2 className="w-5 h-5 text-red-700" aria-hidden="true" />
            {erasing ? 'กำลังลบ...' : 'ลบข้อมูลการปรึกษาทั้งหมด'}
          </Button>
        </Card>
      )}
      <ConfirmDialog
        open={confirmAll}
        title="ลบข้อมูลการปรึกษาทั้งหมดถาวร?"
        message={`การปรึกษาที่ปิดแล้ว ${closedIds.length} รายการ รวมข้อความ ไฟล์แนบ ข้อมูลอาการ บันทึกของผู้ให้บริการ และนัดติดตาม จะถูกลบถาวร ทั้งคุณและผู้ให้บริการจะดูไม่ได้อีก และกู้คืนไม่ได้`}
        confirmLabel="ลบถาวร"
        onConfirm={() => void eraseAll()}
        onCancel={() => setConfirmAll(false)}
      />
    </div>
  );
};
