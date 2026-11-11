import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '../../lib/cn';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** danger = ปุ่มยืนยันสีแดง (ค่าเริ่มต้น) */
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}

const confirmClass = (tone: 'danger' | 'primary') =>
  cn(
    'btn-chunky w-full inline-flex items-center justify-center min-h-[54px] px-4 rounded-[1.5rem] text-base sm:text-lg font-bold leading-tight text-center text-white cursor-pointer',
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 [--edge:#7F1D1D]'
      : 'bg-purple-700 hover:bg-purple-800 [--edge:#0E4A27]'
  );

/**
 * กล่องยืนยันสำหรับงานที่ย้อนกลับไม่ได้: ปุ่ม "ยกเลิก" (สีกลาง) คู่กับปุ่มยืนยัน (สีแดง/ม่วง)
 * อยู่ท้ายกล่องเพื่อกดด้วยมือเดียวได้ถนัด
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  tone = 'danger',
  onCancel,
  onConfirm,
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    initialFocusSelector="[data-confirm-cancel]"
    footer={
      <div className="grid grid-cols-2 gap-3">
        <Button variant="neutral" fullWidth data-confirm-cancel="true" onClick={onCancel}>
          ยกเลิก
        </Button>
        <button type="button" className={confirmClass(tone)} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    }
  >
    <p className="py-5 text-base sm:text-lg leading-relaxed text-slate-700 break-words">{message}</p>
  </Modal>
);
