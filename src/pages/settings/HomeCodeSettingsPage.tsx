import React, { useState } from 'react';
import { Copy, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SettingsSubPage } from '../../components/settings/SettingsSubPage';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { generateInviteCode, loadSettings, saveSettings } from '../../lib/settings';

/** "482 916" เพื่อให้อ่านและบอกต่อได้ง่าย */
const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

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
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const code = settings.inviteCode;
  const shownCode = formatCode(code);
  const shareText = `ชวนเข้าร่วมบ้าน "${settings.homeName}" บน Growa Homecare ใช้รหัสชวน ${shownCode} ${window.location.origin}`;

  const notify = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const handleCopy = async () => {
    const copied = await copyToClipboard(code);
    if (copied) {
      notify('คัดลอกแล้ว');
    } else {
      notify('คัดลอกไม่ได้ กรุณากดค้างที่รหัสเพื่อคัดลอกเอง', true);
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

    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  const handleChangeCode = () => {
    const next = saveSettings({ ...settings, inviteCode: generateInviteCode() });
    setSettings(next);
    setConfirmChange(false);
    notify('เปลี่ยนรหัสใหม่แล้ว');
  };

  return (
    <SettingsSubPage
      title="บ้านและรหัสชวน"
      description="ให้ญาติใช้รหัสนี้เพื่อเข้ามาช่วยดูแลในบ้านเดียวกัน"
      footer={
        <div className="space-y-3">
          <Button fullWidth onClick={handleShare}>
            <Share2 className="w-6 h-6" aria-hidden="true" />
            <span>ชวนทางไลน์</span>
          </Button>
          <Button variant="soft" fullWidth onClick={handleCopy}>
            <Copy className="w-6 h-6" aria-hidden="true" />
            <span>คัดลอกรหัส</span>
          </Button>
          <Button variant="neutral" fullWidth onClick={() => setConfirmChange(true)}>
            <RefreshCw className="w-6 h-6" aria-hidden="true" />
            <span>เปลี่ยนรหัสใหม่</span>
          </Button>
        </div>
      }
    >
      <Card>
        <p className="text-sm font-semibold text-slate-500">ชื่อบ้าน</p>
        <p className="mt-1 text-lg font-bold text-slate-900 break-words">{settings.homeName}</p>

        <div className="mt-6 rounded-2xl bg-purple-50 border border-purple-200 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-purple-800 flex items-center justify-center gap-1.5">
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            รหัสชวน 6 หลัก
          </p>
          <p className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-[0.15em] text-purple-700 whitespace-nowrap select-all">
            {shownCode}
          </p>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={
            message
              ? `mt-4 text-base font-bold ${isError ? 'text-red-700' : 'text-emerald-700'}`
              : 'sr-only'
          }
        >
          {message}
        </p>
      </Card>

      <ConfirmDialog
        open={confirmChange}
        title="เปลี่ยนรหัสใหม่?"
        message="รหัสเก่าจะใช้ไม่ได้ ต้องการเปลี่ยนไหม?"
        confirmLabel="เปลี่ยนรหัส"
        onCancel={() => setConfirmChange(false)}
        onConfirm={handleChangeCode}
      />
    </SettingsSubPage>
  );
};
