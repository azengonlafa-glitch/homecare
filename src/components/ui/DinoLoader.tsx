import React from 'react';
import { cn } from '../../lib/cn';

interface DinoLoaderProps {
  label?: string;
  className?: string;
}

/** ควันแต่ละก้อน: ลอยไปทางซ้าย/ขึ้น (หน่วย em ของตัวไดโนเสาร์) ขยายตัวแล้วจางหาย */
const PUFFS = [
  { x: -9, y: -3, s: 2.4, delay: 0.0 },
  { x: -15, y: -7, s: 2.8, delay: 0.25 },
  { x: -21, y: -2, s: 3.0, delay: 0.5 },
  { x: -26, y: -9, s: 3.2, delay: 0.75 },
  { x: -32, y: -4.5, s: 3.4, delay: 1.0 },
  { x: -12, y: -11, s: 2.6, delay: 1.25 },
  { x: -38, y: -8, s: 3.6, delay: 1.5 },
  { x: -19, y: -13, s: 2.9, delay: 1.75 },
  { x: -44, y: -3, s: 3.8, delay: 2.0 },
  { x: -30, y: -13, s: 3.3, delay: 2.25 },
];

/** เส้นลมที่พุ่งผ่าน (ตำแหน่งบน %, ความยาว %, ความเร็ว s, หน่วงเวลา s) */
const STREAKS = [
  { top: 32, width: 22, dur: 1.1, delay: 0.2 },
  { top: 46, width: 30, dur: 0.9, delay: 0.6 },
  { top: 56, width: 18, dur: 1.3, delay: 0.1 },
  { top: 66, width: 26, dur: 1.0, delay: 0.8 },
];

/**
 * หน้าโหลด: ไดโนเสาร์ขี่สกู๊ตเตอร์ส่งยาผ่านสวนธรรมชาติ ฉากเลื่อนและเบลอตามแนวที่รถวิ่ง (ยิ่งใกล้ยิ่งเร็ว)
 * มีควันออกท่อและคำว่า growa ลอยบนท้องฟ้า สไตล์เดียวกับหน้าเปิดแอปใน index.html
 * ถ้าผู้ใช้ตั้ง "ลดการเคลื่อนไหว" ไว้ ฉากและควันจะนิ่ง (ดู index.css)
 */
export const DinoLoader: React.FC<DinoLoaderProps> = ({ label = 'กำลังโหลด', className }) => (
  <div role="status" aria-live="polite" className={cn('dino-loader', className)}>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="dl-mb1" x="-5%" y="-10%" width="110%" height="120%">
        <feGaussianBlur stdDeviation="2.5 0" />
      </filter>
      <filter id="dl-mb2" x="-5%" y="-10%" width="110%" height="120%">
        <feGaussianBlur stdDeviation="8 1" />
      </filter>
      <filter id="dl-mb3" x="-5%" y="-10%" width="110%" height="120%">
        <feGaussianBlur stdDeviation="20 2" />
      </filter>
    </svg>

    <div aria-hidden="true" className="dl-scene">
      <div className="dl-layer dl-far" />
      <div className="dl-layer dl-mid" />
      <div className="dl-word">growa</div>
      <div className="dl-layer dl-near" />
      {STREAKS.map((st, i) => (
        <i
          key={i}
          className="dl-streak"
          style={{ top: `${st.top}%`, width: `${st.width}%`, animationDuration: `${st.dur}s`, animationDelay: `-${st.delay}s` }}
        />
      ))}
    </div>

    <div aria-hidden="true" className="dl-rider">
      <span className="dl-puffs">
        {PUFFS.map((p, i) => (
          <i
            key={i}
            className="dl-puff"
            style={{ '--x': p.x, '--y': p.y, '--s': p.s, animationDelay: `${p.delay}s` } as React.CSSProperties}
          />
        ))}
      </span>
      <img src="/images/loader/dino-scooter.png" alt="" draggable={false} className="dl-dino" />
    </div>

    <p className="dl-label">
      {label}
      <span aria-hidden="true" className="dl-dots">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  </div>
);
