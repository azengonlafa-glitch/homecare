import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SavedNoteProps {
  show: boolean;
  /** ข้อความที่ประกาศให้ผู้ใช้และ screen reader ทราบ */
  children?: string;
}

/** ข้อความยืนยันหลังบันทึก (อ่านออกเสียงด้วย aria-live) */
export const SavedNote: React.FC<SavedNoteProps> = ({ show, children = 'บันทึกแล้ว' }) => (
  <p
    role="status"
    aria-live="polite"
    className={cn('flex items-center gap-2 text-base font-bold text-emerald-700', !show && 'sr-only')}
  >
    {show ? (
      <>
        <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </>
    ) : (
      ''
    )}
  </p>
);
