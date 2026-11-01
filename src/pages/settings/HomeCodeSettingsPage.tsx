import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageLayout } from '../../components/settings/PageLayout';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { generateInviteCode, loadSettings, saveSettings } from '../../lib/settings';

/** "482 916" เพื่อให้อ่านและบอกต่อได้ง่าย */
const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** ข้อความ "คัดลอกแล้ว ✓" ค้างที่ปุ่มกี่มิลลิวินาที */
const COPIED_LABEL_MS = 2000;

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // เบราว์เซอร์ไม่อนุญาตคลิปบอร์ด: ลองวิธีสำรองด้านล่าง
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
};

/** ตั้งค่า > บ้านและรหัสชวน */
export const HomeCodeSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [confirmChange, setConfirmChange] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const toast = useToast();

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const code = settings.inviteCode;
  const shownCode = formatCode(code);
  const shareText = `ชวนเข้าร่วมบ้าน "${settings.homeName}" บน Growa Homecare ใช้รหัสชวน ${shownCode} ${window.location.origin}`;

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_LABEL_MS);
      toast.show('คัดลอกแล้ว');
    } else {
      toast.show('คัดลอกไม่ได้ กรุณากดค้างที่รหัสเพื่อคัดลอกเอง', { tone: 'error' });
    }
  };

  const handleShare = async () => {
    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    if (canNativeShare) {
      try {
        await navigator.share({ title: 'ชวนเข้าร่วมบ้าน Growa Homecare', text: shareText });
        return;
      } catch (err) {
        // ผู้ใช้กดยกเลิกเอง: ไม่ต้องเปิดไลน์ต่อ
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleChangeCode = () => {
    const next = saveSettings({ ...settings, inviteCode: generateInviteCode() });
    setSettings(next);
    setCopied(false);
    setConfirmChange(false);
    toast.show('เปลี่ยนรหัสใหม่แล้ว');
  };

  return (
    <PageLayout title="บ้านและรหัสชวน" description="ให้ญาติใช้รหัสนี้เพื่อเข้ามาช่วยดูแลในบ้านเดียวกัน">
      <Card>
        <p className="text-base font-semibold text-slate-600">ชื่อบ้าน</p>
        <p className="mt-1 text-lg font-bold text-slate-900 break-words">{settings.homeName}</p>

        <div className="mt-5 rounded-2xl bg-purple-50 border border-purple-200 px-4 py-6 text-center">
          <p className="text-base font-semibold text-purple-900 flex items-center justify-center gap-1.5">
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            รหัสชวน 6 หลัก
          </p>
          <p className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-[0.15em] text-purple-700 whitespace-nowrap select-all">
            {shownCode}
          </p>
        </div>

        <p className="mt-4 text-base text-slate-700">ให้ญาติกด “เข้าร่วมบ้าน” แล้วใส่รหัสนี้</p>

        {/* ปุ่มอยู่ต่อจากรหัสทันที: หลัก (ชวนทางไลน์) > รอง (คัดลอก) > ตัวอักษร (เปลี่ยนรหัส กันกดพลาด) */}
        <div className="mt-5 space-y-3">
          <Button fullWidth onClick={handleShare}>
            <Share2 className="w-6 h-6" aria-hidden="true" />
            <span>ชวนทางไลน์</span>
          </Button>

          <Button variant="soft" fullWidth onClick={handleCopy}>
            {copied ? (
              <Check className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Copy className="w-6 h-6" aria-hidden="true" />
            )}
            <span>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกรหัส'}</span>
          </Button>

          <button
            type="button"
            onClick={() => setConfirmChange(true)}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl text-base font-bold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" aria-hidden="true" />
            <span>เปลี่ยนรหัสใหม่</span>
          </button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmChange}
        title="เปลี่ยนรหัสชวนใหม่?"
        message="รหัสเดิมจะใช้ไม่ได้ทันที ญาติที่ยังไม่ได้เข้าร่วมบ้านต้องขอรหัสใหม่จากคุณ ส่วนคนที่อยู่ในบ้านแล้วไม่ได้รับผลกระทบ"
        confirmLabel="เปลี่ยนรหัส"
        tone="primary"
        onCancel={() => setConfirmChange(false)}
        onConfirm={handleChangeCode}
      />
    </PageLayout>
  );
};
