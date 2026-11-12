import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardPen, Lightbulb, MessageCircle, Send, ShieldOff, Undo2, UserCheck, UserRound } from 'lucide-react';
import { BriefView } from '../../components/consult/BriefView';
import { ContactPanel } from '../../components/consult/ContactPanel';
import { ErrorCard, LoadingCard, StatusBadge } from '../../components/consult/ConsultUI';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { QueueDrawer } from './QueueDrawer';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { DateField } from '../../components/ui/DatePicker';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, CONSULT_MODE, getBackend } from '../../consult/backend';
import { DIRECTION_LABEL, severityDirection } from '../../consult/brief';
import { useConsultData } from '../../consult/hooks';
import { TREND_LABEL } from '../../consult/options';
import type { NoteFields, PatientBrief } from '../../consult/types';
import { SUGGESTED_QUESTIONS, SUGGESTED_QUESTIONS_SOURCE } from '../../data/consultReference';
import { cn } from '../../lib/cn';
import { todayKey } from '../../lib/meds';

const EMPTY_NOTE: NoteFields = { assessment: '', medicationAdvice: '', recommendation: '', referral: '', followUpPlan: '', followUpDue: '' };

/** ขั้นตอนทำงานทีละหน้า: 1 คุยกับผู้ป่วย → 2 เขียนบันทึกส่งให้ผู้ใช้ */
type Phase = 'chat' | 'note';

/** อ่าน Brief ผ่าน backend ทุกครั้ง: ตรวจความยินยอมและบันทึกการเข้าถึง โหลดครั้งเดียวต่อการเปิดหน้า */
function useBrief(sessionId: string, enabled: boolean) {
  const [brief, setBrief] = useState<PatientBrief | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const opened = useRef(false);
  useEffect(() => {
    // เปิดได้เฉพาะผู้ดูแลเคส (ฐานข้อมูลตรวจซ้ำอีกชั้น) และเปิดครั้งเดียวต่อการเข้าหน้า
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (opened.current) return; // StrictMode เรียกซ้ำ: กันบันทึกการเข้าถึงซ้ำ
    opened.current = true;
    setLoading(true);
    void getBackend()
      .then((b) => b.openBrief(sessionId))
      .then(setBrief)
      .catch((err) => setError(consultErrorText(err)))
      .finally(() => setLoading(false));
  }, [sessionId, enabled]);
  return { brief, error, loading };
}

/** ข้อมูลสำคัญที่ต้องเห็นตลอดเวลา ไม่ว่าจะอยู่ขั้นตอนไหน */
const PatientStrip: React.FC<{ brief: PatientBrief }> = ({ brief }) => {
  const a = brief.allergies;
  const allergies = [...(a?.drugs.map((d) => d.drug) ?? []), ...(a?.other ?? [])];
  const o = brief.overview;
  const facts = [o?.age !== null && o?.age !== undefined ? `${o.age} ปี` : '', o?.gender, o?.weightKg ? `${o.weightKg} กก.` : ''].filter(Boolean);
  const conditions = brief.history?.conditions ?? [];
  return (
    <div aria-label="ข้อมูลสำคัญของผู้ป่วย" className="mt-3 flex flex-wrap items-center gap-1.5 text-base font-bold">
      {allergies.length > 0 ? (
        allergies.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-red-900">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            แพ้ {x}
          </span>
        ))
      ) : (
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-700">{a?.noAllergies ? 'ยืนยันว่าไม่เคยแพ้' : 'ไม่ได้ระบุการแพ้'}</span>
      )}
      {facts.length > 0 && <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-800">{facts.join(' · ')}</span>}
      {conditions.map((x) => (
        <span key={x} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-slate-800">
          {x}
        </span>
      ))}
      <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-purple-900">ยา {brief.medications?.length ?? 0} รายการ</span>
      {brief.symptoms && brief.symptoms.severity !== null && <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-purple-900">รุนแรง {brief.symptoms.severity}/10</span>}
    </div>
  );
};

/** ตัวบอกขั้นตอน ผู้ใช้งานรู้ว่าอยู่ตรงไหนและเหลืออะไร */
const Steps: React.FC<{ phase: Phase; done: boolean }> = ({ phase, done }) => {
  const items: { key: string; label: string; state: 'current' | 'todo' | 'done' }[] = [
    { key: 'chat', label: 'คุยกับผู้ป่วย', state: phase === 'chat' ? 'current' : 'done' },
    { key: 'note', label: 'เขียนบันทึก', state: done ? 'done' : phase === 'note' ? 'current' : 'todo' },
  ];
  return (
    <ol aria-label="ขั้นตอนการทำงาน" className="grid grid-cols-2 gap-2">
      {items.map((s, i) => (
        <li
          key={s.key}
          aria-current={s.state === 'current' ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-base font-bold',
            s.state === 'current' ? 'border-purple-600 bg-purple-50 text-purple-950' : s.state === 'done' ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-600'
          )}
        >
          <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm', s.state === 'current' ? 'bg-purple-700 text-white' : s.state === 'done' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700')}>
            {s.state === 'done' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : i + 1}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
};

/** เปลี่ยนเคส: ล้างสถานะของเคสก่อนหน้าด้วย key เพื่อไม่ให้บันทึกหรือข้อมูลผู้ป่วยข้ามเคสกัน */
export const PharmacistWorkspaceRoute: React.FC = () => {
  const { id = '' } = useParams();
  return <PharmacistWorkspacePage key={id} />;
};

/** พื้นที่ทำงานของเคสเดียว: แชท → (ดูข้อมูลผู้ป่วยได้ทุกเมื่อ) → จบการปรึกษา → เขียนบันทึกส่งให้ผู้ใช้ */
export const PharmacistWorkspacePage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [staffSession, me] = await Promise.all([b.getStaffSession(id), b.getStaffContext()]);
      return staffSession && { ...staffSession, me: me?.userId ?? '', provider: await b.getProvider(staffSession.session.providerId) };
    },
    [id],
    { sessionId: id }
  );
  // ผู้ดูแลเคส = คนที่รับเรื่อง เคสเก่าที่ปิดแล้วและไม่มีผู้ดูแลเปิดดูได้ เคสที่เพื่อนร่วมงานดูแลอยู่เปิดไม่ได้
  const ownerState = data
    ? data.session.assignedTo === data.me || (data.session.assignedTo === null && (data.session.status === 'completed' || data.session.status === 'cancelled'))
    : false;
  const brief = useBrief(id, ownerState);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const [note, setNote] = useState<NoteFields>(EMPTY_NOTE);
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosave, setAutosave] = useState<{ state: 'idle' | 'saving' | 'saved' | 'failed'; at?: string }>({ state: 'idle' });
  const [retry, setRetry] = useState(0);
  const confirming = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [insert, setInsert] = useState<{ text: string; key: number } | null>(null);
  const phaseInitialised = useRef(false);

  useEffect(() => {
    let alive = true;
    void getBackend()
      .then((b) => b.getNote(id))
      .then((n) => {
        if (!alive) return;
        if (n) {
          const { sessionId: _s, confirmedAt: c, updatedAt: _u, ...fields } = n;
          setNote(fields);
          setConfirmedAt(c);
        }
        setNoteLoaded(true);
      })
      .catch(() => alive && setNoteLoaded(true));
    return () => {
      alive = false;
    };
  }, [id]);

  // เคสที่ปิดและมีบันทึกแล้ว เปิดมาที่หน้าบันทึกเลย นอกนั้นเริ่มที่หน้าแชท
  useEffect(() => {
    if (phaseInitialised.current || !noteLoaded) return;
    phaseInitialised.current = true;
    if (confirmedAt) setPhase('note');
  }, [noteLoaded, confirmedAt]);

  // บันทึกอัตโนมัติเมื่อหยุดพิมพ์ เภสัชกรจะได้ไม่เสียงานถ้าปิดหน้าหรือเน็ตหลุด
  const canEditNote = data?.session.status === 'active' && data.session.assignedTo === data.me && !confirmedAt;
  useEffect(() => {
    if (!dirty || !canEditNote) return;
    const timer = window.setTimeout(() => {
      setAutosave({ state: 'saving' });
      void getBackend()
        .then((b) => b.saveNote(id, note))
        .then(() => {
          if (confirming.current) return;
          setDirty(false);
          setAutosave({ state: 'saved', at: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) });
        })
        .catch(() => {
          if (!confirming.current) setAutosave({ state: 'failed' });
        });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, note, canEditNote, id, retry]);

  if (loading && !data) return <LoadingCard label="กำลังเปิดการปรึกษา..." />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <ErrorCard message="ไม่พบการปรึกษานี้ หรือคุณไม่มีสิทธิ์เข้าถึง" />;

  const { session, consentActive, followUps, provider } = data;
  const isActive = session.status === 'active';
  const mine = session.assignedTo === data.me;
  const byOther = isActive && session.assignedTo !== null && !mine;
  /** ทำงานกับเคสนี้ได้: ตอบ เขียนบันทึก ปิดเคส */
  const canWork = isActive && mine;
  const locked = !!confirmedAt || !canWork;
  const finished = !!confirmedAt || session.status === 'completed';
  const pendingFollowUps = followUps.filter((f) => f.status === 'responded').length;

  const run = async (action: (b: Awaited<ReturnType<typeof getBackend>>) => Promise<unknown>, success?: string) => {
    try {
      const backend = await getBackend();
      await action(backend);
      if (success) toast.show(success);
      reload();
      return true;
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
      return false;
    }
  };

  const validateNote = (): boolean => {
    const found: Record<string, string> = {};
    if (!note.assessment.trim() && !note.recommendation.trim() && !note.medicationAdvice.trim()) {
      found['note-assessment'] = 'กรุณากรอกการประเมินหรือคำแนะนำอย่างน้อย 1 ช่อง';
    }
    if (note.followUpDue && note.followUpDue < todayKey()) found['note-due'] = 'วันนัดติดตามต้องไม่อยู่ในอดีต';
    if (note.followUpDue && !note.followUpPlan.trim()) found['note-plan'] = 'กรุณาระบุแผนติดตาม';
    setNoteErrors(found);
    const first = Object.keys(found)[0];
    if (first) document.getElementById(first)?.focus();
    return !first;
  };

  const confirm = async () => {
    setSaving(true);
    confirming.current = true;
    setDirty(false);
    const ok = await run(async (b) => {
      await b.saveNote(id, note);
      await b.confirmNote(id);
    }, 'ส่งบันทึกให้ผู้ใช้และปิดการปรึกษาแล้ว');
    if (ok) setConfirmedAt(new Date().toISOString());
    else confirming.current = false;
    setConfirmOpen(false);
    setSaving(false);
  };

  const field = (key: keyof NoteFields) => ({
    value: note[key],
    disabled: locked,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setNote((n) => ({ ...n, [key]: e.target.value }));
      setDirty(true);
    },
  });

  const lockedReason =
    session.status === 'requested'
      ? 'กด “รับเรื่อง” เพื่อเปิดข้อมูลสุขภาพของผู้ป่วย'
      : byOther
        ? `${session.assignedName || 'เพื่อนร่วมงาน'} กำลังดูแลเคสนี้ ข้อมูลสุขภาพเปิดได้เฉพาะผู้ดูแล`
        : `เคสนี้ปิดแล้วโดย ${session.assignedName || 'เพื่อนร่วมงาน'} ข้อมูลสุขภาพเปิดได้เฉพาะผู้ดูแลเคส`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pr-12 lg:pr-0">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/pharmacist" className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-slate-200 px-3 text-base font-bold text-slate-800 hover:bg-slate-50">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            กลับไปคิว
          </Link>
          <div className="min-w-0 flex-1 basis-48">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">{session.patientLabel || 'ผู้รับบริการ'}</h1>
            <p className="text-base text-slate-600 break-words">
              {session.topic}
              {session.scheduledAt && ` · นัด ${new Date(session.scheduledAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`}
            </p>
          </div>
          <StatusBadge status={session.status} />
          {isActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-base font-bold text-purple-950">
              <UserCheck className="w-4 h-4" aria-hidden="true" />
              {mine ? 'คุณดูแลอยู่' : session.assignedName ? `${session.assignedName} ดูแลอยู่` : 'ยังไม่มีผู้ดูแล'}
            </span>
          )}
        </div>
        {brief.brief && consentActive && ownerState && <PatientStrip brief={brief.brief} />}
        {/* ปุ่มหลักของหน้า: ข้อมูลสุขภาพคือสิ่งที่ต้องเปิดดูก่อนตอบ จึงเป็นปุ่มเต็มแถบสีเข้มเด่นสุด */}
        <Button fullWidth className="mt-4" onClick={() => setInfoOpen(true)}>
          <UserRound className="w-6 h-6" aria-hidden="true" />
          ดูข้อมูลผู้ป่วย
          {pendingFollowUps > 0 && <span className="rounded-full bg-white px-2.5 py-0.5 text-base font-bold text-purple-900">ผลติดตาม {pendingFollowUps}</span>}
        </Button>
        <p className="mt-1.5 text-center text-base text-slate-600">อาการ ประวัติการแพ้ ยาที่ใช้ และประวัติสุขภาพ</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canWork && (
            <Button variant="neutral" size="sm" onClick={() => setConfirmRelease(true)}>
              <Undo2 className="w-5 h-5" aria-hidden="true" />
              คืนเคสเข้าคิว
            </Button>
          )}
          {byOther && (
            <Button variant="soft" size="sm" onClick={() => setConfirmTakeOver(true)}>
              รับช่วงต่อ
            </Button>
          )}
          {session.status === 'requested' && (
            <>
              <Button size="sm" onClick={() => void run((b) => b.acceptSession(id), 'รับเรื่องแล้ว')}>
                รับเรื่อง
              </Button>
              <Button variant="neutral" size="sm" onClick={() => setConfirmDecline(true)}>
                ปฏิเสธ
              </Button>
            </>
          )}
        </div>
      </Card>

      {(canWork || finished) && <Steps phase={phase} done={finished} />}

      {phase === 'chat' ? (
        <section aria-label="สนทนา" className="space-y-3">
          <ContactPanel
            sessionId={id}
            as="staff"
            channels={provider?.channels ?? ['chat']}
            peerName={session.patientLabel}
            scheduledAt={session.scheduledAt}
            canSend={canWork}
            canCall={canWork || (CONSULT_MODE === 'mock' && mine)}
            insert={insert}
            closedText={session.status === 'requested' ? 'กด "รับเรื่อง" ก่อนเริ่มตอบ' : byOther ? `${session.assignedName || 'เพื่อนร่วมงาน'} กำลังดูแลเคสนี้ ตอบได้เฉพาะผู้ดูแล หรือกด “รับช่วงต่อ”` : 'การปรึกษานี้ปิดแล้ว'}
            onChanged={reload}
          />
          {canWork && (
            <Card className="p-4">
              <details>
                <summary className="flex cursor-pointer items-center gap-2 text-base font-bold text-slate-900">
                  <Lightbulb className="w-5 h-5 text-purple-700" aria-hidden="true" />
                  คำถามแนะนำ
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-base text-slate-600">กดเพื่อนำไปใส่ในช่องพิมพ์ แก้ไขได้ก่อนส่ง</p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button key={q} type="button" onClick={() => setInsert({ text: q, key: Date.now() })} className="min-h-[48px] cursor-pointer rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-left text-base font-medium text-purple-950 hover:bg-purple-100">
                        {q}
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    อิงกรอบ{' '}
                    <a href={SUGGESTED_QUESTIONS_SOURCE.url} target="_blank" rel="noreferrer" className="underline">
                      WWHAM
                    </a>
                  </p>
                </div>
              </details>
            </Card>
          )}
          {canWork && (
            <Button fullWidth className="!bg-emerald-700 hover:!bg-emerald-800 [--edge:#064E3B]" onClick={() => setPhase('note')}>
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              เสร็จแล้ว ไปเขียนบันทึก
            </Button>
          )}
          {!canWork && finished && (
            <Button variant="soft" fullWidth onClick={() => setPhase('note')}>
              <ClipboardPen className="w-5 h-5" aria-hidden="true" />
              ดูบันทึกผลการปรึกษา
            </Button>
          )}
        </section>
      ) : (
        <section aria-label="บันทึกผล" className="space-y-3">
          <Card className="p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <ClipboardPen className="w-6 h-6 text-purple-700" aria-hidden="true" />
                บันทึกผลการปรึกษา
              </h2>
              {!finished && <p className="mt-1 text-base text-slate-700">บันทึกนี้จะส่งให้ผู้ใช้ทันทีที่กดส่ง และแก้ไขไม่ได้อีก กรอกอย่างน้อยการประเมินหรือคำแนะนำ</p>}
            </div>
            {!noteLoaded ? (
              <p className="text-base text-slate-600">กำลังโหลด...</p>
            ) : (
              <>
                {finished && (
                  <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-300 p-3 text-base font-semibold text-emerald-950">
                    <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                    ส่งบันทึกให้ผู้ใช้แล้ว แก้ไขไม่ได้
                  </p>
                )}
                {!finished && session.status === 'requested' && <p className="text-base text-slate-600">กรอกได้หลังรับเรื่อง</p>}
                <TextAreaField id="note-assessment" label="การประเมิน" rows={3} error={noteErrors['note-assessment']} {...field('assessment')} />
                <TextAreaField id="note-med" label="คำแนะนำเรื่องยา" rows={3} {...field('medicationAdvice')} />
                <TextAreaField id="note-rec" label="คำแนะนำ" rows={3} {...field('recommendation')} />
                <TextAreaField id="note-ref" label="การส่งต่อ" rows={2} {...field('referral')} />
                <TextAreaField id="note-plan" label="แผนติดตาม" rows={2} error={noteErrors['note-plan']} {...field('followUpPlan')} />
                <DateField
                  id="note-due"
                  label="วันนัดติดตาม"
                  labelSuffix="(ไม่บังคับ)"
                  min={todayKey()}
                  value={note.followUpDue}
                  disabled={locked}
                  error={noteErrors['note-due']}
                  onChange={(val) => {
                    setNote((n) => ({ ...n, followUpDue: val }));
                    setDirty(true);
                  }}
                />
                {canWork && !confirmedAt && (
                  <div className="flex flex-col gap-2">
                    <div role="status" className="min-h-[24px] text-base font-semibold text-slate-600">
                      {autosave.state === 'saving' && 'กำลังบันทึก...'}
                      {autosave.state === 'saved' && `บันทึกร่างอัตโนมัติแล้ว ${autosave.at} น.`}
                      {autosave.state === 'idle' && 'ระบบบันทึกร่างให้อัตโนมัติ ผู้ใช้จะเห็นเมื่อกดส่งเท่านั้น'}
                    </div>
                    {autosave.state === 'failed' && (
                      <Button variant="neutral" size="sm" onClick={() => setRetry((n) => n + 1)}>
                        บันทึกไม่สำเร็จ กดเพื่อลองใหม่
                      </Button>
                    )}
                    <Button disabled={saving} onClick={() => validateNote() && setConfirmOpen(true)}>
                      <Send className="w-5 h-5" aria-hidden="true" />
                      ส่งบันทึกให้ผู้ใช้และปิดการปรึกษา
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
          <Button variant="neutral" fullWidth onClick={() => setPhase('chat')}>
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            {finished ? 'ดูข้อความสนทนา' : 'กลับไปคุยต่อ'}
          </Button>
          {finished && (
            <Link to="/pharmacist" className="flex min-h-[54px] items-center justify-center rounded-full bg-purple-700 px-4 text-lg font-bold text-white hover:bg-purple-800">
              กลับไปคิว
            </Link>
          )}
        </section>
      )}

      <QueueDrawer selectedId={id} />

      <Modal open={infoOpen} onClose={() => setInfoOpen(false)} title="ข้อมูลผู้ป่วย">
        <div className="space-y-3 py-4">
          {!ownerState ? (
            <div className="space-y-2 py-8 text-center">
              <ShieldOff className="w-10 h-10 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-lg font-semibold text-slate-900">{lockedReason}</p>
              <p className="text-base text-slate-600">ระบบบันทึกทุกครั้งที่เปิดดูข้อมูลสุขภาพ จึงเปิดเฉพาะผู้ที่รับผิดชอบเคส</p>
            </div>
          ) : brief.loading ? (
            <LoadingCard label="กำลังเปิดข้อมูลผู้ป่วย..." />
          ) : brief.error || !consentActive ? (
            <div className="py-8 text-center">
              <ShieldOff className="w-10 h-10 text-slate-400 mx-auto mb-3" aria-hidden="true" />
              <p className="text-lg font-semibold text-slate-900">{brief.error || 'ผู้ใช้ถอนความยินยอมแล้ว จึงเปิดข้อมูลสุขภาพไม่ได้'}</p>
            </div>
          ) : (
            brief.brief && (
              <BriefView
                brief={brief.brief}
                sessionId={id}
                audience="staff"
                onAsk={
                  canWork
                    ? (text) => {
                        setInsert({ text, key: Date.now() });
                        setPhase('chat');
                        setInfoOpen(false);
                      }
                    : undefined
                }
              />
            )
          )}

          {followUps.map((f) => (
            <Card key={f.id} className="p-4 space-y-2">
              <h3 className="text-lg font-bold text-slate-900">ติดตามผล {f.dueDate}</h3>
              {f.plan && <p className="text-base text-slate-800 break-words">{f.plan}</p>}
              {f.response ? (
                <>
                  <p className="text-base text-slate-800">
                    อาการล่าสุด {f.response.severity !== null ? `${f.response.severity}/10` : 'ไม่ระบุ'}
                    {f.response.trend && ` · ${TREND_LABEL[f.response.trend]}`}
                  </p>
                  {brief.brief?.symptoms && <p className="text-base font-semibold text-slate-900">{DIRECTION_LABEL[severityDirection(brief.brief.symptoms.severity, f.response.severity)]}</p>}
                  {f.response.note && <p className="text-base text-slate-800 break-words whitespace-pre-wrap">{f.response.note}</p>}
                  {f.status === 'responded' && (
                    <Button variant="soft" size="sm" onClick={() => void run((b) => b.reviewFollowUp(f.id), 'บันทึกว่าตรวจแล้ว')}>
                      ตรวจแล้ว
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-base text-slate-600">ผู้ใช้ยังไม่ได้อัปเดตอาการ</p>
              )}
            </Card>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="ส่งบันทึกให้ผู้ใช้?"
        message="ผู้ใช้จะเห็นบันทึกนี้ทันที และแก้ไขไม่ได้อีกหลังส่ง การปรึกษาจะถูกปิด"
        confirmLabel="ส่งบันทึก"
        tone="primary"
        onConfirm={() => void confirm()}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={confirmRelease}
        title="คืนเคสนี้เข้าคิว?"
        message="เคสจะกลับไปรอรับเรื่อง เพื่อนร่วมงานรับต่อได้ บันทึกที่ยังไม่ยืนยันจะยังอยู่ให้ผู้รับต่อ"
        confirmLabel="คืนเข้าคิว"
        tone="primary"
        onConfirm={() => {
          setConfirmRelease(false);
          void run((b) => b.releaseSession(id), 'คืนเคสเข้าคิวแล้ว');
        }}
        onCancel={() => setConfirmRelease(false)}
      />
      <ConfirmDialog
        open={confirmTakeOver}
        title="รับช่วงต่อเคสนี้?"
        message={`${session.assignedName || 'เพื่อนร่วมงาน'} จะตอบและเปิดข้อมูลผู้ป่วยในเคสนี้ไม่ได้อีก ใช้เมื่อเพื่อนร่วมงานไม่อยู่แล้วเท่านั้น ระบบบันทึกการรับช่วงไว้ ผู้ป่วยเห็นในประวัติการเข้าถึง`}
        confirmLabel="รับช่วงต่อ"
        tone="primary"
        onConfirm={() => {
          setConfirmTakeOver(false);
          void run((b) => b.takeOverSession(id), 'รับช่วงต่อแล้ว');
        }}
        onCancel={() => setConfirmTakeOver(false)}
      />
      <ConfirmDialog
        open={confirmDecline}
        title="ปฏิเสธคำขอนี้?"
        message="ผู้ใช้จะเห็นว่าการปรึกษาถูกยกเลิก และต้องเลือกผู้ให้บริการใหม่"
        confirmLabel="ปฏิเสธคำขอ"
        onConfirm={() => {
          setConfirmDecline(false);
          void run((b) => b.declineSession(id), 'ปฏิเสธคำขอแล้ว');
        }}
        onCancel={() => setConfirmDecline(false)}
      />
    </div>
  );
};
