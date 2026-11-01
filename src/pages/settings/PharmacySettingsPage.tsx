import React from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { buttonClass } from '../../components/ui/Button';
import { PageLayout } from '../../components/settings/PageLayout';
import { PHARMACY } from '../../lib/config';

const linkClass = 'text-base sm:text-lg font-bold text-purple-700 hover:text-purple-800 underline underline-offset-4 break-all';

/** ตั้งค่า > ร้านยาของเรา: ข้อมูลร้านเดียวกับที่หน้า "ถามเภสัชกร" ใช้ */
export const PharmacySettingsPage: React.FC = () => (
  <PageLayout
    title="ร้านยาของเรา"
    description="ติดต่อเภสัชกรประจำร้านได้เมื่อไม่แน่ใจเรื่องยา"
    footer={
      <div className="space-y-3">
        <a href={PHARMACY.phoneHref} className={buttonClass('primary', 'md', true)}>
          <Phone className="w-6 h-6" aria-hidden="true" />
          <span>โทรหาร้านยา</span>
        </a>
        <a
          href={PHARMACY.lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('soft', 'md', true)}
        >
          <MessageCircle className="w-6 h-6" aria-hidden="true" />
          <span>เปิดไลน์ร้านยา</span>
        </a>
      </div>
    }
  >
    <Card>
      <dl className="space-y-5">
        <div>
          <dt className="text-sm font-semibold text-slate-600">ชื่อร้าน</dt>
          <dd className="mt-1 text-base sm:text-lg font-bold text-slate-900 break-words">{PHARMACY.name}</dd>
        </div>

        <div>
          <dt className="text-sm font-semibold text-slate-600">เบอร์โทร</dt>
          <dd className="mt-1">
            <a href={PHARMACY.phoneHref} className={linkClass}>
              {PHARMACY.phoneLabel}
            </a>
          </dd>
        </div>

        <div>
          <dt className="text-sm font-semibold text-slate-600">ไลน์</dt>
          <dd className="mt-1">
            <a href={PHARMACY.lineUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {PHARMACY.lineLabel}
            </a>
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-sm text-slate-600">ข้อมูลร้านเป็นข้อมูลสมมติของต้นแบบ</p>
    </Card>
  </PageLayout>
);
