import React from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'soft' | 'neutral';
type Size = 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white',
  soft: 'bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-800',
  neutral: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-[48px] px-5 text-base',
  sm: 'min-h-[44px] px-4 text-sm',
};

/** ปุ่มมาตรฐาน: เรียบ ไม่มีเงา สูงอย่างน้อย 44px */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth,
  type = 'button',
  className,
  ...props
}) => (
  <button
    type={type}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-xl font-semibold cursor-pointer transition-colors',
      VARIANTS[variant],
      SIZES[size],
      fullWidth && 'w-full',
      className
    )}
    {...props}
  />
);
