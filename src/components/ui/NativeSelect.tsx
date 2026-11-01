import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, describedBy, fieldControlClass } from './Field';

interface NativeSelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string) => void;
}

/**
 * Dropdown แบบ <select> ของเบราว์เซอร์ ใช้ในหน้าต่างฟอร์มที่เลื่อนได้
 * (เมนูของ SelectField แบบกำหนดเองจะถูกตัดขอบเมื่ออยู่ในพื้นที่เลื่อน)
 */
export const NativeSelect: React.FC<NativeSelectProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  hideLabel,
  options,
  value,
  onChange,
  className,
  ...props
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error} hideLabel={hideLabel}>
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(fieldControlClass(!!error), 'appearance-none pr-12 cursor-pointer', className)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="w-5 h-5 text-slate-500 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  </Field>
);
