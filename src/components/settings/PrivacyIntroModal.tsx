import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Settings2, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { markPrivacyIntroAnswered, privacyIntroAnswered } from '../../lib/privacyIntro';

/** อธิบายความเป็นส่วนตัวตอนเข้าบ้านครั้งแรก: ตั้งตอนนี้ได้เลย หรือกลับมาปรับทีหลังที่เมนูตั้งค่า */
export const PrivacyIntroModal: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [never, setNever] = useState(false);

  useEffect(() => {
    if (privacyIntroAnswered()) return;
    // ให้หน้าขึ้นให้เห็นก่อน แล้วค่อยอธิบาย ไม่ให้ดูเหมือนบล็อกการใช้งานตั้งแต่เปิดหน้า
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const later = () => {
    markPrivacyIntroAnswered('later', never);
    setOpen(false);
  };

  const now = () => {
    markPrivacyIntroAnswered('now', true);
    setOpen(false);
    navigate('/settings/privacy');
  };

  return (
    <Modal
      open={open}
      onClose={later}
      title="ข้อมูลของคุณ คุณเป็นคนเลือก"
      footer={
        <div className="space-y-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-base text-slate-800">
            <input
              type="checkbox"
              checked={never}
              onChange={(e) => setNever(e.target.checked)}
              className="h-6 w-6 shrink-0 cursor-pointer accent-purple-700"
            />
            ไม่ต้องแสดงอีก
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="neutral" onClick={later}>
              ไว้ทีหลัง
            </Button>
            <Button onClick={now}>
              <Settings2 className="w-5 h-5" aria-hidden="true" />
              ตั้งค่าตอนนี้
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-5">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sun text-slate-900" aria-hidden="true">
          <ShieldCheck className="w-8 h-8" />
        </span>
        <p className="text-lg font-semibold leading-snug text-slate-900">
          คนในบ้านเห็นข้อมูลสุขภาพและตารางยาของคุณได้แค่ไหน คุณกำหนดเองได้
        </p>
        <ul className="space-y-3 text-base text-slate-800">
          <li className="flex items-start gap-3">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-purple-700" aria-hidden="true" />
            <span>เลือกได้ว่าใครดูข้อมูลของคุณได้ และใครแก้ไขได้บ้าง</span>
          </li>
          <li className="flex items-start gap-3">
            <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-purple-700" aria-hidden="true" />
            <span>ตอนนี้คนในบ้านดูข้อมูลของคุณได้ แต่จะแก้ไขได้ต่อเมื่อคุณอนุญาต ถ้าไม่อยากให้ใครดู ปิดได้ที่ ตั้งค่า → ความเป็นส่วนตัว</span>
          </li>
        </ul>
        <p className="rounded-2xl bg-peach-soft p-3 text-base text-slate-800">
          ตั้งตอนนี้เลยก็ได้ หรือกลับมาปรับทีหลังที่เมนู <strong>ตั้งค่า → ความเป็นส่วนตัว</strong> เมื่อไรก็ได้
        </p>
      </div>
    </Modal>
  );
};
