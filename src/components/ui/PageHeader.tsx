import React from 'react';
import { useLocation } from 'react-router-dom';
import { HeroShapes } from './Decor';
import { MASCOT_KINDS, Mascot } from './Mascot';

interface PageHeaderProps {
  /** ข้อความนำด้านบน เช่น "บ้านของคุณ" */
  eyebrow?: string;
  title: string;
  description?: string;
  /** ปุ่มหรือตัวควบคุมด้านขวาของหัวหน้า เช่น ปุ่มเพิ่มข้อมูล */
  action?: React.ReactNode;
}

/** เลือกตัวการ์ตูนจากที่อยู่หน้า แค่ให้แต่ละหน้าไม่ซ้ำกัน ไม่ได้สื่อความหมายอะไร */
const TONES = ['bg-peach', 'bg-sun-soft', 'bg-coral-soft', 'bg-mint-soft', 'bg-sky-soft', 'bg-purple-100'];
const pickFor = (path: string) => [...path].reduce((n, c) => n + c.charCodeAt(0), 0);

/** หัวหน้าจอแบบแบนเนอร์พีชกับรูปทรงคราม มีตัวการ์ตูนประจำหน้า */
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, action }) => {
  const { pathname } = useLocation();
  const seed = pickFor(pathname);
  const main = MASCOT_KINDS[seed % MASCOT_KINDS.length];
  const buddy = MASCOT_KINDS[(seed + 3) % MASCOT_KINDS.length];
  return (
    <header className={`hero-in relative rounded-[2.25rem] px-5 py-6 sm:px-8 sm:py-8 ${TONES[(seed >> 1) % TONES.length]}`}>
      <HeroShapes />
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1 sm:pr-24">
          {eyebrow && <span className="mb-2 inline-block rounded-full bg-white/80 px-3.5 py-1 text-sm font-bold text-purple-900 sm:text-base">{eyebrow}</span>}
          <h1 className="text-3xl text-slate-900 sm:text-4xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-base font-medium text-slate-800 sm:text-lg">{description}</p>}
        </div>
        <span className="relative shrink-0">
          <span className="mascot-enter block">
            <Mascot kind={main} sparks className="block h-24 w-24 sm:h-36 sm:w-36" />
          </span>
          <span className="mascot-enter absolute -bottom-3 -left-6 block sm:-left-12" style={{ animationDelay: '0.2s' }}>
            <Mascot kind={buddy} mood="wink" className="block h-11 w-11 sm:h-16 sm:w-16" style={{ animationDelay: '-1.2s' }} />
          </span>
        </span>
      </div>
      {action && <div className="hero-action relative mt-4">{action}</div>}
    </header>
  );
};
