import React from 'react';
import { loadHomeData } from '../lib/storage';

export const MedsPage: React.FC = () => {
  const data = loadHomeData();

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-900">ตู้ยาประจำบ้าน</h2>
        <p className="text-slate-600 text-sm">มียาทั้งหมด {data.medications.length} รายการ</p>
      </div>
      <div className="border border-slate-200 rounded-2xl p-4 bg-white text-center">
        <p className="text-slate-500 font-medium">
          (โครงสร้างหน้ารายการยาพร้อมแล้ว กำลังรอขั้นตอนถัดไป)
        </p>
      </div>
    </div>
  );
};
