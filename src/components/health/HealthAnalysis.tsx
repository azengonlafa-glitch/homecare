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
  axisScores,
  bmiOf,
  buildInsights,
  overallScore,
  scoreLabel,
  vitalsOf,
  type Tone,
} from '../../lib/healthAnalysis';
import { RadarChart, ScoreRing, TONE_BG, TONE_SOFT, ZoneCard } from './HealthCharts';
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

/** โหมดวิเคราะห์: เทียบข้อมูลของคุณกับเกณฑ์ของคนสุขภาพดี */
export const HealthAnalysis: React.FC<{ profile: OnboardingProfile; onEdit: () => void }> = ({
  profile,
  onEdit,
}) => {
  const axes = axisScores(profile);
  const total = overallScore(axes);
  const level = total === null ? null : scoreLabel(total);
  const bmi = bmiOf(profile);
  const { systolic, diastolic, glucose } = vitalsOf(profile);
  const insights = buildInsights(profile);
  const age = ageOf(profile);
  const missing = axes.filter((a) => a.score === null);

  return (
    <div className="space-y-5">
      {/* คะแนนรวม */}
      <Card>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {total !== null && level ? (
            <ScoreRing score={total} label={level.label} tone={level.tone} />
          ) : (
            <div className="w-40 h-40 shrink-0 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center text-center text-sm text-slate-500 px-6">
              ข้อมูลยังไม่พอ
            </div>
          )}
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-semibold text-slate-500">คะแนนสุขภาพโดยรวม (คนสุขภาพดี = 100)</p>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {level ? level.label : 'ยังวิเคราะห์ไม่ได้'}
            </p>
            <p className="mt-2 text-base text-slate-600">
              {total === null
                ? 'ต้องมีข้อมูลอย่างน้อย 3 ด้านจึงจะวิเคราะห์ได้ เพิ่มข้อมูลในโหมด “ข้อมูลของฉัน”'
                : `คำนวณจาก ${axes.length - missing.length} ด้านที่มีข้อมูล${age !== null ? ` · อายุ ${age} ปี` : ''}`}
            </p>
            {missing.length > 0 && (
              <Button type="button" variant="soft" size="sm" className="mt-3" onClick={onEdit}>
                <Pencil className="w-4 h-4" aria-hidden="true" />
                <span>เพิ่มข้อมูลที่ขาด ({missing.length} ด้าน)</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* กราฟเทียบรายด้าน */}
      <Card>
        <SectionTitle hint="เส้นประสีเขียวคือคนสุขภาพดี พื้นสีม่วงคือคุณ ยิ่งเต็มขอบยิ่งดี">
          คุณเทียบกับคนสุขภาพดี
        </SectionTitle>
        <RadarChart axes={axes} />

        <ul className="mt-5 space-y-3">
          {axes.map((a) => (
            <li key={a.key}>
              <div className="flex items-baseline justify-between gap-3 text-base">
                <span className="font-semibold text-slate-900">{a.label}</span>
                <span className="text-sm text-slate-600 text-right">{a.detail}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="relative flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  {a.score !== null && (
                    <div
                      className={cn(
                        'h-full rounded-full',
                        TONE_BG[a.score >= 80 ? 'good' : a.score >= 55 ? 'warn' : 'bad']
                      )}
                      style={{ width: `${a.score}%` }}
                    />
                  )}
                </div>
                <span className="w-16 text-right text-sm font-bold text-slate-700">
                  {a.score === null ? '–' : `${a.score}/100`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* ค่าของคุณ: การ์ดละค่า อ่านง่าย */}
      <Card>
        <SectionTitle hint="ดูป้ายสถานะของแต่ละค่า จุดดำบนแถบคือตำแหน่งของคุณ">ค่าของคุณอยู่ตรงไหน</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ZoneCard spec={BMI_GAUGE} value={bmi} onAdd={onEdit} />
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
        การวิเคราะห์นี้เป็นการเทียบกับเกณฑ์ทั่วไปเพื่อให้เห็นภาพรวมเท่านั้น ไม่ใช่การวินิจฉัยโรคและไม่ใช่คำแนะนำทางการแพทย์
        หากมีอาการผิดปกติหรือค่าผิดเกณฑ์ ควรปรึกษาแพทย์หรือเภสัชกร
      </p>
    </div>
  );
};
