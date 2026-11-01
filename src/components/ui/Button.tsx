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
  primary: 'bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white shadow-sm shadow-purple-200',
  soft: 'bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-900 border border-purple-200',
  neutral: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 border border-slate-200',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-[54px] sm:min-h-[58px] px-8 text-lg sm:text-xl font-bold rounded-2xl sm:rounded-full',
  sm: 'min-h-[48px] px-5 text-base font-semibold rounded-xl sm:rounded-2xl',
};

/** คลาสของปุ่ม แยกออกมาเพื่อใช้กับลิงก์ <a> ที่หน้าตาเหมือนปุ่มได้ */
export const buttonClass = (
  variant: Variant = 'primary',
  size: Size = 'md',
  fullWidth?: boolean,
  className?: string
) =>
  cn(
    'inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className
  );

/** ปุ่มมาตรฐาน: ตัวหนังสือชัด ปุ่มสูงอย่างน้อย 48px - 58px */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth,
  type = 'button',
  className,
  ...props
}) => <button type={type} className={buttonClass(variant, size, fullWidth, className)} {...props} />;
