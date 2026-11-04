import React, { useRef } from 'react';
import { cn } from '../../lib/cn';
import { Field, describedBy, fieldControlClass } from './Field';
import {
  SuggestionList,
  setNativeInputValue,
  useSuggestions,
  type SuggestionItem,
} from './Suggestions';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  /** องค์ประกอบด้านขวาในช่อง เช่น ปุ่มแสดงรหัสผ่าน */
  trailing?: React.ReactNode;
  /** คำแนะนำที่ขึ้นใต้ช่องเมื่อพิมพ์ กดเลือกแล้วแทนคำที่พิมพ์ */
  suggestions?: SuggestionItem[];
  /** list = พิมพ์หลายคำคั่นด้วยจุลภาค แนะนำเฉพาะคำสุดท้าย */
  suggestMode?: 'replace' | 'list';
}

/** ช่องกรอกมาตรฐาน: ป้าย + input แคปซูลสูง 48px (ใส่ suggestions เพื่อให้มีคำแนะนำขณะพิมพ์) */
export const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  hideLabel,
  trailing,
  className,
  suggestions,
  suggestMode = 'replace',
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const sg = useSuggestions(suggestions, String(props.value ?? ''), suggestMode);
  const open = sg.results.length > 0;

  const pick = (picked: string) => {
    if (inputRef.current) setNativeInputValue(inputRef.current, sg.apply(picked));
    sg.setActive(-1);
    sg.close();
  };

  return (
    <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error} hideLabel={hideLabel}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          aria-autocomplete={suggestions ? 'list' : undefined}
          aria-controls={open ? `${id}-suggestions` : undefined}
          aria-expanded={suggestions ? open : undefined}
          autoComplete={suggestions ? 'off' : undefined}
          className={cn(fieldControlClass(!!error), trailing && 'pr-14', className)}
          {...props}
          onFocus={(e) => {
            sg.onFocus();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            sg.onBlur();
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (open) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                sg.setActive((sg.active + step + sg.results.length) % sg.results.length);
              } else if (e.key === 'Enter' && sg.active >= 0) {
                e.preventDefault(); // เลือกคำแนะนำ ไม่ส่งฟอร์ม
                pick(sg.results[sg.active].value);
              } else if (e.key === 'Escape') {
                e.stopPropagation(); // ปิดแค่กล่องคำแนะนำ ไม่ปิดหน้าต่างทั้งหน้า
                sg.close();
              }
            }
            onKeyDown?.(e);
          }}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
        {open && <SuggestionList id={id} items={sg.results} active={sg.active} onPick={pick} />}
      </div>
    </Field>
  );
};
