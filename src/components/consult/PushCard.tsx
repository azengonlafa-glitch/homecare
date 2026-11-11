import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '../../consult/push';

/** เปิด/ปิดแจ้งเตือนนอกเว็บ (นัดติดตามผลและเวลากินยา) ไม่แสดงเลยถ้าเครื่องนี้ใช้ไม่ได้ */
export const PushCard: React.FC<{ title?: string }> = ({ title = 'แจ้งเตือนเมื่อถึงนัดติดตามผลและเวลากินยา' }) => {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let alive = true;
    void getPushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  if (!state || state === 'unavailable') return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await (state === 'on' ? disablePush() : enablePush());
      setState(next);
      if (next === 'on') toast.show('เปิดการแจ้งเตือนแล้ว');
      if (next === 'off' && state === 'on') toast.show('ปิดการแจ้งเตือนแล้ว');
    } catch (err) {
      console.error('Push toggle failed', err);
      toast.show('ตั้งค่าการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const result = await sendTestPush();
      if (result === 'sent') toast.show('ส่งแล้ว รอสักครู่ แจ้งเตือนจะเด้งบนเครื่องที่เปิดไว้');
      else if (result === 'too-soon') toast.show('เพิ่งส่งไป รอสักครู่แล้วลองใหม่', { tone: 'error' });
      else if (result === 'no-device') toast.show('ยังไม่พบเครื่องที่เปิดแจ้งเตือน ลองปิดแล้วเปิดสวิตช์ใหม่', { tone: 'error' });
      else toast.show('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', { tone: 'error' });
    } catch {
      toast.show('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง', { tone: 'error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-3 p-5">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Bell className="w-5 h-5 shrink-0 text-purple-700" aria-hidden="true" />
          {title}
        </h2>
        <p className="mt-1 text-base text-slate-600">
          {state === 'needs-install'
            ? 'บน iPhone ต้องกดแชร์แล้วเลือก "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดแอปจากไอคอนนั้นก่อน จึงจะเปิดการแจ้งเตือนได้'
            : state === 'blocked'
              ? 'เบราว์เซอร์ปิดการแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่การตั้งค่าของเบราว์เซอร์'
              : 'เตือนบนเครื่องนี้แม้ปิดแอปอยู่ ข้อความเตือนไม่มีชื่อยาหรือข้อมูลสุขภาพของคุณ เสียงเป็นไปตามที่ตั้งในเครื่อง'}
        </p>
      </div>
      {state === 'on' && (
        <Button variant="soft" size="sm" disabled={testing || busy} onClick={() => void sendTest()}>
          {testing ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Bell className="w-5 h-5" aria-hidden="true" />}
          ส่งแจ้งเตือนทดสอบ
        </Button>
      )}
      {(state === 'on' || state === 'off') && (
        <Button variant={state === 'on' ? 'neutral' : 'soft'} size="sm" disabled={busy} onClick={() => void toggle()}>
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : state === 'on' ? (
            <BellOff className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Bell className="w-5 h-5" aria-hidden="true" />
          )}
          {state === 'on' ? 'ปิดการแจ้งเตือน' : 'เปิดการแจ้งเตือน'}
        </Button>
      )}
    </Card>
  );
};
