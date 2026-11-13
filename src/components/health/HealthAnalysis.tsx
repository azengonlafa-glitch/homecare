import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Pencil } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { OnboardingProfile } from '../../lib/onboarding';
import {
  BMI_GAUGE,
  DIASTOLIC_GAUGE,
  GLUCOSE_GAUGE,
  SYSTOLIC_GAUGE,
  ageOf,
  bmiOf,
  buildInsights,
  checklist,
  isAdultForBmi,
  vitalsOf,
  type Tone,
} from '../../lib/healthAnalysis';
import { TONE_SOFT, ZoneCard } from './HealthCharts';
import { cn } from '../../lib/cn';

const TONE_ICON: Record<Tone, React.ReactNode> = {
  good: <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />,
  warn: <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />,
  bad: <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />,
};

const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="mb-4">
    <h2 className="text-lg sm:text-xl font-bold text-slate-900">{children}</h2>
    {hint && <p className="mt-1 text-sm sm:text-base text-slate-600">{hint}</p>}
  </div>
);

/** โหมดวิเคราะห์: เทียบข้อมูลของคุณกับเกณฑ์ที่มีแหล่งอ้างอิง (ไม่มีคะแนนรวม เพราะไม่มีมาตรฐานรองรับ) */
export const HealthAnalysis: React.FC<{ profile: OnboardingProfile; onEdit: () => void }> = ({
  profile,
  onEdit,
}) => {
  const items = checklist(profile);
  const bmi = bmiOf(profile);
  const adult = isAdultForBmi(profile);
  const { systolic, diastolic, glucose } = vitalsOf(profile);
  const insights = buildInsights(profile);
  const age = ageOf(profile);
  const missing = items.filter((i) => i.value === null);

  return (
    <div className="space-y-5">
      {/* เทียบกับเกณฑ์ */}
      <Card>
        <SectionTitle
          hint={`เทียบแต่ละค่ากับเกณฑ์ที่ใช้กันทั่วไป พร้อมบอกว่าเกณฑ์มาจากไหน${age !== null ? ` · อายุ ${age} ปี` : ''}`}
        >
          เทียบกับเกณฑ์
        </SectionTitle>
        <ul className="divide-y divide-slate-200/70">
          {items.map((i) => (
            <li key={i.key} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-base font-semibold text-slate-900">{i.label}</span>
                <span className="text-sm text-slate-600">{i.value ?? 'ยังไม่มีข้อมูล'}</span>
              </div>
              {i.status && (
                <span
                  className={cn(
                    'mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-sm font-semibold',
                    i.tone ? TONE_SOFT[i.tone] : 'bg-slate-50 border-slate-200 text-slate-700'
                  )}
                >
                  {i.status}
                </span>
              )}
              <p className="mt-1 text-sm text-slate-500">{i.standard}</p>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <Button type="button" variant="soft" size="sm" className="mt-4" onClick={onEdit}>
            <Pencil className="w-4 h-4" aria-hidden="true" />
            <span>เพิ่มข้อมูลที่ขาด ({missing.length} อย่าง)</span>
          </Button>
        )}
      </Card>

      {/* ค่าของคุณ: การ์ดละค่า อ่านง่าย */}
      <Card>
        <SectionTitle hint="ดูป้ายสถานะของแต่ละค่า จุดดำบนแถบคือตำแหน่งของคุณ">ค่าของคุณอยู่ตรงไหน</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {adult && <ZoneCard spec={BMI_GAUGE} value={bmi} onAdd={onEdit} />}
          <ZoneCard spec={GLUCOSE_GAUGE} value={glucose} onAdd={onEdit} />
          <ZoneCard spec={SYSTOLIC_GAUGE} value={systolic} onAdd={onEdit} />
          <ZoneCard spec={DIASTOLIC_GAUGE} value={diastolic} onAdd={onEdit} />
        </div>
      </Card>

      {/* ข้อสังเกต */}
      {insights.length > 0 && (
        <Card>
          <SectionTitle>ข้อสังเกตและสิ่งที่ควรทำ</SectionTitle>
          <ul className="space-y-3">
            {insights.map((item, i) => (
              <li key={i} className={cn('flex gap-3 rounded-2xl border p-4 text-base', TONE_SOFT[item.tone])}>
                {TONE_ICON[item.tone]}
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="px-1 text-sm text-slate-500 leading-relaxed">
        เป็นการเทียบกับเกณฑ์ทั่วไปเพื่อช่วยสังเกตเท่านั้น ไม่ใช่การวินิจฉัยโรคและไม่ใช่คำแนะนำทางการแพทย์
        แพทย์อาจตั้งเป้าหมายของคุณต่างจากนี้ ถ้ามีอาการผิดปกติหรือค่าผิดเกณฑ์ ควรปรึกษาแพทย์หรือเภสัชกร
      </p>
    </div>
  );
};
