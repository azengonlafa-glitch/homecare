import React from 'react';

/** พื้นหลังรูปปิกนิกกลางทุ่ง: จอแนวนอนใช้รูปแนวนอน จอแนวตั้ง (มือถือ) ใช้รูปแนวตั้ง (ดู .app-backdrop ใน index.css) */
export const CanvasDecor: React.FC = () => (
  <div aria-hidden="true" className="app-backdrop pointer-events-none fixed inset-0 -z-10" />
);
