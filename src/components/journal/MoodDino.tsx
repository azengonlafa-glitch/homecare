import React from 'react';
import dinoGreat from '../../assets/mood/dino-great.png';
import dinoMeh from '../../assets/mood/dino-meh.png';
import dinoSick from '../../assets/mood/dino-sick.png';
import type { MoodKey } from '../../data/journalOptions';
import { cn } from '../../lib/cn';

/** ไดโนเสาร์ประจำอารมณ์ (ตัดพื้นหลังแล้ว) */
const DINO: Record<MoodKey, string> = {
  great: dinoGreat,
  complicated: dinoMeh,
  down: dinoSick,
};

/** รูปไดโนเสาร์ตามอารมณ์ ใช้เป็นภาพตกแต่ง (ข้อความอารมณ์อยู่ข้างเคียงเสมอ จึงไม่ซ้ำคำอ่านของโปรแกรมอ่านหน้าจอ) */
export const MoodDino: React.FC<{ mood: MoodKey; className?: string }> = ({ mood, className }) => (
  <img
    src={DINO[mood]}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={cn('object-contain select-none', className)}
  />
);
