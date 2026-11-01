import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronsDown, TriangleAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  CONSENT_CLOSING,
  CONSENT_INTRO,
  CONSENT_IS_DRAFT,
  CONSENT_SECTIONS,
  CONSENT_TITLE,
} from '../../data/consentDocument';

interface ConsentDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
}

/** ระยะเผื่อ (px) ก่อนถึงท้ายสุด เพื่อรองรับการปัดเศษของเบราว์เซอร์ */
const END_TOLERANCE = 24;

/**
 * หน้าต่างอ่านเอกสารยินยอม: ปุ่ม "ยอมรับ" จะกดได้ก็ต่อเมื่อเลื่อนอ่านถึงท้ายเอกสารแล้วเท่านั้น
 */
export const ConsentDocumentModal: React.FC<ConsentDocumentModalProps> = ({ open, onClose, onAccept }) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  const measure = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    const ratio = scrollable <= 0 ? 1 : Math.min(1, el.scrollTop / scrollable);
    setProgress(Math.round(ratio * 100));
    if (scrollable <= END_TOLERANCE || el.scrollTop + el.clientHeight >= el.scrollHeight - END_TOLERANCE) {
      setReachedEnd(true); // ถึงท้ายแล้วจะไม่ล็อกกลับ แม้เลื่อนขึ้น
    }
  }, []);

  // เปิดใหม่ทุกครั้งให้เริ่มอ่านใหม่ตั้งแต่ต้น
  useEffect(() => {
    if (!open) {
      // รีเซ็ตตอนปิด เพื่อให้เปิดครั้งถัดไปเริ่มจากล็อกปุ่มยอมรับทันที ไม่มีจังหวะที่ยังเป็นค่าเก่า
      setProgress(0);
      setReachedEnd(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      measure();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, measure]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="เอกสารให้ความยินยอม"
      bodyRef={bodyRef}
      onBodyScroll={measure}
      bodyLabel="เนื้อหาเอกสารให้ความยินยอม เลื่อนอ่านจนถึงท้ายเอกสาร"
      headerExtra={
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700 mb-1.5">
            <span>{reachedEnd ? 'อ่านถึงท้ายเอกสารแล้ว' : 'เลื่อนอ่านให้ถึงท้ายเอกสาร'}</span>
            <span aria-hidden="true">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="ความคืบหน้าการอ่านเอกสาร"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 rounded-full bg-slate-200 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-purple-700 transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="flex items-center gap-2 text-sm sm:text-base text-slate-700" role="status">
            {reachedEnd ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>อ่านครบแล้ว กดยอมรับได้</span>
              </>
            ) : (
              <>
                <ChevronsDown className="w-5 h-5 text-purple-700 shrink-0" aria-hidden="true" />
                <span>ต้องเลื่อนอ่านให้ถึงท้ายเอกสารก่อน ปุ่มยอมรับจึงจะกดได้</span>
              </>
            )}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="neutral" size="sm" onClick={onClose}>
              ปิด
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!reachedEnd}
              onClick={onAccept}
              className="flex-1 sm:flex-none"
            >
              ฉันอ่านครบแล้วและยอมรับ
            </Button>
          </div>
        </div>
      }
    >
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
          </section>
        ))}

        <p className="rounded-2xl bg-purple-50 border border-purple-200 p-4 text-base sm:text-lg font-semibold text-purple-950 leading-relaxed">
          {CONSENT_CLOSING}
        </p>
      </article>
    </Modal>
  );
};
