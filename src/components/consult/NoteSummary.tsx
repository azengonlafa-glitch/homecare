import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { ConsultNote } from '../../consult/types';

const ROWS: { key: keyof ConsultNote; label: string }[] = [
  { key: 'assessment', label: 'การประเมิน' },
  { key: 'medicationAdvice', label: 'คำแนะนำเรื่องยา' },
  { key: 'recommendation', label: 'คำแนะนำ' },
  { key: 'referral', label: 'การส่งต่อ' },
  { key: 'followUpPlan', label: 'แผนติดตาม' },
];

/** ผลการปรึกษาที่เภสัชกรยืนยันแล้ว */
export const NoteSummary: React.FC<{ note: ConsultNote }> = ({ note }) => (
  <section className="rounded-3xl border border-emerald-300 bg-emerald-50/60 p-4 sm:p-5 space-y-2">
    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
      <ClipboardCheck className="w-6 h-6 text-emerald-700" aria-hidden="true" />
      ผลการปรึกษาจากผู้ให้บริการ
    </h2>
    {ROWS.map(({ key, label }) =>
      note[key] ? (
        <p key={key} className="text-base text-slate-900 break-words whitespace-pre-wrap">
          <span className="font-bold">{label}: </span>
          {note[key]}
        </p>
      ) : null
    )}
    {note.followUpDue && (
      <p className="text-base text-slate-900">
        <span className="font-bold">นัดติดตาม: </span>
        {new Date(`${note.followUpDue}T00:00:00`).toLocaleDateString('th-TH', { dateStyle: 'long' })}
      </p>
    )}
  </section>
);
