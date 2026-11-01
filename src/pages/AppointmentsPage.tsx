import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';

export const AppointmentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="ตารางนัดหมอ"
        description="โครงสร้างหน้านัดหมอพร้อมแล้ว กำลังรอขั้นตอนถัดไป"
      />

      <Card className="p-8 text-center border-dashed border-2 border-purple-200 bg-white">
        <p className="text-slate-600 font-medium text-base">
          (โครงสร้างหน้านัดหมอพร้อมแล้ว ระบบนัดหมายจะเริ่มพัฒนาเมื่อได้รับคำสั่งในขั้นตอนถัดไป)
        </p>
      </Card>
    </div>
  );
};
