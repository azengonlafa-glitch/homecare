import React from 'react';
import { cn } from '../../lib/cn';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** องค์ประกอบด้านขวาในช่อง เช่น ปุ่มแสดงรหัสผ่าน */
  trailing?: React.ReactNode;
}

/** ช่องกรอกมาตรฐาน: label + input สูง 48px */
export const TextField: React.FC<TextFieldProps> = ({ id, label, trailing, className, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-800 mb-1.5">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        className={cn(
          'w-full min-h-[48px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-base text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-colors',
          trailing && 'pr-14',
          className
        )}
        {...props}
      />
      {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
    </div>
  </div>
);
