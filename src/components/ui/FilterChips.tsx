import React from 'react';
import { cn } from '../../lib/cn';

export interface ChipOption {
  id: string;
  label: string;
}

interface FilterChipsProps {
  options: ChipOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}

/** แถบตัวกรองแบบ chip เลื่อนแนวนอนได้บนมือถือ */
export const FilterChips: React.FC<FilterChipsProps> = ({ options, value, onChange, ariaLabel }) => (
  <div
    role="group"
    aria-label={ariaLabel}
    className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 py-1 scrollbar-none"
  >
    {options.map((option) => {
      const isSelected = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          aria-pressed={isSelected}
          onClick={() => onChange(option.id)}
          className={cn(
            'min-h-[48px] px-5 rounded-xl text-base font-semibold whitespace-nowrap cursor-pointer transition-colors',
            isSelected
              ? 'seg-on text-white'
              : 'bg-white/85 text-slate-700 border border-slate-200 hover:bg-white'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
