import React, { useState } from 'react';
import { ListPlus, X } from 'lucide-react';
import { OptionPickerModal } from './OptionPickerModal';
import { Button } from './Button';
import { FieldGroup } from './ChoiceChips';

interface ConditionPickerProps {
  id: string;
  label: string;
  hint?: string;
  /** รายการให้เลือกทั้งหมด (เรียงแล้ว) */
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  /** ชื่อหน้าต่างเลือก */
  modalTitle: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

/**
 * เลือกจากรายการยาว: กดปุ่มเปิดหน้าต่าง ค้นหา ติ๊กหลายรายการ แล้วกดบันทึก
 * ถ้าไม่มีในรายการ พิมพ์เพิ่มเองได้ท้ายรายการ
 */
export const ConditionPicker: React.FC<ConditionPickerProps> = ({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  modalTitle,
  searchPlaceholder = 'ค้นหาโรคหรือภาวะ',
  disabled,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <FieldGroup label={label} hint={hint}>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label} ที่เลือกไว้`}>
          {value.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 pl-4 pr-1 min-h-[44px] rounded-full bg-purple-100 text-purple-900 text-base font-semibold"
            >
              <span>{item}</span>
              <button
                type="button"
                disabled={disabled}
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

      <Button
        id={id}
        type="button"
        variant="soft"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <ListPlus className="w-5 h-5" aria-hidden="true" />
        <span>{value.length > 0 ? 'เพิ่มหรือแก้ไขรายการ' : 'เลือกจากรายการ'}</span>
      </Button>

      <OptionPickerModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        options={options}
        value={value}
        onSave={(next) => {
          onChange(next);
          setOpen(false);
        }}
        searchPlaceholder={searchPlaceholder}
        customHeading="ไม่มีในรายการ? พิมพ์เพิ่มเอง"
        customPlaceholder="พิมพ์ชื่อโรคหรือภาวะอื่น ๆ"
      />
    </FieldGroup>
  );
};
