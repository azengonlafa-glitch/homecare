import React from 'react';
import { cn } from '../../lib/cn';

interface CheckboxFieldProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  /** แสดงเป็นกล่องไฮไลต์ (ใช้กับข้อความยินยอม) */
  boxed?: boolean;
  error?: string;
}

/** ช่องติ๊กขนาดใหญ่ พื้นที่กดทั้งแถว */
export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  id,
  checked,
  onChange,
  children,
  boxed,
  error,
}) => (
  <div>
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-3 cursor-pointer select-none min-h-[48px]',
        boxed && 'rounded-2xl bg-purple-50 border border-purple-200 p-4 sm:p-5',
        error && 'border-red-500'
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-0.5 w-6 h-6 shrink-0 rounded-md border-slate-400 text-purple-700 focus:ring-purple-600 focus:ring-offset-0 cursor-pointer"
      />
      <span className="text-base sm:text-lg text-slate-900 leading-snug">{children}</span>
    </label>
    {error && (
      <p id={`${id}-error`} role="alert" className="mt-1.5 text-base font-semibold text-red-700">
        {error}
      </p>
    )}
  </div>
);
