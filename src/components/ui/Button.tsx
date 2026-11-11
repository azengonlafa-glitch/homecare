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
  primary: 'btn-chunky bg-gradient-to-b from-[#1E9A4E] to-[#15703A] hover:from-[#1A8C46] hover:to-[#115C30] text-white [--edge:#0E4A27]',
  soft: 'btn-chunky bg-sun hover:bg-[#FFC83D] text-slate-900 [--edge:#D9A21F]',
  neutral: 'btn-chunky bg-white hover:bg-slate-50 text-slate-900 [--edge:#BFD1BC] ring-1 ring-inset ring-slate-200',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-[54px] sm:min-h-[58px] px-8 text-lg sm:text-xl font-bold rounded-[1.5rem]',
  sm: 'min-h-[48px] px-5 text-base font-semibold rounded-2xl',
};

/** คลาสของปุ่ม แยกออกมาเพื่อใช้กับลิงก์ <a> ที่หน้าตาเหมือนปุ่มได้ */
export const buttonClass = (
  variant: Variant = 'primary',
  size: Size = 'md',
  fullWidth?: boolean,
  className?: string
) =>
  cn(
    'inline-flex items-center justify-center gap-2 cursor-pointer',
    // ปุ่มที่ถูกปิด: จางลง กดไม่ได้ และไม่ยุบตอนกด
    'disabled:opacity-50 disabled:cursor-not-allowed',
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
