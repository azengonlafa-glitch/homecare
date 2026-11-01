import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, describedBy, fieldControlClass } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

/** Dropdown แบบเลือกค่าเดียว ใช้ <select> ของเบราว์เซอร์ (ใช้ได้ดีบนมือถือ) หน้าตาแคปซูล */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  options,
  placeholder,
  value,
  onChange,
  className,
  ...props
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error}>
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(
          fieldControlClass(!!error),
          'appearance-none pr-12 cursor-pointer',
          value === '' && 'text-slate-500',
          className
        )}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-slate-900">
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
