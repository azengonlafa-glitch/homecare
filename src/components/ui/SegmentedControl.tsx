import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** ใช้เป็น name ของกลุ่ม radio ต้องไม่ซ้ำกันในหน้า */
  name: string;
  /** คำอธิบายกลุ่มสำหรับ screen reader เช่น "สิทธิ์ของน้องมิ้นท์" */
  legend: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * ตัวเลือกแบบแบ่งช่อง เลือกได้ 1 อย่าง (ตัวที่เลือกมีเครื่องหมายถูกและพื้นเข้ม ไม่ใช้สีอย่างเดียว)
 * ใช้ radio จริง จึงสลับด้วยปุ่มลูกศรบนคีย์บอร์ดได้
 */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-[48px] cursor-pointer items-center justify-center gap-1 rounded-xl px-1 text-center text-base font-bold transition-colors',
                'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-purple-600',
                selected ? 'bg-purple-700 text-white' : 'text-slate-700 hover:bg-white'
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {selected && <Check className="h-5 w-5 shrink-0" aria-hidden="true" />}
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
