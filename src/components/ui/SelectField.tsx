import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, fieldControlClass } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  name?: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Custom Dropdown สไตล์คลีน ตามรูปอ้างอิง:
 * - กล่องเมนูสีขาว ขอบมนโค้งเนียนตา (rounded-2xl) พร้อมเงาละมุน
 * - แถวตัวเลือกมีระยะขอบมน ไฮไลท์สีม่วง/ฟ้าอ่อนจางๆ สบายตา
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  name,
  label,
  labelSuffix,
  hint,
  error,
  options,
  placeholder,
  value,
  onChange,
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // หา label ของตัวเลือกปัจจุบัน
  const selectedOption = options.find((opt) => opt.value === value);

  // ปิดเมนูเมื่อคลิกนอกพื้นที่ หรือกดปุ่ม Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error}>
      <div ref={containerRef} className="relative">
        {name && <input type="hidden" name={name} value={value} />}

        {/* ช่องกดเลือก (Trigger) */}
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn(
            fieldControlClass(!!error),
            'w-full flex items-center justify-between text-left cursor-pointer transition-all',
            isOpen && 'ring-2 ring-purple-600 border-transparent',
            disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
            className
          )}
        >
          <span className={cn('truncate text-base sm:text-lg', !selectedOption && 'text-slate-400')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              'w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180 text-purple-700'
            )}
            aria-hidden="true"
          />
        </button>

        {/* เมนูลอยสไตล์คลีน (ตรงตามรูปที่สอง) */}
        {isOpen && (
          <div
            role="listbox"
            tabIndex={-1}
            className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-purple-900/10 p-1.5 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 my-0.5 rounded-xl text-base sm:text-lg font-medium cursor-pointer transition-all',
                    isSelected
                      ? 'bg-purple-100/70 text-purple-950 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="w-5 h-5 text-purple-700 shrink-0 ml-2" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Field>
  );
};
