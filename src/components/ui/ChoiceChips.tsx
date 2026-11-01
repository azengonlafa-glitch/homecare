import React from 'react';
import { cn } from '../../lib/cn';

export interface ChipOption {
  value: string;
  label: string;
}

/** ปุ่ม chip เดี่ยว ใช้ร่วมกันในทุกกลุ่มตัวเลือก */
export const Chip: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ selected, onClick, children, disabled }) => (
  <button
    type="button"
    aria-pressed={selected}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'min-h-[48px] px-5 rounded-full text-base font-semibold border transition-all cursor-pointer',
      selected
        ? 'bg-purple-700 border-purple-700 text-white shadow-xs'
        : 'bg-white border-slate-300 text-slate-800 hover:bg-purple-50 hover:border-purple-300',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    {children}
  </button>
);

interface FieldGroupProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/** กลุ่มตัวเลือก (fieldset + legend) สำหรับ chip ที่ไม่มี input เดี่ยวให้ผูก label */
export const FieldGroup: React.FC<FieldGroupProps> = ({ label, hint, error, children }) => (
  <fieldset className="space-y-2 min-w-0">
    <legend className="text-base sm:text-lg font-bold text-slate-900 mb-2">{label}</legend>
    {hint && <p className="text-sm sm:text-base text-slate-600 leading-snug">{hint}</p>}
    {children}
    {error && (
      <p role="alert" className="text-base font-semibold text-red-700">
        {error}
      </p>
    )}
  </fieldset>
);

interface SingleChoiceProps {
  label: string;
  hint?: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  /** ข้อความ placeholder ในช่องพิมพ์เมื่อเลือก "อื่น ๆ" */
  customPlaceholder?: string;
}

/**
 * เลือกได้ 1 ตัวเลือก กดซ้ำเพื่อยกเลิกการเลือก
 * หากเลือก "อื่น ๆ" จะมีช่องพิมพ์ข้อความระบุเพิ่มเติมขึ้นมาให้อัตโนมัติ
 */
export const SingleChoiceChips: React.FC<SingleChoiceProps> = ({
  label,
  hint,
  options,
  value,
  onChange,
  customPlaceholder = 'พิมพ์ระบุเพิ่มเติม...',
}) => {
  // หาตัวเลือกที่มีคำว่า "อื่น"
  const otherOption = options.find(
    (o) => o.value === 'อื่น ๆ' || o.value === 'อื่นๆ' || o.label.includes('อื่น')
  );

  // เช็คว่าค่าปัจจุบันเป็น preset อื่นที่ไม่ใช่ "อื่น ๆ"
  const isPresetNonOther = options.some((o) => o.value === value && o.value !== otherOption?.value);

  // ตรวจสอบว่าเลือก "อื่น ๆ" อยู่หรือไม่ (รวมถึงกรณีที่มีการพิมพ์ custom text ไว้แล้ว)
  const isOtherSelected =
    !isPresetNonOther && (value === otherOption?.value || (Boolean(value) && otherOption !== undefined));

  // ดึงข้อความที่พิมพ์ไว้ในช่อง custom (ถ้ามี)
  const customText = isOtherSelected && value !== otherOption?.value ? value : '';

  const handleChipClick = (optionValue: string) => {
    if (otherOption && optionValue === otherOption.value) {
      if (isOtherSelected) {
        onChange('');
      } else {
        onChange(otherOption.value);
      }
    } else {
      onChange(value === optionValue ? '' : optionValue);
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text || (otherOption ? otherOption.value : 'อื่น ๆ'));
  };

  return (
    <FieldGroup label={label} hint={hint}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option.value === otherOption?.value ? isOtherSelected : value === option.value;

          return (
            <Chip key={option.value} selected={isSelected} onClick={() => handleChipClick(option.value)}>
              {option.label}
            </Chip>
          );
        })}
      </div>

      {/* เมื่อเลือก "อื่น ๆ" ให้แสดงช่องพิมพ์ระบุข้อมูลทันที */}
      {isOtherSelected && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <input
            type="text"
            value={customText}
            onChange={handleCustomChange}
            placeholder={customPlaceholder}
            autoFocus
            className="w-full min-h-[50px] sm:min-h-[54px] px-5 sm:px-6 py-2.5 bg-white border border-purple-300 rounded-2xl sm:rounded-full text-base sm:text-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all shadow-xs"
          />
        </div>
      )}
    </FieldGroup>
  );
};
