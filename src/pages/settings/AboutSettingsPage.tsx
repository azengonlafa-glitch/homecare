import React from 'react';
import { Phone } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageLayout } from '../../components/settings/PageLayout';

/** วันที่/เวลา build แสดงเป็นภาษาไทย เช่น "1 พฤศจิกายน 2569 เวลา 20:15" */
const buildLabel = new Date(__BUILD_DATE__).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });

/** ตั้งค่า > เกี่ยวกับต้นแบบ */
export const AboutSettingsPage: React.FC = () => (
  <PageLayout title="เกี่ยวกับต้นแบบ">
    <Card>
      <p className="text-base sm:text-lg leading-relaxed text-slate-800 break-words">
        นี่คือต้นแบบ ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ไม่ใช้แทนคำแนะนำของแพทย์หรือเภสัชกร
      </p>
      <p className="mt-4 text-sm text-slate-600">เวอร์ชันต้นแบบ: {buildLabel}</p>
    </Card>

    <Card className="bg-red-50 border-red-200">
      <p className="text-base sm:text-lg font-bold text-red-900 break-words">ถ้ามีอาการฉุกเฉิน</p>

      <a
        href="tel:1669"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 min-h-[58px] px-6 rounded-2xl sm:rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-lg font-bold shadow-sm shadow-red-200 transition-colors"
      >
        <Phone className="w-6 h-6" aria-hidden="true" />
        <span>โทร 1669</span>
      </a>
    </Card>
  </PageLayout>
);
