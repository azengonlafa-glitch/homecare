import React from 'react';
import { cn } from '../../lib/cn';
import { Field, describedBy, fieldControlClass } from './Field';

interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
}

/** ช่องกรอกข้อความหลายบรรทัด สไตล์เดียวกับ TextField */
export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  className,
  rows = 3,
  ...props
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error}>
    <textarea
      id={id}
      rows={rows}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={cn(fieldControlClass(!!error), 'rounded-2xl sm:rounded-2xl py-3 resize-y', className)}
      {...props}
    />
  </Field>
);
