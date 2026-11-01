import React from 'react';
import { cn } from '../../lib/cn';

interface SwitchRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** แถวสวิตช์เปิด/ปิดทั้งแถวกดได้ กดง่ายด้วยนิ้วเดียว (สูงกว่าขั้นต่ำ 48px) */
export const SwitchRow: React.FC<SwitchRowProps> = ({ label, description, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-4 min-h-[72px] px-1 py-4 text-left cursor-pointer rounded-2xl hover:bg-slate-50 transition-colors"
  >
    <span className="min-w-0">
      <span className="block text-base sm:text-lg font-bold text-slate-900 break-words">{label}</span>
      <span className="block mt-1 text-sm text-slate-600 leading-snug break-words">{description}</span>
    </span>

    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 w-[62px] h-[36px] rounded-full transition-colors',
        checked ? 'bg-purple-700' : 'bg-slate-300'
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] left-[3px] w-[30px] h-[30px] rounded-full bg-white shadow-sm transition-transform',
          checked && 'translate-x-[26px]'
        )}
      />
    </span>
  </button>
);
