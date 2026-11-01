import React, { useState } from 'react';
import { Check, Copy, Mail, MessageCircle, MessageSquare, PartyPopper, Share2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button, buttonClass } from '../ui/Button';

interface HomeCreatedPanelProps {
  homeName: string;
  /** รหัสเชิญ 8 หลัก ไม่มีเว้นวรรค */
  code: string;
  onContinue: () => void;
}

/** "1234 5678" */
const displayCode = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

/** แผงหลังสร้างบ้านสำเร็จ: แสดงรหัสเชิญและช่องทางแชร์ให้คนในครอบครัว */
export const HomeCreatedPanel: React.FC<HomeCreatedPanelProps> = ({ homeName, code, onContinue }) => {
  const [copied, setCopied] = useState(false);

  const shownCode = displayCode(code);
  const message = `ชวนเข้าร่วมบ้าน "${homeName}" บน Growa Homecare ใช้รหัสเชิญ ${shownCode} กรอกที่หน้า "มีรหัสเชิญหรือไม่?" ${window.location.origin}`;
  const encoded = encodeURIComponent(message);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shownCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // เบราว์เซอร์ไม่อนุญาตคลิปบอร์ด: เลือกข้อความรหัสให้ผู้ใช้กดคัดลอกเอง
      const node = document.getElementById('invite-code-display');
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: 'ชวนเข้าร่วมบ้าน Growa Homecare', text: message });
    } catch {
      // ผู้ใช้ปิดหน้าต่างแชร์ ไม่ต้องทำอะไร
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
          <PartyPopper className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">สร้างบ้านเรียบร้อยแล้ว</h2>
        <p className="text-base text-slate-600 mt-1 break-words">
          บ้าน “{homeName}” พร้อมใช้งาน ส่งรหัสเชิญด้านล่างให้คนในครอบครัวเพื่อเข้าร่วมบ้านนี้
        </p>
      </div>

      {/* รหัสเชิญ */}
      <div className="rounded-2xl bg-purple-50 border border-purple-200 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-purple-800">รหัสเชิญบ้านของคุณ</p>
        <p
          id="invite-code-display"
          className="mt-2 text-3xl min-[400px]:text-4xl sm:text-5xl font-extrabold tracking-[0.12em] whitespace-nowrap text-purple-700 select-all"
        >
          {shownCode}
        </p>
      </div>

      {/* ช่องทางแชร์ */}
      <p className="text-base font-bold text-slate-900 mt-8 mb-3">ส่งรหัสให้คนในบ้าน</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button variant="soft" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="w-5 h-5" aria-hidden="true" />
          ) : (
            <Copy className="w-5 h-5" aria-hidden="true" />
          )}
          <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}</span>
        </Button>

        {canNativeShare && (
          <Button variant="soft" size="sm" onClick={handleNativeShare}>
            <Share2 className="w-5 h-5" aria-hidden="true" />
            <span>แชร์</span>
          </Button>
        )}

        <a
          href={`https://line.me/R/msg/text/?${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('soft', 'sm')}
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          <span>ส่งทาง LINE</span>
        </a>

        <a href={`sms:?&body=${encoded}`} className={buttonClass('soft', 'sm')}>
          <MessageSquare className="w-5 h-5" aria-hidden="true" />
          <span>ส่งทาง SMS</span>
        </a>

        <a
          href={`mailto:?subject=${encodeURIComponent('ชวนเข้าร่วมบ้าน Growa Homecare')}&body=${encoded}`}
          className={buttonClass('soft', 'sm', false, canNativeShare ? 'sm:col-span-2' : '')}
        >
          <Mail className="w-5 h-5" aria-hidden="true" />
          <span>ส่งทางอีเมล</span>
        </a>
      </div>

      {/* บอกผลการคัดลอกให้ screen reader */}
      <p className="sr-only" role="status" aria-live="polite">
        {copied ? 'คัดลอกรหัสเชิญแล้ว' : ''}
      </p>

      <Button fullWidth className="mt-8" onClick={onContinue}>
        ต่อไป: กรอกข้อมูลสุขภาพพื้นฐาน
      </Button>
    </Card>
  );
};
