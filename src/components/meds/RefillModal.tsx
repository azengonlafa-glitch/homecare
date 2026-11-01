import React from 'react';
import { Copy, ExternalLink, Phone } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button, buttonClass } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { PHARMACY } from '../../lib/config';
import { copyToClipboard } from '../../lib/clipboard';
import { daysLeft, formatQty, instructionText, type Medication } from '../../lib/meds';

interface RefillModalProps {
  med: Medication | null;
  homeName: string;
  onMarkRequested: (med: Medication) => void;
  onClose: () => void;
}

/** ขอเติมยา: สร้างข้อความพร้อมส่งให้ร้านยา คัดลอก เปิดไลน์ หรือโทร แล้วกดบันทึกว่าขอแล้ว (ต้นแบบ ยังไม่ส่งออเดอร์จริง) */
export const RefillModal: React.FC<RefillModalProps> = ({ med, homeName, onMarkRequested, onClose }) => {
  const toast = useToast();
  if (!med) return null;

  const days = daysLeft(med);
  const message = [
    `สวัสดีค่ะ ขอเติมยา ${med.name}`,
    `วิธีกิน: ${instructionText(med)}`,
    `ตอนนี้เหลือ ${formatQty(med.remaining)} ${med.unit}${days !== null ? ` (พอกินอีกประมาณ ${days} วัน)` : ''}`,
    `จากบ้าน ${homeName}`,
  ].join('\n');

  const copy = async () => {
    const ok = await copyToClipboard(message);
    toast.show(ok ? 'คัดลอกข้อความแล้ว' : 'คัดลอกไม่ได้ กรุณากดค้างที่ข้อความเพื่อคัดลอกเอง', {
      tone: ok ? undefined : 'error',
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`ขอเติมยา ${med.name}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ปิด
          </Button>
          <Button
            fullWidth
            onClick={() => {
              onMarkRequested(med);
              onClose();
            }}
          >
            บันทึกว่าขอแล้ว
          </Button>
        </div>
      }
    >
      <div className="py-6 space-y-5">
        <p className="text-base text-slate-700">
          ส่งข้อความนี้ให้ <strong>{PHARMACY.name}</strong> ทางไลน์หรือโทรบอกเภสัชกรได้เลย
        </p>

        <pre
          tabIndex={0}
          aria-label="ข้อความขอเติมยา"
          className="whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base text-slate-900 font-sans"
        >
          {message}
        </pre>

        <div className="space-y-3">
          <Button variant="soft" fullWidth onClick={copy}>
            <Copy className="w-5 h-5" aria-hidden="true" />
            <span>คัดลอกข้อความ</span>
          </Button>
          <a
            href={PHARMACY.lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('primary', 'sm', true)}
          >
            <ExternalLink className="w-5 h-5" aria-hidden="true" />
            <span>เปิดไลน์ร้านยา ({PHARMACY.lineLabel})</span>
          </a>
          <a href={PHARMACY.phoneHref} className={buttonClass('neutral', 'sm', true)}>
            <Phone className="w-5 h-5" aria-hidden="true" />
            <span>โทร {PHARMACY.phoneLabel}</span>
          </a>
        </div>
        <p className="text-sm text-slate-500">ข้อมูลร้านยาเป็นข้อมูลสมมติของต้นแบบ</p>
      </div>
    </Modal>
  );
};
