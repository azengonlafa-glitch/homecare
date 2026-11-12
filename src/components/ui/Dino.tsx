import React from 'react';
import cheer from '../../assets/dino/dino-cheer.webp';
import grumpy from '../../assets/dino/dino-grumpy.webp';
import confused from '../../assets/dino/dino-confused.webp';
import cry from '../../assets/dino/dino-cry.webp';
import love from '../../assets/dino/dino-love.webp';
import angry from '../../assets/dino/dino-angry.webp';
import tired from '../../assets/dino/dino-tired.webp';
import shock from '../../assets/dino/dino-shock.webp';
import sleep from '../../assets/dino/dino-sleep.webp';
import wink from '../../assets/dino/dino-wink.webp';
import worried from '../../assets/dino/dino-worried.webp';
import peek from '../../assets/dino/dino-peek.webp';
import { cn } from '../../lib/cn';

/**
 * ไดโนเสาร์ประจำแอป 12 ท่า (ตัดจากแผ่นสติกเกอร์ พื้นโปร่งใส) ใช้แทนตัวการ์ตูนเก่าและตกแต่งแต่ละหน้า
 *
 * เลือกท่าให้เข้ากับสถานการณ์:
 * - cheer ดีใจ: ชวนเริ่มทำ / ทุกอย่างเรียบร้อย    - wink ขยิบตายกนิ้ว: ทำสำเร็จ / ชวนเพิ่มของชิ้นแรก
 * - sleep หลับ: ยังว่าง ยังไม่มีข้อมูล            - peek แอบมอง: ซ่อนอยู่ / ไม่มีสิทธิ์ / ว่างเปล่า
 * - confused งง: ไม่พบ / ไม่แน่ใจ                  - love กอดหัวใจ: ครอบครัว / ขอบคุณ
 * - worried กังวล: ยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้  - cry ร้องไห้: ระบบขัดข้อง
 * - shock ตกใจ / angry โมโห / grumpy หงุดหงิด / tired เหนื่อย: สำรองไว้
 *
 * เป็นของตกแต่งล้วน (ซ่อนจากโปรแกรมอ่านหน้าจอ ข้อความอธิบายต้องอยู่ข้างเคียงเสมอ)
 * ห้ามวางบนข้อความเตือนเรื่องยาหรือเรื่องด่วนทางการแพทย์
 */
export type DinoPose =
  | 'cheer'
  | 'grumpy'
  | 'confused'
  | 'cry'
  | 'love'
  | 'angry'
  | 'tired'
  | 'shock'
  | 'sleep'
  | 'wink'
  | 'worried'
  | 'peek';

const SRC: Record<DinoPose, string> = { cheer, grumpy, confused, cry, love, angry, tired, shock, sleep, wink, worried, peek };

export const DINO_POSES = Object.keys(SRC) as DinoPose[];

interface DinoProps {
  pose: DinoPose;
  /** ขนาดด้วย className เช่น "h-24 w-28" (รูปจัดให้พอดีกรอบโดยไม่บิดสัดส่วน) */
  className?: string;
  /** โยกขึ้นลงเบา ๆ และขยายเมื่อเอาเมาส์ชี้ (ปิดเองเมื่อผู้ใช้ตั้ง "ลดการเคลื่อนไหว") */
  bob?: boolean;
}

export const Dino: React.FC<DinoProps> = ({ pose, className, bob = false }) => (
  <img
    src={SRC[pose]}
    alt=""
    aria-hidden="true"
    draggable={false}
    decoding="async"
    className={cn('object-contain select-none', bob && 'dino-bob', className)}
  />
);
