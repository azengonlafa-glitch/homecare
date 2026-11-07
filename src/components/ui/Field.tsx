import React from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  id: string;
  label: string;
  /** ข้อความต่อท้ายป้าย เช่น "(ไม่บังคับ)" "(จำเป็น)" */
  labelSuffix?: string;
  /** คำอธิบายใต้ป้าย */
  hint?: string;
  error?: string;
  /** ซ่อนป้ายจากสายตา (ยังอ่านได้ด้วย screen reader) เช่น ช่องวัน/เดือน/ปีที่มีป้ายรวม */
  hideLabel?: boolean;
  children: React.ReactNode;
}

/** กรอบมาตรฐานของทุกช่องกรอก: ป้าย + คำอธิบาย + ช่อง + ข้อความผิดพลาด ขนาดอ่านง่าย */
export const Field: React.FC<FieldProps> = ({ id, label, labelSuffix, hint, error, hideLabel, children }) => (
  <div className="space-y-2">
    <label
      htmlFor={id}
      className={cn('block text-base sm:text-lg font-bold text-slate-900', hideLabel && 'sr-only')}
    >
      {label}
      {labelSuffix && <span className="font-normal text-slate-500"> {labelSuffix}</span>}
    </label>
    {hint && (
      <p id={`${id}-hint`} className="text-sm sm:text-base text-slate-600 leading-snug">
        {hint}
      </p>
    )}
    {children}
    {error && (
      <p id={`${id}-error`} role="alert" className="mt-1.5 text-base font-semibold text-red-700">
        {error}
      </p>
    )}
  </div>
);

export const describedBy = (id: string, hint?: string, error?: string) =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

/** สไตล์ช่องกรอกแบบแคปซูล ขนาดใหญ่ขึ้น เต็มตา สัมผัสง่าย */
export const fieldControlClass = (hasError?: boolean) =>
  cn(
    'w-full min-h-[54px] sm:min-h-[58px] px-6 py-3 bg-white border rounded-2xl sm:rounded-full text-lg text-slate-900 placeholder-slate-500',
    'focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition shadow-xs',
    hasError ? 'border-red-500' : 'border-slate-300'
  );
