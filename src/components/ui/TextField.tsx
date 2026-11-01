import React from 'react';
import { cn } from '../../lib/cn';
import { Field, describedBy, fieldControlClass } from './Field';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  /** องค์ประกอบด้านขวาในช่อง เช่น ปุ่มแสดงรหัสผ่าน */
  trailing?: React.ReactNode;
}

/** ช่องกรอกมาตรฐาน: ป้าย + input แคปซูลสูง 48px */
export const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  trailing,
  className,
  ...props
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error}>
    <div className="relative">
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(fieldControlClass(!!error), trailing && 'pr-14', className)}
        {...props}
      />
      {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
    </div>
  </Field>
);
