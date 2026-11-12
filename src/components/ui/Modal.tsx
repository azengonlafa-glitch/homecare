import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { playUiSound } from '../../lib/sound';

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

/**
 * ล็อกการเลื่อนหน้าแบบนับจำนวนหน้าต่างที่เปิดอยู่ คืนค่าเดิมเมื่อปิดครบทุกบาน
 * (ถ้าแต่ละบานจำค่าก่อนหน้าเอง หน้าต่างที่ปิดทีหลังจะคืนค่า "hidden" ทำให้หน้าเว็บเลื่อนไม่ได้ค้าง)
 */
let scrollLocks = 0;
let savedOverflow = '';
function lockScroll() {
  if (scrollLocks === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks++;
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
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
  // ค้างหน้าต่างไว้ครู่หนึ่งหลังสั่งปิด เพื่อเล่นอนิเมชันตอนปิด (ลดการเคลื่อนไหว = ปิดทันที)
  const [mounted, setMounted] = useState(open);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open !== wasOpen.current) playUiSound(open ? 'open' : 'close');
    wasOpen.current = open;
    if (open) {
      setMounted(true);
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setMounted(false);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();

    const target =
      (initialFocusSelector && dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)) ||
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();

    return () => {
      unlockScroll();
      previouslyFocused?.focus?.();
    };
    // โฟกัสเฉพาะตอนเปิด/ปิดเท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open && !mounted) return null;
  const closing = !open;

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
      className={cn(
        'modal-backdrop fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4',
        closing && 'is-closing pointer-events-none'
      )}
      onMouseDown={(e) => {
        if (!closing && dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className={cn(
          'modal-sheet modal-paper relative flex flex-col w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[86dvh] rounded-t-[2.25rem] sm:rounded-[2.25rem]',
          closing && 'is-closing'
        )}
      >
        {/* ที่จับด้านบนบนมือถือ บอกว่าเป็นแผ่นที่เลื่อนขึ้นมา */}
        <span aria-hidden="true" className="sm:hidden mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300" />
        <div className="px-5 sm:px-8 pt-3 sm:pt-7 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-slate-900 break-words min-w-0">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="modal-close inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full bg-white/80 ring-1 ring-slate-200 text-slate-700 hover:bg-white hover:text-slate-900 cursor-pointer"
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
            'flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-8 border-t-2 border-dashed border-slate-200',
            bodyLabel && 'focus-visible:outline-offset-[-3px]'
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-5 sm:px-8 py-4 border-t-2 border-dashed border-slate-200 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
