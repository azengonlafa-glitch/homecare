import React, { useEffect, useState } from 'react';
import { CalendarClock, Loader2, MessageCircle, Phone, Video } from 'lucide-react';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { useToast } from '../ui/Toast';
import { CONSULT_CHANGED_EVENT, consultErrorText, getBackend } from '../../consult/backend';
import { formatDuration, isChannelAvailable } from '../../consult/calls';
import { useRtcCall, type CallResult } from '../../consult/rtc';
import type { Channel } from '../../consult/types';
import { cn } from '../../lib/cn';
import { CallPanel, IncomingCallBanner } from './CallPanel';
import { ChatPanel } from './ChatPanel';

type Mode = Channel;

const MODES: { value: Mode; label: string; icon: React.ElementType }[] = [
  { value: 'chat', label: 'ข้อความ', icon: MessageCircle },
  { value: 'voice', label: 'โทร', icon: Phone },
  { value: 'video', label: 'วิดีโอ', icon: Video },
  { value: 'appointment', label: 'นัดหมาย', icon: CalendarClock },
];

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

interface ContactPanelProps {
  sessionId: string;
  as: 'patient' | 'staff';
  /** ช่องทางที่ผู้ให้บริการรายนี้เปิดรับ */
  channels: Channel[];
  peerName: string;
  scheduledAt: string | null;
  canSend: boolean;
  canCall: boolean;
  closedText?: string;
  insert?: { text: string; key: number } | null;
  onChanged: () => void;
}

/**
 * พื้นที่ติดต่อของการปรึกษาหนึ่งครั้ง ผู้ใช้ไม่ต้องตัดสินใจล่วงหน้าว่าจะคุยแบบไหน:
 * เลือกผู้ให้บริการแล้วสลับได้ตลอด และทุกอย่างบันทึกอยู่ในประวัติบทสนทนาเดียวกัน
 */
export const ContactPanel: React.FC<ContactPanelProps> = ({ sessionId, as, channels, peerName, scheduledAt, canSend, canCall, closedText, insert, onChanged }) => {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('chat');
  const [when, setWhen] = useState(() => toLocalInput(scheduledAt));
  const [whenError, setWhenError] = useState('');
  const [busy, setBusy] = useState(false);

  const available = MODES.filter((m) => m.value === 'chat' || (channels.includes(m.value) && isChannelAvailable(m.value)));

  /** บันทึกเรื่องที่เกิดขึ้นลงประวัติบทสนทนา ถ้าบันทึกไม่ได้ไม่ต้องขัดจังหวะผู้ใช้ */
  const logToChat = async (body: string) => {
    const backend = await getBackend();
    await backend.sendMessage(sessionId, body, [], as);
    window.dispatchEvent(new Event(CONSULT_CHANGED_EVENT));
  };

  /** ผู้โทรเป็นคนบันทึกผลการโทรลงบทสนทนา เพื่อให้อีกฝ่ายที่ไม่ได้รับสายเห็นประวัติด้วย (ไม่บันทึกซ้ำสองฝั่ง) */
  const onCallFinished = (r: CallResult) => {
    if (r.role !== 'caller' || !canSend) return;
    const name = r.kind === 'video' ? 'วิดีโอคอล' : 'โทร';
    let text = '';
    if (r.outcome === 'connected' && r.seconds > 0) text = `${name} ${formatDuration(r.seconds)}`;
    else if (r.outcome === 'missed') text = `${name}แล้วไม่มีผู้รับสาย`;
    else if (r.outcome === 'declined' || r.outcome === 'busy') text = `${name}แล้วอีกฝ่ายไม่สะดวกรับสาย`;
    if (text) void logToChat(text).catch(() => undefined);
  };

  const hasCallChannel = available.some((m) => m.value === 'voice' || m.value === 'video');
  const call = useRtcCall(sessionId, canSend && canCall && hasCallChannel, onCallFinished);
  const callActive = call.phase !== 'idle' && call.phase !== 'incoming';
  // สายที่กำลังโทรอยู่ต้องเห็นเสมอ แม้ผู้ใช้สลับไปแท็บอื่นหรือรับสายจากแบนเนอร์
  useEffect(() => {
    if (callActive) setMode(call.kind);
  }, [callActive, call.kind]);

  const saveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) {
      setWhenError('กรุณาเลือกวันและเวลา');
      return;
    }
    const time = new Date(when);
    if (time.getTime() <= Date.now()) {
      setWhenError('กรุณาเลือกเวลาในอนาคต');
      return;
    }
    setWhenError('');
    setBusy(true);
    try {
      const backend = await getBackend();
      await backend.setSchedule(sessionId, time.toISOString());
      await logToChat(`${as === 'staff' ? 'เสนอเวลานัด' : 'ขอนัดหมาย'} ${time.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}`);
      onChanged();
      setMode('chat');
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <IncomingCallBanner call={call} peerName={peerName} />

      {canSend && available.length > 1 && (
        <div role="group" aria-label="วิธีติดต่อ" className={cn('grid gap-2', available.length === 2 && 'grid-cols-2', available.length === 3 && 'grid-cols-3', available.length === 4 && 'grid-cols-4')}>
          {available.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                'flex min-h-[64px] min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-2 text-center text-sm sm:text-base font-bold transition-colors',
                mode === value ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-purple-50'
              )}
            >
              <Icon className="w-6 h-6" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      {canSend && (mode === 'voice' || mode === 'video' || callActive) && <CallPanel kind={mode === 'video' ? 'video' : 'voice'} call={call} peerName={peerName} canCall={canCall} />}

      {canSend && mode === 'appointment' && (
        <form noValidate onSubmit={(e) => void saveAppointment(e)} className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <TextField id={`appt-${as}`} type="datetime-local" label="วันและเวลาที่สะดวก" value={when} error={whenError} onChange={(e) => setWhen(e.target.value)} />
          <Button type="submit" fullWidth disabled={busy}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <CalendarClock className="w-5 h-5" aria-hidden="true" />}
            {as === 'staff' ? 'เสนอเวลานัด' : 'ส่งคำขอนัดหมาย'}
          </Button>
        </form>
      )}

      <ChatPanel sessionId={sessionId} as={as} canSend={canSend} closedText={closedText} insert={insert} />
    </div>
  );
};
