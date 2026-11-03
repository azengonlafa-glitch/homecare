import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** ส่วนใต้ชื่อหัวข้อ เช่น แถบความคืบหน้า */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** ปิดได้ด้วยการกดพื้นหลังหรือ Esc (ค่าเริ่มต้น true) */
  dismissable?: boolean;
  /** ใช้ติดตามการเลื่อนของเนื้อหา เช่น เอกสารที่ต้องอ่านจนจบ */
  bodyRef?: React.RefObject<HTMLDivElement>;
  onBodyScroll?: React.UIEventHandler<HTMLDivElement>;
  /** ให้เนื้อหาเลื่อนด้วยคีย์บอร์ดได้ (ใส่ป้ายอธิบายสำหรับ screen reader) */
  bodyLabel?: string;
  /** ให้โฟกัสที่ช่องนี้ตอนเปิด (ไม่ระบุ = ปุ่มแรกในหน้าต่าง) */
  initialFocusSelector?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** หน้าต่างป๊อปอัป: ล็อกการเลื่อนหน้า, วนโฟกัสในหน้าต่าง, ปิดด้วย Esc, คืนโฟกัสเมื่อปิด */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  headerExtra,
  children,
  footer,
  dismissable = true,
  bodyRef,
  onBodyScroll,
  bodyLabel,
  initialFocusSelector,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target =
      (initialFocusSelector && dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)) ||
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // โฟกัสเฉพาะตอนเปิด/ปิดเท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && dismissable) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="anim-pop flex flex-col w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[86dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden"
      >
        <div className="px-5 sm:px-8 pt-5 sm:pt-7 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-slate-900 break-words min-w-0">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full bg-purple-50 text-purple-800 hover:bg-purple-100 cursor-pointer"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
          {headerExtra}
        </div>

        <div
          ref={bodyRef}
          onScroll={onBodyScroll}
          tabIndex={bodyLabel ? 0 : undefined}
          aria-label={bodyLabel}
          className={cn(
            'flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 border-t border-slate-200',
            bodyLabel && 'focus-visible:outline-offset-[-3px]'
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-5 sm:px-8 py-4 border-t border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
