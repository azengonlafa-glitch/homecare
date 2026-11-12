import React from 'react';
import { cn } from '../../lib/cn';

interface GrowaLogoProps {
  className?: string;
  /** ใส่ alt เมื่อโลโก้เป็นสิ่งเดียวที่บอกชื่อแอป ปล่อยว่างเมื่อมีชื่อแอปเป็นข้อความอยู่ข้าง ๆ แล้ว */
  alt?: string;
}

/** โลโก้ Growa (แอปเปิ้ลตัวอักษร) พื้นโปร่งใส จุดเดียวที่ใช้ในทุกหน้า ใส่ขนาดด้วย className เช่น h-12 w-12 */
export const GrowaLogo: React.FC<GrowaLogoProps> = ({ className, alt = '' }) => (
  <img
    src="/images/brand/growa-logo.png"
    alt={alt}
    aria-hidden={alt ? undefined : true}
    width={640}
    height={640}
    decoding="async"
    draggable={false}
    className={cn('select-none object-contain', className)}
  />
);
