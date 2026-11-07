import { useCallback, useEffect, useRef, useState } from 'react';
import { CONSULT_MODE } from './backend';
import { requireClient } from '../cloud/client';
import { newUuid } from './files';

/**
 * โทรเสียงและวิดีโอคอลจริงแบบ WebRTC: เสียงและภาพวิ่งตรงระหว่างสองเบราว์เซอร์ ไม่ผ่านเซิร์ฟเวอร์ของเรา
 * - โหมดจริง: ส่งสัญญาณนัดหมาย (ring/offer/answer/ice) ผ่าน Supabase Realtime ช่อง private
 *   ซึ่งฐานข้อมูลจำกัดสิทธิ์ไว้เฉพาะผู้ป่วยเจ้าของเคสกับผู้ดูแลเคส (supabase/consult_v5.sql)
 * - โหมดทดสอบ: ส่งสัญญาณข้ามแท็บของเบราว์เซอร์เดียวกันด้วย BroadcastChannel จึงลองโทรจริงระหว่างสองแท็บได้
 */

export type CallKind = 'voice' | 'video';
export type CallPhase = 'idle' | 'calling' | 'incoming' | 'connecting' | 'in-call';
export type CallOutcome = 'connected' | 'missed' | 'declined' | 'busy' | 'cancelled' | 'failed';

export interface CallResult {
  role: 'caller' | 'callee';
  kind: CallKind;
  outcome: CallOutcome;
  seconds: number;
}

interface Signal {
  callId: string;
  from: string;
  type: 'ring' | 'accept' | 'decline' | 'busy' | 'offer' | 'answer' | 'ice' | 'hangup';
  kind?: CallKind;
  sdp?: string;
  candidate?: RTCIceCandidateInit | null;
}

interface Transport {
  ready: Promise<void>;
  send: (signal: Signal) => void;
  close: () => void;
}

/** ผู้โทรเรียกซ้ำทุกกี่มิลลิวินาที เผื่อปลายสายเพิ่งเปิดหน้าและยังไม่ทันฟังช่องสัญญาณ */
const RING_REPEAT_MS = 2500;
/** รอปลายสายรับกี่มิลลิวินาทีก่อนถือว่าไม่มีผู้รับสาย */
export const RING_TIMEOUT_MS = 45_000;
/** เชื่อมต่อหลุดชั่วคราวได้นานกี่มิลลิวินาทีก่อนตัดสาย */
const DISCONNECT_GRACE_MS = 8000;

/** STUN ฟรีใช้ได้เลย ถ้าเครือข่ายที่เข้มงวด (บางมือถือ/ออฟฟิศ) ต่อกันตรงไม่ได้ ต้องมี TURN ตั้งใน .env */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const urls = (import.meta.env.VITE_TURN_URLS as string | undefined)?.split(',').map((u) => u.trim()).filter(Boolean) ?? [];
  const username = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
  const credential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();
  if (urls.length > 0 && username && credential) servers.push({ urls, username, credential });
  return servers;
}

function createTransport(sessionId: string, onSignal: (s: Signal) => void): Transport {
  if (CONSULT_MODE === 'live') {
    const sb = requireClient();
    const channel = sb.channel(`consult-call:${sessionId}`, { config: { private: true, broadcast: { self: false } } });
    channel.on('broadcast', { event: 'sig' }, ({ payload }) => onSignal(payload as Signal));
    const ready = new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') reject(new Error('signal-unavailable'));
      });
    });
    ready.catch(() => undefined);
    return {
      ready,
      send: (signal) => void channel.send({ type: 'broadcast', event: 'sig', payload: signal }),
      close: () => void sb.removeChannel(channel),
    };
  }
  const bc = new BroadcastChannel(`growa-call-${sessionId}`);
  bc.onmessage = (e) => onSignal(e.data as Signal);
  return { ready: Promise.resolve(), send: (signal) => bc.postMessage(signal), close: () => bc.close() };
}

function mediaError(kind: CallKind, err: unknown): string {
  if (err instanceof Error && err.message === 'unsupported') return 'เบราว์เซอร์นี้ไม่รองรับการโทร';
  return `ใช้${kind === 'video' ? 'กล้องหรือไมค์' : 'ไมค์'}ไม่ได้ กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์แล้วลองใหม่`;
}

/**
 * ตัวควบคุมการโทรของเคสหนึ่ง ใช้ได้ทั้งฝั่งผู้ป่วยและเจ้าหน้าที่ (ใครโทรก่อนคือผู้โทร)
 * enabled = เปิดฟังสัญญาณได้เมื่อเคสกำลังปรึกษาและผู้ใช้มีสิทธิ์โทรเท่านั้น
 */
export function useRtcCall(sessionId: string, enabled: boolean, onFinished?: (result: CallResult) => void) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [kind, setKind] = useState<CallKind>('voice');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const clientId = useRef(newUuid());
  const transport = useRef<Transport | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const callId = useRef('');
  const role = useRef<'caller' | 'callee'>('caller');
  const phaseRef = useRef<CallPhase>('idle');
  const kindRef = useRef<CallKind>('voice');
  const secondsRef = useRef(0);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const timers = useRef<{ ring?: number; repeat?: number; tick?: number; grace?: number; incoming?: number }>({});
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const setPhaseBoth = (p: CallPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearTimers = () => {
    const t = timers.current;
    window.clearTimeout(t.ring);
    window.clearInterval(t.repeat);
    window.clearInterval(t.tick);
    window.clearTimeout(t.grace);
    window.clearTimeout(t.incoming);
    timers.current = {};
  };

  const reset = () => {
    clearTimers();
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    pc.current?.close();
    pc.current = null;
    pendingIce.current = [];
    callId.current = '';
    secondsRef.current = 0;
    setLocalStream(null);
    setRemoteStream(null);
    setSeconds(0);
    setMuted(false);
    setCameraOff(false);
    setPhaseBoth('idle');
  };

  const send = (type: Signal['type'], extra: Partial<Signal> = {}) => transport.current?.send({ callId: callId.current, from: clientId.current, type, ...extra });

  const finish = (outcome: CallOutcome) => {
    const result: CallResult = { role: role.current, kind: kindRef.current, outcome, seconds: secondsRef.current };
    reset();
    onFinishedRef.current?.(result);
  };

  const getMedia = async (k: CallKind) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: k === 'video' });
    local.current = stream;
    setLocalStream(stream);
    return stream;
  };

  const createPeer = (stream: MediaStream) => {
    const peer = new RTCPeerConnection({ iceServers: iceServers() });
    pc.current = peer;
    stream.getTracks().forEach((t) => peer.addTrack(t, stream));
    peer.onicecandidate = (e) => {
      if (e.candidate) send('ice', { candidate: e.candidate.toJSON() });
    };
    peer.ontrack = (e) => setRemoteStream(e.streams[0] ?? new MediaStream([e.track]));
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'connected') {
        window.clearTimeout(timers.current.grace);
        if (phaseRef.current !== 'in-call') {
          setPhaseBoth('in-call');
          secondsRef.current = 0;
          setSeconds(0);
          timers.current.tick = window.setInterval(() => {
            secondsRef.current += 1;
            setSeconds(secondsRef.current);
          }, 1000);
        }
      } else if (state === 'failed') {
        setError('เชื่อมต่อไม่สำเร็จ ลองโทรใหม่ หรือพิมพ์ข้อความแทน');
        send('hangup');
        finish(secondsRef.current > 0 ? 'connected' : 'failed');
      } else if (state === 'disconnected') {
        window.clearTimeout(timers.current.grace);
        timers.current.grace = window.setTimeout(() => {
          if (pc.current === peer && peer.connectionState !== 'connected') {
            setError('สัญญาณหลุด สายถูกตัด');
            send('hangup');
            finish(secondsRef.current > 0 ? 'connected' : 'failed');
          }
        }, DISCONNECT_GRACE_MS);
      }
    };
    return peer;
  };

  const flushIce = async () => {
    const peer = pc.current;
    if (!peer) return;
    for (const c of pendingIce.current.splice(0)) await peer.addIceCandidate(c).catch(() => undefined);
  };

  const handleSignal = async (s: Signal) => {
    if (!s || s.from === clientId.current) return;
    try {
      if (s.type === 'ring') {
        if (callId.current === s.callId) return; // เรียกซ้ำของสายเดิม
        if (phaseRef.current !== 'idle') {
          transport.current?.send({ callId: s.callId, from: clientId.current, type: 'busy' });
          return;
        }
        callId.current = s.callId;
        role.current = 'callee';
        kindRef.current = s.kind ?? 'voice';
        setKind(kindRef.current);
        setError('');
        setPhaseBoth('incoming');
        // ผู้โทรหยุดเรียกไปแล้วแต่ไม่มี hangup (เช่นปิดแท็บ) ให้ล้างสายค้างเอง
        timers.current.incoming = window.setTimeout(() => {
          if (phaseRef.current === 'incoming') finish('missed');
        }, RING_TIMEOUT_MS + 5000);
        return;
      }
      if (s.callId !== callId.current) return;
      switch (s.type) {
        case 'accept': {
          if (role.current !== 'caller' || phaseRef.current !== 'calling' || !local.current) return;
          window.clearTimeout(timers.current.ring);
          window.clearInterval(timers.current.repeat);
          setPhaseBoth('connecting');
          const peer = createPeer(local.current);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          send('offer', { sdp: offer.sdp });
          return;
        }
        case 'offer': {
          const peer = pc.current;
          if (role.current !== 'callee' || !peer || !s.sdp) return;
          await peer.setRemoteDescription({ type: 'offer', sdp: s.sdp });
          await flushIce();
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send('answer', { sdp: answer.sdp });
          return;
        }
        case 'answer': {
          const peer = pc.current;
          if (role.current !== 'caller' || !peer || !s.sdp) return;
          await peer.setRemoteDescription({ type: 'answer', sdp: s.sdp });
          await flushIce();
          return;
        }
        case 'ice': {
          if (!s.candidate) return;
          const peer = pc.current;
          if (peer?.remoteDescription) await peer.addIceCandidate(s.candidate).catch(() => undefined);
          else pendingIce.current.push(s.candidate);
          return;
        }
        case 'decline':
          if (role.current === 'caller') finish('declined');
          return;
        case 'busy':
          if (role.current === 'caller') finish('busy');
          return;
        case 'hangup':
          if (phaseRef.current === 'incoming') finish('cancelled');
          else finish(secondsRef.current > 0 ? 'connected' : phaseRef.current === 'in-call' ? 'connected' : 'cancelled');
          return;
      }
    } catch (err) {
      console.error('Call signal failed', err);
      setError('เชื่อมต่อไม่สำเร็จ ลองโทรใหม่ หรือพิมพ์ข้อความแทน');
      send('hangup');
      finish('failed');
    }
  };
  const handleRef = useRef(handleSignal);
  handleRef.current = handleSignal;

  // เปิดช่องสัญญาณเมื่อมีสิทธิ์ ปิดและวางสายเมื่อหมดสิทธิ์ (เช่นเคสถูกปิด) หรือออกจากหน้า
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const t = createTransport(sessionId, (s) => active && void handleRef.current(s));
    transport.current = t;
    return () => {
      active = false;
      if (phaseRef.current !== 'idle') {
        transport.current?.send({ callId: callId.current, from: clientId.current, type: 'hangup' });
        reset();
      }
      t.close();
      transport.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled]);

  const startCall = useCallback(async (k: CallKind) => {
    if (phaseRef.current !== 'idle' || !transport.current) return;
    setError('');
    role.current = 'caller';
    kindRef.current = k;
    setKind(k);
    try {
      await getMedia(k);
    } catch (err) {
      setError(mediaError(k, err));
      return;
    }
    callId.current = newUuid();
    setPhaseBoth('calling');
    try {
      await transport.current.ready;
    } catch {
      setError('ยังโทรไม่ได้ในตอนนี้ กรุณาลองใหม่ หรือพิมพ์ข้อความแทน');
      finish('failed');
      return;
    }
    send('ring', { kind: k });
    timers.current.repeat = window.setInterval(() => send('ring', { kind: k }), RING_REPEAT_MS);
    timers.current.ring = window.setTimeout(() => {
      if (phaseRef.current === 'calling') {
        send('hangup');
        finish('missed');
      }
    }, RING_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = useCallback(async () => {
    if (phaseRef.current !== 'incoming') return;
    window.clearTimeout(timers.current.incoming);
    try {
      const stream = await getMedia(kindRef.current);
      setPhaseBoth('connecting');
      createPeer(stream);
      send('accept');
    } catch (err) {
      setError(mediaError(kindRef.current, err));
      send('decline');
      finish('declined');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decline = useCallback(() => {
    if (phaseRef.current !== 'incoming') return;
    send('decline');
    finish('declined');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hangup = useCallback(() => {
    if (phaseRef.current === 'idle') return;
    send('hangup');
    const wasTalking = phaseRef.current === 'in-call';
    finish(wasTalking ? 'connected' : 'cancelled');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      local.current?.getAudioTracks().forEach((t) => (t.enabled = m));
      return !m;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOff((off) => {
      local.current?.getVideoTracks().forEach((t) => (t.enabled = off));
      return !off;
    });
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return { phase, kind, error, muted, cameraOff, seconds, localStream, remoteStream, startCall, accept, decline, hangup, toggleMute, toggleCamera, clearError };
}

export type RtcCall = ReturnType<typeof useRtcCall>;
