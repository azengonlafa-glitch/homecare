import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/cn';

/** แสดงดาวตามคะแนน (ปัดเป็นดาวเต็ม) ใช้ aria-label แทนการอ่านทีละดาว */
export const StarsDisplay: React.FC<{ value: number; className?: string; size?: 'sm' | 'md' }> = ({ value, className, size = 'md' }) => {
  const rounded = Math.round(value);
  return (
    <span role="img" aria-label={`${value.toFixed(1)} จาก 5 ดาว`} className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5', n <= rounded ? 'fill-amber-400 text-amber-500' : 'fill-slate-100 text-slate-300')} />
      ))}
    </span>
  );
};

/** เลือกดาว 1-5 ปุ่มใหญ่พอแตะง่าย อ่านออกเสียงได้ว่าเลือกกี่ดาว */
export const StarInput: React.FC<{ value: number; onChange: (v: number) => void; label?: string }> = ({ value, onChange, label = 'ให้คะแนน' }) => (
  <div role="radiogroup" aria-label={label} className="flex gap-1">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        role="radio"
        aria-checked={value === n}
        aria-label={`${n} ดาว`}
        onClick={() => onChange(n)}
        className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600"
      >
        <Star aria-hidden="true" className={cn('w-8 h-8 transition-colors', n <= value ? 'fill-amber-400 text-amber-500' : 'fill-white text-slate-400')} />
      </button>
    ))}
  </div>
);
