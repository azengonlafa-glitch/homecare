import React from 'react';

/** ข้อความรอระหว่างโหลดหน้าที่แยกไฟล์ไว้ (ปกติเห็นแค่ชั่วครู่) */
export const PageLoading: React.FC = () => (
  <div role="status" aria-live="polite" className="flex min-h-[40vh] items-center justify-center p-8 text-lg font-bold text-slate-700">
    กำลังโหลด...
  </div>
);
