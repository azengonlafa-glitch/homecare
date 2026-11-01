import React from 'react';
import { loadHomeData } from '../lib/storage';

export const HomePage: React.FC = () => {
  const data = loadHomeData();

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
        <h2 className="text-xl font-bold text-orange-900">{data.homeName}</h2>
        <p className="text-slate-700 mt-1">
          ผู้รับการดูแล {data.patients.length} ท่าน | รายการยาทั้งหมด {data.medications.length} ชนิด
        </p>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-white text-center">
        <p className="text-slate-500 font-medium">
          (โครงสร้างหน้าจอหลักพร้อมแล้ว กำลังรอขั้นตอนถัดไป)
        </p>
      </div>
    </div>
  );
};
