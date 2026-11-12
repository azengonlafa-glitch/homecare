import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, ClipboardList, FlaskConical, XCircle } from 'lucide-react';
import { BriefView } from '../../components/consult/BriefView';
import { ContactPanel } from '../../components/consult/ContactPanel';
import { ErrorCard, LoadingCard, StatusBadge } from '../../components/consult/ConsultUI';
import { NoteSummary } from '../../components/consult/NoteSummary';
import { ReviewForm } from '../../components/consult/ReviewForm';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { Avatar } from '../../components/ui/Avatar';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, CONSULT_MODE, getBackend } from '../../consult/backend';
import { useConsultData } from '../../consult/hooks';
import { currentJournalUser } from '../../lib/journal';
import { dateKey, loadEvents, pad, saveEvents, type CalendarEvent } from '../../lib/calendar';

/** เพิ่มนัดลงปฏิทินบ้าน ใช้ชื่อทั่วไปเพราะคนในบ้านเห็นปฏิทินนี้ ไม่ใส่อาการหรือเรื่องที่ปรึกษา */
function addAppointmentToCalendar(sessionId: string, iso: string): boolean {
  const events = loadEvents();
  const id = `consult-${sessionId}`;
  if (events.some((e) => e.id === id)) return false;
  const start = new Date(iso);
  const end = new Date(start.getTime() + 30 * 60_000);
  const user = currentJournalUser();
  const event: CalendarEvent = {
    id,
    title: 'นัดปรึกษาเภสัชกรหรือคลินิก',
    description: '',
    important: false,
    tags: [],
    allDay: false,
    startDate: dateKey(start),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endDate: dateKey(end),
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    timeZone: 'Asia/Bangkok',
    reminderMinutes: 30,
    repeat: null,
    location: null,
    assignees: [user.id],
    needVolunteer: false,
    attachments: [],
    comments: [],
    createdById: user.id,
    createdByName: user.name,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  saveEvents([...events, event]);
  return true;
}

/** Module 4: ห้องปรึกษาฝั่งผู้ใช้ */
export const ConsultRoomPage: React.FC = () => {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [bundle, brief] = await Promise.all([b.getBundle(id), b.getMyBrief(id)]);
      return { bundle, brief };
    },
    [id],
    { sessionId: id }
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showBrief, setShowBrief] = useState(false);

  if (loading && !data) return <LoadingCard label="กำลังเปิดห้องปรึกษา..." />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;
  if (!data?.bundle) return <ErrorCard message="ไม่พบการปรึกษานี้" />;

  const { session, provider, note, review } = data.bundle;
  const open = session.status === 'requested' || session.status === 'active';
  const providerName = provider?.displayName ?? 'ร้านยาหรือคลินิก';

  const cancel = async () => {
    try {
      const backend = await getBackend();
      await backend.cancelSession(id);
      setConfirmCancel(false);
      reload();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <Avatar src={provider?.photoUrl} name={providerName} className="w-14 h-14 text-xl" />
          <div className="min-w-0 flex-1 basis-48">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">{providerName}</h1>
            <p className="text-base text-slate-600 break-words">
              {provider?.orgName} · {session.topic}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>
        {session.scheduledAt && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-purple-50 border border-purple-200 p-3">
            <p className="flex-1 min-w-0 text-base font-semibold text-purple-950">
              {session.status === 'requested' ? 'เวลานัดที่ขอ' : 'เวลานัด'}: {new Date(session.scheduledAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
            {session.status === 'active' && (
              <Button
                variant="soft"
                size="sm"
                onClick={() => toast.show(addAppointmentToCalendar(id, session.scheduledAt!) ? 'เพิ่มลงปฏิทินแล้ว คนในบ้านจะเห็นว่ามีนัด แต่ไม่เห็นเรื่องที่ปรึกษา' : 'นัดนี้อยู่ในปฏิทินแล้ว')}
              >
                <CalendarPlus className="w-5 h-5" aria-hidden="true" />
                เพิ่มลงปฏิทินบ้าน
              </Button>
            )}
          </div>
        )}
      </Card>

      {session.status === 'requested' && (
        <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-base font-semibold text-amber-950">
          {CONSULT_MODE === 'mock' ? (
            <>
              <FlaskConical className="inline w-5 h-5 mr-1" aria-hidden="true" />
              รอการรับเรื่อง ในโหมดทดสอบให้เปิด{' '}
              <Link to="/pharmacist" target="_blank" className="underline">
                พื้นที่เภสัชกร
              </Link>{' '}
              เพื่อทดลองตอบ
            </>
          ) : (
            'ส่งข้อมูลแล้ว กำลังรอร้านยาหรือคลินิกรับเรื่อง'
          )}
        </p>
      )}

      {note && <NoteSummary note={note} />}

      {session.status === 'completed' && <ReviewForm sessionId={id} providerName={providerName} existing={review} onSaved={reload} />}

      <ContactPanel
        sessionId={id}
        as="patient"
        channels={provider?.channels ?? ['chat']}
        peerName={providerName}
        scheduledAt={session.scheduledAt}
        canSend={open}
        canCall={session.status === 'active' || CONSULT_MODE === 'mock'}
        closedText={session.status === 'completed' ? 'การปรึกษาเสร็จสิ้นแล้ว ดูคำแนะนำและนัดติดตามได้ที่หน้าประวัติ' : 'การปรึกษานี้ถูกยกเลิกแล้ว'}
        onChanged={reload}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="neutral" size="sm" onClick={() => setShowBrief((v) => !v)} aria-expanded={showBrief}>
          <ClipboardList className="w-5 h-5" aria-hidden="true" />
          {showBrief ? 'ซ่อนข้อมูลที่ส่ง' : 'ดูข้อมูลที่ส่ง'}
        </Button>
        <Link to="/consult/history" className={buttonClass('neutral', 'sm')}>
          ประวัติการปรึกษา
        </Link>
        {open && (
          <Button variant="neutral" size="sm" onClick={() => setConfirmCancel(true)}>
            <XCircle className="w-5 h-5" aria-hidden="true" />
            ยกเลิกการปรึกษา
          </Button>
        )}
      </div>

      {showBrief && data.brief && <BriefView brief={data.brief} sessionId={id} audience="patient" />}

      <ConfirmDialog
        open={confirmCancel}
        title="ยกเลิกการปรึกษานี้?"
        message="ร้านยาหรือคลินิกจะไม่สามารถตอบในห้องนี้ได้อีก"
        confirmLabel="ยกเลิกการปรึกษา"
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
};
