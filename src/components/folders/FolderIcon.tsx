import React, { useId } from 'react';
import type { FolderColor } from '../../lib/folders';
import { cn } from '../../lib/cn';

interface FolderIconProps {
  color: FolderColor;
  /** จำนวนเอกสาร ใช้กำหนดจำนวนกระดาษที่โผล่พ้นปากโฟลเดอร์ */
  count: number;
  className?: string;
  /** ไม่ตอบสนองเมื่อเอาเมาส์ผ่าน (ไอคอนในหัวหน้า) */
  still?: boolean;
}

const BACK = 'M10 22c0-7 5-12 12-12h28c5 0 8 2 11 6l4 6h53c7 0 12 5 12 12v62c0 7-5 12-12 12H22c-7 0-12-5-12-12z';
const FRONT = 'M10 44c0-7 5-12 12-12h96c7 0 12 5 12 12v48c0 7-5 12-12 12H22c-7 0-12-5-12-12z';

const star = (cx: number, cy: number, R: number, r: number, n = 5) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }).join(' ');

const W = '#FFFFFF';

/* ---------- สติกเกอร์ชิ้นเล็ก ๆ (ขอบขาวแบบสติกเกอร์จริง) ---------- */

const Badge: React.FC<{ x: number; y: number; fill: string; mark: string }> = ({ x, y, fill, mark }) => (
  <g>
    <circle cx={x} cy={y} r="11" fill={fill} stroke={W} strokeWidth="1.8" />
    <polygon points={star(x, y, 6.5, 2.8)} fill={mark} />
  </g>
);

const Flower: React.FC<{ x: number; y: number; petal: string; center: string }> = ({ x, y, petal, center }) => (
  <g stroke={W} strokeWidth="1.2">
    {Array.from({ length: 5 }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return <circle key={i} cx={x + Math.cos(a) * 5.4} cy={y + Math.sin(a) * 5.4} r="4.4" fill={petal} />;
    })}
    <circle cx={x} cy={y} r="3.2" fill={center} stroke="none" />
  </g>
);

const Heart: React.FC<{ x: number; y: number; s: number; fill: string; stroke?: string }> = ({ x, y, s, fill, stroke = W }) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M0 6C-14-4-7-13 0-6C7-13 14-4 0 6Z"
    fill={fill}
    stroke={stroke}
    strokeWidth={1.6 / s}
    strokeLinejoin="round"
  />
);

const Oval: React.FC<{ x: number; y: number; rx: number; ry: number; fill: string; ring: string }> = ({ x, y, rx, ry, fill, ring }) => (
  <g>
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={fill} stroke={W} strokeWidth="1.8" />
    <ellipse cx={x} cy={y} rx={rx - 3} ry={ry - 2.4} fill="none" stroke={ring} strokeWidth="1.4" />
  </g>
);

const Sun: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <line key={i} x1={x + Math.cos(a) * 9} y1={y + Math.sin(a) * 9} x2={x + Math.cos(a) * 13} y2={y + Math.sin(a) * 13} stroke="#FF8A3D" strokeWidth="2.6" strokeLinecap="round" />
      );
    })}
    <circle cx={x} cy={y} r="8" fill="#FFF3B0" stroke={W} strokeWidth="1.6" />
    <circle cx={x} cy={y} r="4.2" fill="#FF9F43" />
  </g>
);

const DotCircle: React.FC<{ x: number; y: number; fill: string; dot: string }> = ({ x, y, fill, dot }) => (
  <g>
    <circle cx={x} cy={y} r="10" fill={fill} stroke={W} strokeWidth="1.8" />
    {[[-4, -3], [4, -4], [0, 2], [-5, 4], [5, 4]].map(([dx, dy], i) => (
      <circle key={i} cx={x + dx} cy={y + dy} r="1.7" fill={dot} />
    ))}
  </g>
);

const Crescent: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <circle cx={x} cy={y} r="10.5" fill="#FFE45C" stroke={W} strokeWidth="1.8" />
    <path d={`M${x + 3} ${y - 7.5}a7.8 7.8 0 1 0 4.6 10.2a6.4 6.4 0 0 1 -4.6 -10.2z`} fill="#8E7BE8" />
  </g>
);

const Ticket: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <path
      d={`M${x - 15} ${y - 8}h30v5a3 3 0 0 0 0 6v5h-30v-5a3 3 0 0 0 0 -6z`}
      fill="#FFE45C"
      stroke={W}
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d={`M${x + 5} ${y - 6}v14`} stroke="#8E7BE8" strokeWidth="1.4" strokeDasharray="2 2" />
    <path d={`M${x - 10} ${y - 2}h10M${x - 10} ${y + 3}h7`} stroke="#8E7BE8" strokeWidth="1.8" strokeLinecap="round" />
  </g>
);

const Berries: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g stroke={W} strokeWidth="1.5">
    <circle cx={x - 5} cy={y + 2} r="6.2" fill="#5B3FC4" />
    <circle cx={x + 5} cy={y - 2} r="6.2" fill="#6E52D9" />
    <circle cx={x - 7} cy={y} r="1.5" fill={W} stroke="none" />
    <circle cx={x + 3} cy={y - 4} r="1.5" fill={W} stroke="none" />
    <path d={`M${x + 5} ${y - 8}q1-4 5-5`} stroke="#3FAE5E" strokeWidth="2" fill="none" strokeLinecap="round" />
  </g>
);

const Slice: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g>
    <path d={`M${x - 13} ${y - 5}a13 13 0 0 0 26 0z`} fill="#3FAE5E" stroke={W} strokeWidth="1.8" strokeLinejoin="round" />
    <path d={`M${x - 10} ${y - 5}a10 10 0 0 0 20 0z`} fill="#FF6B81" />
    {[-5, 0, 5].map((dx, i) => (
      <ellipse key={i} cx={x + dx} cy={y + (i === 1 ? 3.6 : 1.4)} rx="1" ry="1.7" fill="#2B2547" />
    ))}
  </g>
);

const Drop: React.FC<{ x: number; y: number; fill: string }> = ({ x, y, fill }) => (
  <path
    transform={`translate(${x} ${y})`}
    d="M0-11C8-1 9 4 5 8C2 11-2 11-5 8C-9 4-8-1 0-11Z"
    fill={fill}
    stroke={W}
    strokeWidth="1.8"
    strokeLinejoin="round"
  />
);

const Cloud: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g fill={W}>
    <circle cx={x - 6} cy={y + 1} r="5.5" />
    <circle cx={x + 1} cy={y - 3} r="7" />
    <circle cx={x + 8} cy={y + 1} r="5" />
    <rect x={x - 11} y={y + 1} width="24" height="5.5" rx="2.7" />
  </g>
);

/* ---------- แต่ละสีเป็นผลไม้คนละชนิด ---------- */

interface Fruit {
  front: string;
  /** ลวดลายบนหน้าโฟลเดอร์ */
  pattern: React.ReactNode;
  /** ส่วนที่โผล่พ้นด้านบน (ก้าน ใบ มงกุฎ) */
  top: React.ReactNode;
  stickers: React.ReactNode;
}

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

const FRUITS: Record<FolderColor, Fruit> = {
  // แอปเปิ้ล: แถบตั้ง ก้านและใบ
  coral: {
    front: '#EF4F48',
    pattern: (
      <g fill="#FF7A70" opacity="0.55">
        {range(10, 130, 24).map((x) => (
          <rect key={x} x={x} y="32" width="12" height="72" />
        ))}
      </g>
    ),
    top: (
      <g>
        <path d="M72 38C70 22 72 8 78-4" stroke="#6B3A1E" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        <path d="M80 12C84-8 104-12 118-6C114 12 98 20 80 12Z" fill="#3DAA6A" />
        <path d="M84 10C94 2 104-2 114-4" stroke="#7BD79B" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    ),
    stickers: (
      <>
        <Badge x={30} y={58} fill="#FFE45C" mark="#7A5BE0" />
        <Flower x={26} y={88} petal="#F57DB4" center="#FFD25E" />
        <Heart x={64} y={78} s={1.7} fill="#7AD36B" />
        <Oval x={106} y={88} rx={15} ry={8} fill="#3E6B3B" ring="#E8F2D8" />
      </>
    ),
  },
  // สับปะรด: ลายตารางข้าวหลามตัด มงกุฎใบแหลม
  butter: {
    front: '#FFC93C',
    pattern: (
      <g stroke="#E39A12" strokeWidth="2.2" opacity="0.75">
        {range(-60, 140, 20).map((x) => (
          <line key={`a${x}`} x1={x} y1="32" x2={x + 72} y2="104" />
        ))}
        {range(10, 210, 20).map((x) => (
          <line key={`b${x}`} x1={x} y1="32" x2={x - 72} y2="104" />
        ))}
      </g>
    ),
    top: (
      <g>
        {[
          [48, 4, '#2E8F4C'],
          [60, -14, '#3FAE5E'],
          [72, -22, '#2E8F4C'],
          [84, -14, '#3FAE5E'],
          [96, 4, '#2E8F4C'],
        ].map(([tx, ty, c]) => (
          <path
            key={String(tx)}
            d={`M64 40Q${Number(tx) - 6} ${Number(ty) + 18} ${tx} ${ty}Q${Number(tx) + 6} ${Number(ty) + 18} 80 40Z`}
            fill={String(c)}
          />
        ))}
      </g>
    ),
    stickers: (
      <>
        <Sun x={30} y={60} />
        <Oval x={72} y={86} rx={17} ry={8} fill="#FFF6D6" ring="#E39A12" />
        <Badge x={108} y={58} fill="#FF8A3D" mark="#FFFFFF" />
      </>
    ),
  },
  // สตรอว์เบอร์รี: เม็ดเล็ก ๆ ทั่วผิว กลีบเลี้ยงสีเขียว
  pink: {
    front: '#F7789F',
    pattern: (
      <g fill="#FFE9A8" opacity="0.9">
        {range(0, 5, 1).flatMap((r) =>
          range(0, 8, 1).map((c) => (
            <ellipse key={`${r}-${c}`} cx={20 + c * 14 + (r % 2) * 7} cy={42 + r * 12} rx="1.5" ry="2.3" />
          ))
        )}
      </g>
    ),
    top: (
      <g>
        <path d="M72 30Q72 14 78 4" stroke="#2E8F4C" strokeWidth="4" strokeLinecap="round" fill="none" />
        {[-72, -36, 0, 36, 72].map((a) => (
          <ellipse key={a} cx="72" cy="22" rx="5.5" ry="14" fill={a % 72 === 0 ? '#3FAE5E' : '#2E8F4C'} transform={`rotate(${a} 72 36)`} />
        ))}
      </g>
    ),
    stickers: (
      <>
        <Heart x={32} y={66} s={1.6} fill="#FFFFFF" stroke="#FFFFFF" />
        <DotCircle x={72} y={84} fill="#FFF3F6" dot="#F7789F" />
        <Flower x={106} y={62} petal="#FFFFFF" center="#F7789F" />
      </>
    ),
  },
  // องุ่น: วงกลมซ้อนเหมือนเม็ดองุ่น ก้านและเถาเลื้อย
  lavender: {
    front: '#8E7BE8',
    pattern: (
      <g fill="none" stroke="#B4A5FA" strokeWidth="2.2" opacity="0.8">
        {range(0, 4, 1).flatMap((r) =>
          range(0, 8, 1).map((c) => <circle key={`${r}-${c}`} cx={14 + c * 16 + (r % 2) * 8} cy={40 + r * 14} r="8" />)
        )}
      </g>
    ),
    top: (
      <g>
        <path d="M70 38C68 22 74 10 84 4" stroke="#6B4A2E" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M86 10C90-8 108-8 118 0C112 14 96 18 86 10Z" fill="#3DAA6A" />
        <path d="M62 34C52 24 46 30 50 22C54 14 44 12 44 18" stroke="#3DAA6A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      </g>
    ),
    stickers: (
      <>
        <Crescent x={30} y={60} />
        <Ticket x={74} y={86} />
        <Berries x={108} y={62} />
      </>
    ),
  },
  // แตงโม: ลายเปลือกลูกคลื่นสีเขียวเข้ม
  mint: {
    front: '#58C98E',
    pattern: (
      <g fill="none" stroke="#2E9E6B" strokeWidth="6" strokeLinecap="round" opacity="0.7">
        {range(16, 130, 22).map((x) => (
          <path key={x} d={`M${x} 28q7 16 0 32t0 32t0 18`} />
        ))}
      </g>
    ),
    top: (
      <g>
        <path d="M72 38C72 22 80 14 90 14C99 14 101 22 94 25" stroke="#3A8F4E" strokeWidth="4.4" strokeLinecap="round" fill="none" />
        <path d="M88 14C84 0 66-2 58 6C64 18 80 20 88 14Z" fill="#4CBE6F" />
      </g>
    ),
    stickers: (
      <>
        <Slice x={32} y={64} />
        <Drop x={72} y={84} fill="#FFFFFF" />
        <Oval x={106} y={62} rx={15} ry={8} fill="#FFE9EE" ring="#E5536E" />
      </>
    ),
  },
  // บลูเบอร์รี: จุดเล็ก ๆ และมงกุฎรูปดาวบนหัวผล
  sky: {
    front: '#5B8EF0',
    pattern: (
      <g fill="#9DBEFF" opacity="0.8">
        {range(0, 5, 1).flatMap((r) =>
          range(0, 7, 1).map((c) => <circle key={`${r}-${c}`} cx={18 + c * 16 + (r % 2) * 8} cy={42 + r * 12} r="2.6" />)
        )}
      </g>
    ),
    top: (
      <g>
        <path d="M84 24C92 8 104 6 114 10C108 22 96 28 84 24Z" fill="#3DAA6A" />
        <polygon points={star(72, 20, 20, 8.5)} fill="#2F4FA8" />
        <circle cx="72" cy="20" r="5" fill="#1E3680" />
      </g>
    ),
    stickers: (
      <>
        <Drop x={30} y={64} fill="#BFE0FF" />
        <Cloud x={72} y={84} />
        <Badge x={108} y={60} fill="#FFE45C" mark="#5B8EF0" />
      </>
    ),
  },
};

/**
 * โฟลเดอร์ผลไม้ตกแต่งด้วยสติกเกอร์ (แต่ละสีเป็นผลไม้คนละชนิด):
 * เอาเมาส์ผ่านแล้วกระดาษโผล่ขึ้นมา ฝาโฟลเดอร์เอียงเปิด และก้านใบโยกเบา ๆ
 * ใส่ใน group เพื่อให้ hover ของการ์ดทั้งใบสั่งให้ไอคอนขยับ
 */
export const FolderIcon: React.FC<FolderIconProps> = ({ color, count, className, still }) => {
  const fruit = FRUITS[color] ?? FRUITS.butter;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sheets = Math.min(3, count);
  return (
    <svg
      viewBox="0 -26 140 138"
      aria-hidden="true"
      focusable="false"
      className={cn('overflow-visible', !still && 'folder-icon', className)}
    >
      <defs>
        <clipPath id={`front-${uid}`}>
          <path d={FRONT} />
        </clipPath>
      </defs>

      {/* ด้านหลังพร้อมแท็บ (สีเทาอ่อนเหมือนโฟลเดอร์ในไอคอนจริง) */}
      <path d={BACK} fill="#DAD6E6" />

      {/* ก้าน ใบ มงกุฎ ที่โผล่จากด้านหลังฝา */}
      <g className="folder-fruit">{fruit.top}</g>

      {/* กระดาษ */}
      <g className="folder-sheets">
        {sheets >= 3 && <rect x="26" y="30" width="86" height="64" rx="8" fill="#FFFFFF" opacity="0.8" transform="rotate(-5 69 62)" />}
        {sheets >= 2 && <rect x="28" y="28" width="86" height="64" rx="8" fill="#FFFFFF" opacity="0.92" transform="rotate(3 71 60)" />}
        {sheets >= 1 && (
          <g>
            <rect x="28" y="28" width="84" height="64" rx="8" fill="#FFFFFF" />
            <path d="M42 44h48M42 56h36M42 68h42" stroke={fruit.front} strokeWidth="5" strokeLinecap="round" />
          </g>
        )}
      </g>

      {/* ฝาหน้า: สีผลไม้ + ลวดลาย + สติกเกอร์ */}
      <g className="folder-lid">
        <g clipPath={`url(#front-${uid})`}>
          <rect x="10" y="32" width="120" height="72" fill={fruit.front} />
          {fruit.pattern}
          <rect x="10" y="32" width="120" height="7" fill="#FFFFFF" opacity="0.16" />
          <rect x="10" y="96" width="120" height="8" fill="#000000" opacity="0.08" />
        </g>
        {fruit.stickers}
      </g>
    </svg>
  );
};
