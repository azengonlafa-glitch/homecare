import React, { useEffect, useState } from 'react';
import { BellRing, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { enablePush, getPushState, type PushState } from '../../consult/push';
import { privacyIntroAnswered } from '../../lib/privacyIntro';
import { markPushPromptAnswered, pushPromptAnswered, shouldAskPush } from '../../consult/pushPrompt';

/**
 * ชวนผู้ใช้ใหม่เปิดแจ้งเตือนเวลากินยาตอนเข้าหน้ายาครั้งแรก ขึ้นเองเฉพาะเมื่อเปิดใช้ได้จริง
 * (เชื่อมระบบแล้ว เครื่องรองรับ ยังไม่เปิด และไม่เคยตอบ) กดยินยอมแล้วเบราว์เซอร์จะถามขออนุญาตอีกชั้นหนึ่ง
 */
export const PushPromptModal: React.FC = () => {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [never, setNever] = useState(false);

  useEffect(() => {
    // ให้หน้าต่างอธิบายความเป็นส่วนตัวขึ้นก่อน ไม่ให้สองหน้าต่างทับกัน (รอบหน้าค่อยถามเรื่องแจ้งเตือน)
    if (pushPromptAnswered() || !privacyIntroAnswered()) return;
    let alive = true;
    let timer: number | undefined;
    void getPushState()
      .then((s) => {
        if (!alive || !shouldAskPush(s, false)) return;
        setState(s);
        // ให้หน้ายาขึ้นให้เห็นก่อน แล้วค่อยถาม ไม่ให้ดูเหมือนบล็อกการใช้งานตั้งแต่เปิดหน้า
        timer = window.setTimeout(() => alive && setOpen(true), 900);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  if (!state) return null;

  const close = (answer: 'later' | 'blocked' | 'seen' | 'enabled') => {
    // "ไว้ทีหลัง" ที่ไม่ได้ติ๊ก "ไม่ต้องแสดงอีก" จำแค่รอบนี้ รอบหน้าถามใหม่
    markPushPromptAnswered(answer, answer === 'later' ? never : true);
    setOpen(false);
  };

  const agree = async () => {
    setBusy(true);
    setNote('');
    try {
      const next = await enablePush();
      if (next === 'on') {
        toast.show('เปิดการแจ้งเตือนแล้ว');
        close('enabled');
      } else if (next === 'blocked') {
        markPushPromptAnswered('blocked');
        setState('blocked');
      } else {
        // ปิดกล่องของเบราว์เซอร์โดยไม่ตอบ: ยังไม่ถือว่าตอบ ให้ลองใหม่ได้
        setNote('ยังไม่ได้เปิด เบราว์เซอร์ต้องได้รับอนุญาตก่อน กดยินยอมอีกครั้ง แล้วเลือก “อนุญาต” ที่กล่องเล็กใกล้ช่องที่อยู่เว็บ');
      }
    } catch (err) {
      console.error('Push prompt failed', err);
      setNote('เปิดไม่สำเร็จ ลองใหม่อีกครั้ง หรือเปิดทีหลังได้ที่ ตั้งค่า > การแจ้งเตือน');
    } finally {
      setBusy(false);
    }
  };

  const consent = state === 'off';

  return (
    <Modal
      open={open}
      onClose={() => close(state === 'blocked' ? 'blocked' : 'later')}
      title={consent ? 'เปิดแจ้งเตือนเวลากินยา?' : state === 'blocked' ? 'เบราว์เซอร์ปิดแจ้งเตือนไว้' : 'เปิดแจ้งเตือนบน iPhone'}
      footer={
        consent ? (
          <div className="space-y-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-slate-800">
              <input
                type="checkbox"
                checked={never}
                onChange={(e) => setNever(e.target.checked)}
                disabled={busy}
                className="h-6 w-6 shrink-0 cursor-pointer accent-purple-700"
              />
              ไม่ต้องแสดงอีก
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button variant="neutral" onClick={() => close('later')} disabled={busy}>
                ไว้ทีหลัง
              </Button>
              <Button onClick={() => void agree()} disabled={busy}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <BellRing className="w-5 h-5" aria-hidden="true" />}
                ยินยอม เปิดการแจ้งเตือน
              </Button>
            </div>
          </div>
        ) : (
          <Button fullWidth onClick={() => close(state === 'blocked' ? 'blocked' : 'seen')}>
            เข้าใจแล้ว
          </Button>
        )
      }
    >
      <div className="space-y-4 py-5">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sun text-slate-900" aria-hidden="true">
          {consent || state === 'blocked' ? <BellRing className="w-8 h-8" /> : <Smartphone className="w-8 h-8" />}
        </span>

        {consent && (
          <>
            <p className="text-lg font-semibold leading-snug text-slate-900">ถ้ากดยินยอม การตั้งค่านี้จะช่วยให้เว็บทำงานได้ดีขึ้น และคุณไม่พลาดมื้อยา</p>
            <ul className="space-y-3 text-base text-slate-800">
              <li className="flex items-start gap-3">
                <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-purple-700" aria-hidden="true" />
                <span>เตือนเมื่อถึงเวลากินยา แม้ปิดแอปอยู่ ที่เครื่องนี้</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-700" aria-hidden="true" />
                <span>ข้อความเตือนไม่มีชื่อยาและข้อมูลสุขภาพ จึงไม่โผล่ให้คนอื่นเห็นบนหน้าจอล็อก</span>
              </li>
            </ul>
            <p className="rounded-2xl bg-peach-soft p-3 text-base text-slate-800">
              หลังกดยินยอม เบราว์เซอร์จะถามขออนุญาตอีกครั้ง ให้เลือก <strong>“อนุญาต”</strong> ปิดได้ทุกเมื่อที่ ตั้งค่า → การแจ้งเตือน
            </p>
          </>
        )}

        {state === 'blocked' && (
          <p className="text-base text-slate-800">
            เว็บนี้ถูกบล็อกการแจ้งเตือนไว้ในเบราว์เซอร์ เปิดได้โดยกดรูปกุญแจข้างที่อยู่เว็บ → การอนุญาต → การแจ้งเตือน → เลือก “อนุญาต” แล้วกลับมาเปิดที่ ตั้งค่า → การแจ้งเตือน
          </p>
        )}

        {state === 'needs-install' && (
          <p className="text-base text-slate-800">
            บน iPhone ต้องกดปุ่มแชร์ เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วเปิด Growa จากไอคอนนั้น จากนั้นไปที่ ตั้งค่า → การแจ้งเตือน เพื่อเปิดแจ้งเตือนกินยา
          </p>
        )}

        {note && (
          <p role="alert" className="text-base font-semibold text-red-700">
            {note}
          </p>
        )}
      </div>
    </Modal>
  );
};
