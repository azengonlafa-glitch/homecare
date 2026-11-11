import React, { useId } from 'react';
import { STAGES, type StageId } from '../../lib/streak';
import { cn } from '../../lib/cn';
import fireGold from '../../assets/streak/fire-gold.png';
import fireRed from '../../assets/streak/fire-red.png';
import fireDarkRed from '../../assets/streak/fire-darkred.png';
import fireBlue from '../../assets/streak/fire-blue.png';
import firePurple from '../../assets/streak/fire-purple.png';

/** ภาพไฟ+แอปเปิ้ลของแต่ละระดับ (ตัดจากภาพอ้างอิงที่ผู้ใช้ให้มา) */
const FIRE_IMAGES: Partial<Record<StageId, string>> = {
  gold: fireGold,
  red: fireRed,
  darkred: fireDarkRed,
  blue: fireBlue,
  purple: firePurple,
};
/** บรรทัดแบ่ง (% จากด้านบนของภาพ) อยู่เหนือใบแอปเปิ้ลพอดี: เหนือเส้นนี้มีแต่ไฟ จึงให้ส่วนนี้ลุกพลิ้วได้ */
const FIRE_SEAM = 43.5;
/** สัดส่วนกว้าง/สูงของภาพไฟ */
const FIRE_RATIO = 336 / 480;

/**
 * ไฟ+แอปเปิ้ลจากภาพอ้างอิง: ส่วนล่าง (แอปเปิ้ลและฐานไฟ) อยู่นิ่ง ส่วนบน (ปลายไฟ) ยืดหดและเอนไปมาเหมือนไฟลุก
 * จุดหมุนอยู่ที่บรรทัดแบ่งพอดี (มีแค่ scaleY และ skewX) รอยต่อจึงไม่แยกกัน
 */
const FireApple: React.FC<{ src: string; celebrate?: boolean; className?: string }> = ({ src, celebrate, className }) => (
  <div className={cn('flex items-center justify-center', className)} aria-hidden="true">
    {/* รูปล่างเป็นตัวกำหนดขนาดกรอบ (สูง 92% กว้างตามสัดส่วนรูป) รูปบนวางทับพอดี */}
    <div className={cn('relative', celebrate && 'apple-ignite')} style={{ height: '92%', aspectRatio: String(FIRE_RATIO) }}>
      <img
        src={src}
        alt=""
        draggable={false}
        width={336}
        height={480}
        className="select-none"
        style={{ display: 'block', height: '100%', width: 'auto', clipPath: `inset(${FIRE_SEAM}% 0 0 0)` }}
      />
      <img
        src={src}
        alt=""
        draggable={false}
        className="fire-tip select-none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          clipPath: `inset(0 0 ${100 - FIRE_SEAM - 0.4}% 0)`,
          transformOrigin: `50% ${FIRE_SEAM}%`,
        }}
      />
    </div>
  </div>
);

/** ลูกแอปเปิ้ล (จุดกำเนิดที่ 0,0) ไล่เฉดสี มีเงา ไฮไลต์ ก้านและใบมีเส้นใบ */
const Apple: React.FC<{ scale: number; uid: string }> = ({ scale, uid }) => (
  <g transform={`scale(${scale})`}>
    <ellipse cx="0" cy="34" rx="20" ry="3.5" fill="#000000" opacity="0.14" />
    <path
      d="M0 -17C-10 -28 -31 -23 -31 -1C-31 20 -17 33 -6 30.5C-2 29.5 2 29.5 6 30.5C17 33 31 20 31 -1C31 -23 10 -28 0 -17Z"
      fill={`url(#apple-body-${uid})`}
    />
    <path
      d="M0 -17C-10 -28 -31 -23 -31 -1C-31 20 -17 33 -6 30.5C-2 29.5 2 29.5 6 30.5C17 33 31 20 31 -1C31 -23 10 -28 0 -17Z"
      fill={`url(#apple-shade-${uid})`}
    />
    <path d="M-23 -4C-24 -13 -17 -20 -9 -20" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.6" />
    <ellipse cx="-20" cy="9" rx="2.6" ry="2.6" fill="#FFFFFF" opacity="0.45" />
    <path d="M0 -17C-1 -24 1 -30 6 -35" stroke={`url(#apple-stem-${uid})`} strokeWidth="4.2" strokeLinecap="round" fill="none" />
    <path d="M4 -27C9 -40 24 -41 32 -33C25 -24 11 -21 4 -27Z" fill={`url(#apple-leaf-${uid})`} />
    <path d="M7 -28C14 -32 22 -34 29 -33" stroke="#2E9A45" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.8" />
  </g>
);

/**
 * แอปเปิ้ลไหม้ (ไฟดับ): ดำเกรียมจัด มีรอยแตก ไม่มีไฟหรือถ่านเรือง
 * เปลือกกะเทาะ ก้านดำ ใบไหม้ใกล้หมด และมีเถ้าร่วงลงมา (ไม่มีควัน)
 */
const CRACKS = [
  'M-16 -16L-7 -6L-14 4L-5 15L-9 24',
  'M13 -14L6 -3L15 8L7 19',
  'M-24 2L-17 8L-22 16',
  'M24 0L19 9L25 15',
  'M-1 -5L2 6L-3 14',
];
const ASH = [
  { x: -22, d: 0 },
  { x: -6, d: 0.9 },
  { x: 12, d: 1.7 },
  { x: 24, d: 0.4 },
];
const BurntApple: React.FC<{ scale: number; uid: string }> = ({ scale, uid }) => (
  <g transform={`scale(${scale})`}>
    <ellipse cx="0" cy="34" rx="22" ry="3.8" fill="#000000" opacity="0.25" />
    <path
      d="M0 -17C-10 -28 -31 -23 -31 -1C-31 20 -17 33 -6 30.5C-2 29.5 2 29.5 6 30.5C17 33 31 20 31 -1C31 -23 10 -28 0 -17Z"
      fill={`url(#burnt-body-${uid})`}
    />
    <ellipse cx="-15" cy="3" rx="8" ry="12" fill="#8A7B73" opacity="0.3" transform="rotate(-18 -15 3)" />
    <ellipse cx="17" cy="14" rx="7" ry="6" fill="#8A7B73" opacity="0.25" />
    <path d="M-27 -8C-22 -20 -10 -24 -4 -21C-14 -18 -20 -12 -22 -2Z" fill="#0A0605" opacity="0.7" />
    <path d="M22 -16C28 -8 30 2 27 10C24 2 22 -6 18 -13Z" fill="#0A0605" opacity="0.6" />
    {CRACKS.map((d, i) => (
      <g key={i}>
        <path d={d} stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.75" />
        <path d={d} stroke="#5C524D" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" transform="translate(0.8 0.8)" />
      </g>
    ))}
    <path d="M0 -17C-1 -24 1 -29 5 -33" stroke="#120C09" strokeWidth="4.4" strokeLinecap="round" fill="none" />
    <path d="M5 -27C9 -31 14 -31 17 -28C14 -26 10 -25 6 -25Z" fill="#2A1F18" />
    {ASH.map((a, i) => (
      <circle key={i} className="apple-ash" cx={a.x} cy="-10" r="1.5" fill="#9A9088" style={{ animationDelay: `${a.d}s` }} />
    ))}
  </g>
);

/**
 * ผลแอปเปิ้ลที่โตตามจำนวนวันที่กินยาตรงตาราง: ดินว่าง → เมล็ด → ต้นอ่อน → แอปเปิ้ล (เล็ก → ใหญ่)
 * ระดับ 30 วันขึ้นไปเป็นไฟ+แอปเปิ้ลตามภาพอ้างอิง สีไฟตามระดับ (ทอง → แดงส้ม → แดง → ฟ้า → ม่วง)
 * celebrate = บังคับให้มีไฟลุก (ใช้ในหน้าต่างฉลอง) ถ้าระดับนั้นยังไม่มีไฟจะใช้ไฟสีทอง
 * burnt = ไฟดับ แสดงแอปเปิ้ลไหม้
 * ไม่ใช้สีอย่างเดียว: จำนวนวันเขียนเป็นข้อความอยู่ข้าง ๆ เสมอ
 */
export const AppleTree: React.FC<{ stage: StageId; celebrate?: boolean; burnt?: boolean; className?: string }> = ({
  stage,
  celebrate,
  burnt,
  className,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const index = STAGES.findIndex((s) => s.id === stage);
  const isApple = !burnt && index >= STAGES.findIndex((s) => s.id === 'sapling');
  const fire = isApple ? (FIRE_IMAGES[stage] ?? (celebrate ? FIRE_IMAGES.gold : undefined)) : undefined;

  if (fire) return <FireApple src={fire} celebrate={celebrate} className={className} />;

  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className={cn('block overflow-visible', className)}>
      <defs>
        <radialGradient id={`apple-body-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FF8A80" />
          <stop offset="0.45" stopColor="#F2323F" />
          <stop offset="1" stopColor="#B80F2A" />
        </radialGradient>
        <linearGradient id={`apple-shade-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.55" stopColor="#7A0A1E" stopOpacity="0" />
          <stop offset="1" stopColor="#7A0A1E" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`apple-stem-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9A6338" />
          <stop offset="1" stopColor="#5E3A1F" />
        </linearGradient>
        <linearGradient id={`apple-leaf-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ADB78" />
          <stop offset="1" stopColor="#2FA24A" />
        </linearGradient>
        <radialGradient id={`burnt-body-${uid}`} cx="38%" cy="32%" r="80%">
          <stop offset="0" stopColor="#4A3C36" />
          <stop offset="0.5" stopColor="#201816" />
          <stop offset="1" stopColor="#070404" />
        </radialGradient>
      </defs>

      {/* ดิน (เฉพาะช่วงเมล็ด/ต้นอ่อน) */}
      {!isApple && !burnt && (
        <g>
          <ellipse cx="100" cy="184" rx="84" ry="16" fill="#7B5233" />
          <ellipse cx="100" cy="176" rx="72" ry="12" fill="#A9754B" />
          <ellipse cx="84" cy="174" rx="22" ry="4" fill="#BC8A5E" />
        </g>
      )}

      {!burnt && stage === 'empty' && (
        <g>
          <ellipse cx="100" cy="174" rx="12" ry="4" fill="#8B5E3C" />
          <path d="M100 150v-8M92 154l-5-5M108 154l5-5" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
        </g>
      )}

      {!burnt && stage === 'seed' && (
        <g>
          <g transform="translate(100 168) rotate(-18)">
            <ellipse rx="9.5" ry="13.5" fill="#6B4423" />
            <ellipse cx="-3.5" cy="-4" rx="2.6" ry="5.5" fill="#A26F40" />
          </g>
          <ellipse cx="88" cy="175" rx="5" ry="2.4" fill="#8B5E3C" />
          <ellipse cx="113" cy="176" rx="6" ry="2.6" fill="#8B5E3C" />
        </g>
      )}

      {!burnt && stage === 'sprout' && (
        <g>
          <path d="M100 176V146" stroke="#4DBF5E" strokeWidth="5.5" strokeLinecap="round" />
          <ellipse cx="87" cy="145" rx="14" ry="7.5" fill="#7ED987" transform="rotate(-28 87 145)" />
          <ellipse cx="113" cy="142" rx="14" ry="7.5" fill="#5CCB6C" transform="rotate(28 113 142)" />
        </g>
      )}

      {burnt && (
        <g transform="translate(100 112)">
          <BurntApple uid={uid} scale={1.6} />
        </g>
      )}

      {/* ผลแอปเปิ้ล (ยังไม่มีไฟ): อยู่กลางภาพเป็นจุดสนใจ */}
      {isApple && (
        <g transform="translate(100 104)">
          <Apple uid={uid} scale={stage === 'sapling' ? 1.5 : 1.75} />
        </g>
      )}
    </svg>
  );
};
