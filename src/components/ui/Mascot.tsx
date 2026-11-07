import React, { useId } from 'react';
import { cn } from '../../lib/cn';

/**
 * ตัวการ์ตูนตกแต่งของ Growa: รูปทรงนุ่ม ๆ สีพาสเทล หน้ายิ้ม แก้มชมพู
 * เป็นของตกแต่งล้วน ไม่ผูกกับเมนูใด (ซ่อนจากโปรแกรมอ่านหน้าจอ) ห้ามวางบนข้อความเตือนเรื่องยาหรือเรื่องด่วน
 */
export type MascotKind = 'heart' | 'burst' | 'cloud' | 'ball' | 'tri' | 'mound' | 'sun';
export type MascotMood = 'happy' | 'wink' | 'sleepy' | 'calm' | 'sad';

export const MASCOT_KINDS: MascotKind[] = ['burst', 'cloud', 'heart', 'ball', 'tri', 'mound', 'sun'];

const INK = '#2B2547';
const CHEEK = '#FF8FA8';

const COLORS: Record<MascotKind, [string, string]> = {
  heart: ['#FFC2D4', '#F98FB0'],
  burst: ['#FFD24D', '#FFAD2E'],
  cloud: ['#C4BFFF', '#918CF2'],
  ball: ['#8FEBD6', '#55D0B6'],
  tri: ['#A3CFFF', '#669FF5'],
  mound: ['#FFA998', '#F97C6E'],
  sun: ['#FFE670', '#FFC93C'],
};

const Face: React.FC<{ cx: number; cy: number; mood: MascotMood; gap?: number }> = ({ cx, cy, mood, gap = 12 }) => {
  const left = cx - gap;
  const right = cx + gap;
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' };
  const openEye = (x: number) => (
    <g className="mascot-eye">
      <ellipse cx={x} cy={cy} rx="3.8" ry="4.8" fill={INK} />
      <circle cx={x + 1.2} cy={cy - 1.8} r="1.3" fill="#FFFFFF" />
    </g>
  );
  const closedEye = (x: number) => <path d={`M${x - 5} ${cy + 1}q5 -6 10 0`} {...stroke} />;
  const sleepEye = (x: number) => <path d={`M${x - 5} ${cy - 1}q5 5 10 0`} {...stroke} />;
  return (
    <g>
      {mood === 'sleepy' ? sleepEye(left) : openEye(left)}
      {mood === 'sleepy' ? sleepEye(right) : mood === 'wink' ? closedEye(right) : openEye(right)}
      <ellipse cx={left - 7} cy={cy + 8} rx="5" ry="3.6" fill={CHEEK} opacity="0.8" />
      <ellipse cx={right + 7} cy={cy + 8} rx="5" ry="3.6" fill={CHEEK} opacity="0.8" />
      {mood === 'sad' ? (
        <path d={`M${cx - 5} ${cy + 12}q5 -5 10 0`} {...stroke} />
      ) : mood === 'calm' ? (
        <path d={`M${cx - 4} ${cy + 9}h8`} {...stroke} />
      ) : (
        <path d={`M${cx - 6} ${cy + 7}q6 7 12 0`} {...stroke} />
      )}
    </g>
  );
};

/** ดาวปลายมนของตัวสีส้มเหลือง */
const BURST_POINTS = Array.from({ length: 18 }, (_, i) => {
  const r = i % 2 === 0 ? 50 : 36;
  const a = (Math.PI * 2 * i) / 18 - Math.PI / 2;
  return `${(60 + r * Math.cos(a)).toFixed(1)},${(60 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const body = (kind: MascotKind, fill: string): React.ReactNode => {
  switch (kind) {
    case 'heart':
      return <path d="M60 108C28 88 10 70 10 46c0-17 13-30 28-30 9 0 17 4 22 13 5-9 13-13 22-13 15 0 28 13 28 30 0 24-18 42-50 62z" fill={fill} />;
    case 'burst':
      return <polygon points={BURST_POINTS} fill={fill} stroke={fill} strokeWidth="9" strokeLinejoin="round" />;
    case 'cloud':
      return (
        <g fill={fill}>
          <circle cx="60" cy="38" r="26" />
          <circle cx="32" cy="58" r="26" />
          <circle cx="88" cy="58" r="26" />
          <circle cx="44" cy="82" r="24" />
          <circle cx="76" cy="82" r="24" />
          <circle cx="60" cy="62" r="28" />
        </g>
      );
    case 'ball':
      return <circle cx="60" cy="60" r="46" fill={fill} />;
    case 'tri':
      return <polygon points="60,24 100,92 20,92" fill={fill} stroke={fill} strokeWidth="24" strokeLinejoin="round" />;
    case 'mound':
      return <path d="M60 20c20 0 32 16 42 38 9 20 12 34 2 44-8 8-24 8-44 8s-36 0-44-8c-10-10-7-24 2-44 10-22 22-38 42-38z" fill={fill} />;
    case 'sun':
      return <circle cx="60" cy="60" r="44" fill={fill} />;
  }
};

const FACE_POS: Record<MascotKind, { cx: number; cy: number; gap?: number }> = {
  heart: { cx: 60, cy: 50 },
  burst: { cx: 60, cy: 56 },
  cloud: { cx: 60, cy: 58 },
  ball: { cx: 60, cy: 56 },
  tri: { cx: 60, cy: 68, gap: 11 },
  mound: { cx: 60, cy: 64 },
  sun: { cx: 60, cy: 56 },
};

interface MascotProps {
  kind: MascotKind;
  mood?: MascotMood;
  className?: string;
  /** ไม่ขยับ (ค่าเริ่มต้นลอยเบา ๆ) */
  still?: boolean;
  /** เส้นประกายรอบตัว */
  sparks?: boolean;
  style?: React.CSSProperties;
}

export const Mascot: React.FC<MascotProps> = ({ kind, mood = 'happy', className, still, sparks, style }) => {
  const id = `m${useId().replace(/:/g, '')}`;
  const [top, bottom] = COLORS[kind];
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" style={style} className={cn('overflow-visible', !still && 'mascot-bob', className)}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="30" y1="6" x2="90" y2="114">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      {sparks && (
        <g stroke="#FFD97A" strokeWidth="4.5" strokeLinecap="round" className="mascot-sparks">
          <path d="M104 18l6-9M114 34l10-4M90 8l2-11" />
        </g>
      )}
      {body(kind, `url(#${id})`)}
      <Face mood={mood} {...FACE_POS[kind]} />
    </svg>
  );
};

const FAMILY: { kind: MascotKind; mood: MascotMood; className: string }[] = [
  { kind: 'heart', mood: 'wink', className: 'left-[26%] top-[2%] w-[34%]' },
  { kind: 'cloud', mood: 'sleepy', className: 'right-0 top-[8%] w-[38%]' },
  { kind: 'burst', mood: 'happy', className: 'left-0 top-[26%] w-[40%]' },
  { kind: 'ball', mood: 'sleepy', className: 'left-[38%] top-[34%] w-[28%]' },
  { kind: 'mound', mood: 'happy', className: 'right-[2%] bottom-0 w-[36%]' },
  { kind: 'tri', mood: 'happy', className: 'left-[26%] bottom-[-2%] w-[34%]' },
];

/** ตัวการ์ตูนกองรวมกันกระโดดเข้ามาทีละตัว ใช้เป็นภาพเปิดของหน้าเข้าสู่ระบบ */
export const MascotFamily: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cn('relative aspect-[5/4] w-full', className)}>
    {FAMILY.map((m, i) => (
      <span key={m.kind} className={cn('mascot-enter absolute block', m.className)} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
        <Mascot kind={m.kind} mood={m.mood} className="block h-full w-full" style={{ animationDelay: `${i * -0.7}s` }} />
      </span>
    ))}
  </div>
);
