import React from 'react';
import { Calendar } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Link } from 'react-router-dom';

export const AppointmentsPage: React.FC = () => {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        eyebrow="ระบบบ้าน"
        title="ตารางนัดหมอ"
        description="ติดตามวันนัดหมายแพทย์ และการตรวจสุขภาพของคนในบ้าน"
      />

      <Card className="py-14 px-6 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
          <Calendar className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">ยังไม่มีรายการนัดหมายเร็ว ๆ นี้</h2>
        <p className="mt-2 text-base text-slate-600 max-w-md mx-auto">
          คุณสามารถดูและสร้างนัดหมายแพทย์ร่วมกับกิจกรรมอื่น ๆ ของบ้านได้ที่หน้าปฏิทิน
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to="/calendar"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-purple-700 hover:bg-purple-800 px-5 text-base font-bold text-white shadow-xs transition-colors"
          >
            <span>ไปที่หน้าปฏิทิน</span>
          </Link>
        </div>
      </Card>
    </div>
  );
};
