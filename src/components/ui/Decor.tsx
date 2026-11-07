import React from 'react';
import { Mascot } from './Mascot';

/** รูปทรงพื้นหลังทั้งแอป วางนิ่งอยู่หลังเนื้อหา ไม่รับการกด และไม่ทำให้หน้าล้น */
export const CanvasDecor: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
    <span className="blob-morph absolute -right-32 -top-32 h-[26rem] w-[26rem] bg-purple-200" />
    <span className="blob-morph absolute -bottom-40 -left-32 h-[30rem] w-[30rem] bg-peach-soft" style={{ animationDelay: '-6s' }} />
    <span className="drift absolute right-[7%] top-24 h-10 w-10 rounded-full bg-sun" />
    <span className="drift absolute right-[3%] top-44 h-5 w-5 rounded-full bg-coral" style={{ animationDelay: '-5s' }} />
    {/* ตัวการ์ตูนโผล่จากขอบจอ เห็นเฉพาะจอกว้างที่มีที่ว่างข้างเนื้อหา */}
    <Mascot kind="tri" mood="wink" className="absolute -bottom-6 right-6 hidden h-32 w-32 2xl:block" />
    <Mascot kind="ball" mood="sleepy" className="absolute bottom-40 -right-10 hidden h-24 w-24 2xl:block" style={{ animationDelay: '-1.4s' }} />
    <Mascot kind="heart" className="absolute right-4 top-1/3 hidden h-20 w-20 2xl:block" style={{ animationDelay: '-2.6s' }} />
  </div>
);

/** วงกลมซ้อนแบบหัวการ์ดในหน้าหลัก: ครามใหญ่ เหลือง และจุดชมพู */
export const HeroShapes: React.FC = () => (
  <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
    <span className="blob-morph absolute -right-20 -top-14 h-48 w-48 bg-purple-700 sm:-right-16 sm:-top-20 sm:h-72 sm:w-72" />
    <span className="drift absolute right-[6.5rem] top-2 h-8 w-8 rounded-full bg-sun sm:right-52 sm:h-16 sm:w-16" />
    <span className="drift absolute bottom-4 right-44 hidden h-6 w-6 rounded-full bg-coral sm:block" style={{ animationDelay: '-3s' }} />
    <span className="blob-morph absolute -bottom-20 -left-12 h-44 w-44 bg-white/40" style={{ animationDelay: '-5s' }} />
  </span>
);
