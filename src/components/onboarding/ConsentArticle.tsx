import React from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  CONSENT_CLOSING,
  CONSENT_INTRO,
  CONSENT_IS_DRAFT,
  CONSENT_SECTIONS,
  CONSENT_TITLE,
} from '../../data/consentDocument';

/**
 * เนื้อหาเอกสารยินยอมแบบอ่านอย่างเดียว ใช้ร่วมกันในหน้าต่างขอความยินยอมและหน้า "นโยบายความเป็นส่วนตัว"
 * (เนื้อหาชุดเดียว แก้ที่ data/consentDocument.ts ที่เดียว จะได้ไม่มีสองฉบับที่เริ่มไม่ตรงกัน)
 */
export const ConsentArticle: React.FC<{ showClosing?: boolean }> = ({ showClosing = true }) => (
  <article className="py-5 space-y-6">
    {CONSENT_IS_DRAFT && (
      <p className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span>ฉบับร่างสำหรับทดสอบระบบ ยังไม่ผ่านการตรวจโดยฝ่ายกฎหมาย</span>
      </p>
    )}

    <header>
      <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{CONSENT_TITLE}</h3>
      <p className="mt-3 text-base sm:text-lg text-slate-700 leading-relaxed">{CONSENT_INTRO}</p>
    </header>

    {CONSENT_SECTIONS.map((section) => (
      <section key={section.title} className="space-y-2">
        <h4 className="text-lg font-bold text-purple-900">{section.title}</h4>
        {section.paragraphs?.map((p) => (
          <p key={p} className="text-base sm:text-lg text-slate-700 leading-relaxed">
            {p}
          </p>
        ))}
        {section.items && (
          <ul className="list-disc pl-6 space-y-1.5 text-base sm:text-lg text-slate-700 leading-relaxed">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {section.paragraphs2?.map((p) => (
          <p key={p} className="text-base sm:text-lg text-slate-700 leading-relaxed">
            {p}
          </p>
        ))}
      </section>
    ))}

    {showClosing && (
      <p className="rounded-2xl bg-purple-50 border border-purple-200 p-4 text-base sm:text-lg font-semibold text-purple-950 leading-relaxed">
        {CONSENT_CLOSING}
      </p>
    )}
  </article>
);
