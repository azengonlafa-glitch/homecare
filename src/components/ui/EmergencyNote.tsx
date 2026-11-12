import React from 'react';
import { HeartPulse } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * หมายเหตุเรื่องฉุกเฉินแบบสั้น วางในหน้าที่ผู้ใช้เจอทุกวัน (บันทึกอาการ เริ่มปรึกษา)
 * ถ้อยคำเดียวกับข้อ 13 "ข้อควรทราบทางการแพทย์" ในเอกสารยินยอม (data/consentDocument.ts)
 * จงใจไม่ใส่เบอร์โทร: มีเทสต์ใน consult.test.ts ห้ามมีเบอร์ฉุกเฉินในแอป
 * โทนเรียบ ไม่ใช้สีแดง (สีแดงสงวนไว้ให้คำเตือนเร่งด่วนจริง)
 */
export const EmergencyNote: React.FC<{ className?: string }> = ({ className }) => (
  <p
    role="note"
    className={cn(
      'flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-800',
      className
    )}
  >
    <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
    <span>
      แอปนี้ไม่ใช่ช่องทางแจ้งเหตุฉุกเฉิน ถ้ามีอาการรุนแรง เช่น แพ้ยารุนแรง หายใจลำบาก เจ็บแน่นหน้าอก
      ให้ไปสถานพยาบาลที่ใกล้ที่สุดทันที
    </span>
  </p>
);
