import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Inbox, X } from 'lucide-react';
import { useConsultData } from '../../consult/hooks';
import { QueuePanel } from './PharmacistConsolePage';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * แท็บคิวที่ขอบขวาของหน้าเคส กดแล้วเลื่อนแผงคิวออกมา รับเรื่องใหม่หรือสลับเคสได้โดยไม่ต้องกลับหน้าคิว
 * ป้ายตัวเลขบอกจำนวนคำขอที่รอรับเรื่อง จะได้รู้ว่ามีคนรอแม้กำลังคุยอยู่
 */
export const QueueDrawer: React.FC<{ selectedId: string }> = ({ selectedId }) => {
  const [open, setOpen] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data } = useConsultData(async (b) => b.listQueue(), [], { sessionId: null });
  const waiting = (data ?? []).filter((s) => s.status === 'requested').length;

  useEffect(() => {
    if (!open) return;
    const returnTo = tabRef.current;
    panelRef.current?.querySelector<HTMLElement>('[data-drawer-close]')?.focus();
    return () => returnTo?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
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

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed right-0 top-1/3 z-30 flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-l-2xl border border-r-0 border-purple-300 bg-white px-2.5 py-2 text-purple-900 shadow-lg hover:bg-purple-50"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        <Inbox className="h-6 w-6" aria-hidden="true" />
        <span className="text-base font-bold">คิว</span>
        {waiting > 0 && (
          <span aria-label={`รอรับเรื่อง ${waiting} เคส`} className="min-w-[1.75rem] rounded-full bg-amber-500 px-1.5 text-center text-base font-extrabold text-white">
            {waiting}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="anim-fade fixed inset-0 z-[60] flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="คิวปรึกษา"
              onKeyDown={onKeyDown}
              className="anim-slide-right flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <p className="text-lg font-bold text-slate-900">คิวปรึกษา</p>
                <button
                  type="button"
                  data-drawer-close="true"
                  onClick={() => setOpen(false)}
                  aria-label="ปิดแผงคิว"
                  className="inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-purple-50 text-purple-800 hover:bg-purple-100"
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <QueuePanel selectedId={selectedId} onPick={() => setOpen(false)} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
