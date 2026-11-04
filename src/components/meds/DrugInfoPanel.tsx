import React from 'react';
import { AlertTriangle, BookOpen, ChevronDown, ExternalLink } from 'lucide-react';
import type { DrugInfo } from '../../data/drugDb';
import { DRUG_DETAILS } from '../../data/drugDetails';

const Topic: React.FC<{ title: string; defaultOpen?: boolean; danger?: boolean; children: React.ReactNode }> = ({
  title,
  defaultOpen,
  danger,
  children,
}) => (
  <details open={defaultOpen} className="group rounded-xl border border-slate-200 bg-slate-50">
    <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-base font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
      <span className={danger ? 'flex items-center gap-2 text-red-800' : undefined}>
        {danger && <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />}
        {title}
      </span>
      <ChevronDown className="w-5 h-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="px-4 pb-4 text-base text-slate-800">{children}</div>
  </details>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((item) => (
      <li key={item} className="break-words">
        {item}
      </li>
    ))}
  </ul>
);

interface DrugInfoPanelProps {
  drug: DrugInfo;
  /** ปิดหัวข้อทั้งหมดไว้ก่อน (ใช้ในฟอร์ม เพื่อไม่ให้ยาวเกินไป) */
  compact?: boolean;
}

/** ข้อมูลยาจากเอกสารอ้างอิง แยกเป็นหัวข้อกดเปิด/ปิดได้ แสดงเฉพาะยาที่ตรวจกับแหล่งอ้างอิงแล้ว */
export const DrugInfoPanel: React.FC<DrugInfoPanelProps> = ({ drug, compact }) => {
  const info = DRUG_DETAILS[drug.id];

  return (
    <section aria-label="ข้อมูลจากฐานข้อมูลยา" className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <BookOpen className="w-5 h-5 shrink-0 text-purple-700" aria-hidden="true" />
          <span className="break-words">
            {drug.generic} · {drug.thai}
          </span>
        </h3>
        {info?.brands && info.brands.length > 0 && (
          <p className="mt-1 text-sm text-slate-600 break-words">ชื่อการค้า: {info.brands.join(', ')}</p>
        )}
      </div>

      {!info ? (
        <p className="text-base text-slate-700">ยังไม่มีข้อมูลยาที่ตรวจกับแหล่งอ้างอิง ถามเภสัชกรหรือดูเอกสารกำกับยา</p>
      ) : (
        <>
          <div className="space-y-2">
            <Topic title="ใช้รักษาอะไร" defaultOpen={!compact}>
              <Bullets items={info.uses} />
            </Topic>
            <Topic title="วิธีกินและขนาดยา" defaultOpen={!compact}>
              <Bullets items={info.howToTake} />
              {info.dose && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 font-bold">ขนาดยา</p>
                  <Bullets items={info.dose} />
                </div>
              )}
            </Topic>
            {info.missedDose && (
              <Topic title="ถ้าลืมกิน">
                <p>{info.missedDose}</p>
              </Topic>
            )}
            {info.tooMuch && (
              <Topic title="ถ้ากินเกินขนาด" danger>
                <p>{info.tooMuch}</p>
              </Topic>
            )}
            {info.sideEffects && (
              <Topic title="ผลข้างเคียงที่พบบ่อย">
                <Bullets items={info.sideEffects} />
              </Topic>
            )}
            {info.seekHelp && (
              <Topic title="อาการที่ต้องรีบพบแพทย์" danger defaultOpen={!compact}>
                <Bullets items={info.seekHelp} />
              </Topic>
            )}
            {info.cautions && (
              <Topic title="ใครใช้ไม่ได้ หรือต้องระวัง">
                <Bullets items={info.cautions} />
              </Topic>
            )}
            {info.interactions && (
              <Topic title="ยาและอาหารเสริมที่ตีกัน">
                <Bullets items={info.interactions} />
              </Topic>
            )}
            {info.pregnancy && (
              <Topic title="ตั้งครรภ์และให้นมบุตร">
                <p>{info.pregnancy}</p>
              </Topic>
            )}
          </div>

          <p className="text-sm text-slate-600">
            แปลและสรุปจาก{' '}
            <a
              href={info.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-purple-700 underline"
            >
              {info.sourceName}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>{' '}
            ข้อมูลทั่วไปสำหรับผู้ใหญ่ ไม่ใช่คำแนะนำเฉพาะตัว ให้ยึดตามแพทย์หรือเภสัชกร
          </p>
        </>
      )}
    </section>
  );
};
