import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Chip, FieldGroup, type ChipOption } from './ChoiceChips';
import { Button } from './Button';
import { fieldControlClass } from './Field';

interface ChipsWithCustomProps {
  id: string;
  label: string;
  hint?: string;
  /** ตัวเลือกสำเร็จรูป (ว่างได้ = มีแค่ช่องพิมพ์เพิ่ม) */
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  customPlaceholder: string;
  /** ข้อความช่วยใต้ช่องพิมพ์ */
  footer?: string;
  disabled?: boolean;
}

/** เลือกได้หลายตัวเลือก + พิมพ์เพิ่มเอง รายการที่พิมพ์เองแสดงเป็นแท็กที่ลบได้ */
export const ChipsWithCustom: React.FC<ChipsWithCustomProps> = ({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  customPlaceholder,
  footer,
  disabled,
}) => {
  const [draft, setDraft] = useState('');
  const presetValues = options.map((o) => o.value);
  const customItems = value.filter((v) => !presetValues.includes(v));

  const toggle = (optionValue: string) =>
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);

  const addDraft = () => {
    const text = draft.trim();
    if (!text) return;
    if (!value.includes(text)) onChange([...value, text]);
    setDraft('');
  };

  return (
    <FieldGroup label={label} hint={hint}>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Chip
              key={option.value}
              selected={value.includes(option.value)}
              disabled={disabled}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      )}

      {customItems.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label} ที่เพิ่มเอง`}>
          {customItems.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 pl-4 pr-1 min-h-[44px] rounded-full bg-purple-100 text-purple-900 text-base font-semibold"
            >
              <span className="break-all">{item}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== item))}
                aria-label={`ลบ ${item}`}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-purple-200 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          autoComplete="off"
          aria-label={`${label}: พิมพ์เพิ่มเอง`}
          placeholder={customPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // ไม่ให้ Enter ส่งฟอร์มทั้งหน้า
              addDraft();
            }
          }}
          className={fieldControlClass(false)}
        />
        <Button
          type="button"
          variant="soft"
          size="sm"
          onClick={addDraft}
          disabled={disabled}
          className="shrink-0"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          <span>เพิ่ม</span>
        </Button>
      </div>
      {footer && <p className="text-sm text-slate-600">{footer}</p>}
    </FieldGroup>
  );
};
