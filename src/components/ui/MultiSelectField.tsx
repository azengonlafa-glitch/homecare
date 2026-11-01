import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, describedBy, fieldControlClass } from './Field';
import type { SelectOption } from './SelectField';

interface MultiSelectFieldProps {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder: string;
  value: string[];
  onChange: (value: string[]) => void;
}

/** Dropdown แบบเลือกได้หลายค่า (ติ๊กถูก) หน้าตาแคปซูลเหมือนช่องอื่น */
export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  options,
  placeholder,
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // ปิดเมื่อคลิกนอกกล่องหรือกด Esc
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = (optionValue: string) => {
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  };

  const summary = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label)
    .join(', ');

  return (
    <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error}>
      <div ref={rootRef} className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-describedby={describedBy(id, hint, error)}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            fieldControlClass(!!error),
            'relative text-left pr-12 truncate cursor-pointer',
            summary === '' && 'text-slate-500'
          )}
        >
          {summary || placeholder}
          <ChevronDown
            className={cn(
              'w-5 h-5 text-slate-500 absolute right-5 top-1/2 -translate-y-1/2 transition-transform',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="absolute z-20 left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl p-2"
          >
            {options.map((option) => {
              const checked = value.includes(option.value);
              return (
                <li key={option.value} role="option" aria-selected={checked}>
                  <label className="flex items-center gap-3 min-h-[44px] px-3 rounded-xl cursor-pointer hover:bg-purple-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(option.value)}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-base text-slate-800">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Field>
  );
};
