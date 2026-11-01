import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** รวมคลาส Tailwind และแก้คลาสที่ชนกัน (ตัวหลังชนะ) */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
