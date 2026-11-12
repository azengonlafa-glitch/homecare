import React, { useEffect, useRef } from 'react';
import { Camera, CameraOff, FlaskConical, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Video } from 'lucide-react';
import { CONSULT_MODE } from '../../consult/backend';
import { formatDuration } from '../../consult/calls';
import type { RtcCall } from '../../consult/rtc';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

const Toggle: React.FC<{ on: boolean; onClick: () => void; onLabel: string; offLabel: string; OnIcon: React.ElementType; OffIcon: React.ElementType }> = ({
  on,
  onClick,
  onLabel,
  offLabel,
  OnIcon,
  OffIcon,
}) => {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!on}
      className={cn('inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-base font-bold cursor-pointer', on ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-800 bg-slate-800 text-white')}
    >
      <Icon className="w-6 h-6" aria-hidden="true" />
      {on ? onLabel : offLabel}
    </button>
  );
};

/** เล่นสตรีมกล้อง/เสียงจากอุปกรณ์หรือปลายสาย (srcObject ตั้งผ่าน ref ไม่ได้ตั้งผ่าน attribute) */
const Stream: React.FC<{ stream: MediaStream | null; as: 'video' | 'audio'; muted?: boolean; className?: string; label?: string }> = ({ stream, as, muted, className, label }) => {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return as === 'video' ? (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} aria-label={label} />
  ) : (
    <audio ref={ref} autoPlay muted={muted} />
  );
};

const kindName = (kind: 'voice' | 'video') => (kind === 'video' ? 'วิดีโอคอล' : 'โทรเสียง');

/** สายเรียกเข้า แสดงเหนือทุกแท็บ ผู้ใช้ไม่ต้องอยู่หน้าโทรก็เห็นและรับสายได้ */
export const IncomingCallBanner: React.FC<{ call: RtcCall; peerName: string }> = ({ call, peerName }) => {
  useEffect(() => {
    if (call.phase !== 'incoming') return;
    const previous = document.title;
    document.title = `📞 สายเรียกเข้า · ${peerName}`;
    navigator.vibrate?.([300, 200, 300, 200, 300]);
    return () => {
      document.title = previous;
    };
  }, [call.phase, peerName]);

  if (call.phase !== 'incoming') return null;
  return (
    <div role="alert" className="rounded-3xl border-2 border-emerald-600 bg-emerald-50 p-4 sm:p-5 space-y-3 anim-pop">
      <p className="flex items-center gap-2 text-lg font-extrabold text-emerald-950">
        <PhoneIncoming className="w-7 h-7 shrink-0" aria-hidden="true" />
        {peerName} กำลัง{call.kind === 'video' ? 'วิดีโอคอลหาคุณ' : 'โทรหาคุณ'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={call.decline} className="inline-flex min-h-[58px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-red-700 px-2 text-base sm:text-lg font-bold text-white hover:bg-red-800">
          <PhoneOff className="w-6 h-6" aria-hidden="true" />
          ไม่รับสาย
        </button>
        <button type="button" onClick={() => void call.accept()} className="inline-flex min-h-[58px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-emerald-700 px-2 text-base sm:text-lg font-bold text-white hover:bg-emerald-800">
          {call.kind === 'video' ? <Video className="w-6 h-6" aria-hidden="true" /> : <Phone className="w-6 h-6" aria-hidden="true" />}
          รับสาย
        </button>
      </div>
    </div>
  );
};

/** หน้าจอโทรเสียงและวิดีโอคอล แสดงสถานะของสายที่ useRtcCall ควบคุมอยู่ */
export const CallPanel: React.FC<{ call: RtcCall; kind: 'voice' | 'video'; peerName: string; canCall: boolean }> = ({ call, kind, peerName, canCall }) => {
  const active = call.phase !== 'idle' && call.phase !== 'incoming';
  const shownKind = active ? call.kind : kind;
  const StartIcon = shownKind === 'video' ? Video : Phone;
  const name = kindName(shownKind);

  return (
    <section aria-label={name} className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
      {CONSULT_MODE === 'mock' && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-300 p-3 text-base font-semibold text-amber-950">
          <FlaskConical className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          โหมดทดสอบ: โทรได้จริงเฉพาะระหว่างสองแท็บของเบราว์เซอร์นี้ ไม่มีใครภายนอกได้ยิน
        </p>
      )}

      {/* เสียงของปลายสายเล่นผ่าน audio เสมอ (วิดีโอเล่นเสียงเองอยู่แล้ว) */}
      {call.phase === 'in-call' && shownKind === 'voice' && <Stream stream={call.remoteStream} as="audio" />}

      {call.phase === 'idle' || call.phase === 'incoming' ? (
        <>
          {call.error && (
            <p role="alert" className="text-base font-semibold text-red-700">
              {call.error}
            </p>
          )}
          <Button fullWidth disabled={!canCall || call.phase === 'incoming'} onClick={() => void call.startCall(kind)}>
            <StartIcon className="w-6 h-6" aria-hidden="true" />
            เริ่ม{kindName(kind)}
          </Button>
          {!canCall && <p className="text-center text-base text-slate-600">โทรได้เมื่อร้านยาหรือคลินิกรับเรื่องแล้ว ระหว่างนี้พิมพ์ข้อความได้</p>}
        </>
      ) : (
        <>
          {shownKind === 'video' && (
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900">
              {call.phase === 'in-call' && call.remoteStream ? (
                <Stream stream={call.remoteStream} as="video" className="h-full w-full object-cover" label={`ภาพจาก ${peerName}`} />
              ) : (
                <Stream stream={call.localStream} as="video" muted className="h-full w-full object-cover" label="ภาพจากกล้องของคุณ" />
              )}
              {call.phase === 'in-call' && (
                <Stream stream={call.localStream} as="video" muted className="absolute bottom-2 right-2 h-24 w-16 rounded-xl border-2 border-white object-cover sm:h-28 sm:w-20" label="ภาพจากกล้องของคุณ" />
              )}
              {call.cameraOff && <p className="absolute inset-x-0 top-2 text-center text-sm font-semibold text-white">คุณปิดกล้องอยู่</p>}
            </div>
          )}
          <p role="status" className="text-center text-lg font-bold text-slate-900">
            {call.phase === 'calling' && `กำลังโทรหา ${peerName}... รอปลายสายรับ`}
            {call.phase === 'connecting' && 'กำลังเชื่อมต่อ...'}
            {call.phase === 'in-call' && (
              <>
                กำลังคุยกับ {peerName} · <span className="tabular-nums">{formatDuration(call.seconds)}</span>
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {call.phase !== 'calling' && <Toggle on={!call.muted} onClick={call.toggleMute} onLabel="ปิดไมค์" offLabel="เปิดไมค์" OnIcon={Mic} OffIcon={MicOff} />}
            {shownKind === 'video' && call.phase !== 'calling' && <Toggle on={!call.cameraOff} onClick={call.toggleCamera} onLabel="ปิดกล้อง" offLabel="เปิดกล้อง" OnIcon={Camera} OffIcon={CameraOff} />}
            <button type="button" onClick={call.hangup} className="inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 text-base font-bold text-white hover:bg-red-800 cursor-pointer">
              <PhoneOff className="w-6 h-6" aria-hidden="true" />
              {call.phase === 'calling' ? 'ยกเลิกการโทร' : 'วางสาย'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
