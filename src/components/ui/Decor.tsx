import React from 'react';

/** พื้นหลังรูปปิกนิกกลางทุ่ง: จอแนวนอนใช้รูปแนวนอน จอแนวตั้ง (มือถือ) ใช้รูปแนวตั้ง (ดู .app-backdrop ใน index.css) */
export const CanvasDecor: React.FC = () => (
  <div aria-hidden="true" className="app-backdrop pointer-events-none fixed inset-0 -z-10" />
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
