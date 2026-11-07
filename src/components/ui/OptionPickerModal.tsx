import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Plus, Search } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { fieldControlClass } from './Field';
import { cn } from '../../lib/cn';

interface OptionPickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** รายการให้เลือกทั้งหมด (เรียงแล้ว) */
  options: string[];
  value: string[];
  onSave: (value: string[]) => void;
  /** คำอธิบายของแต่ละตัวเลือก สำหรับแสดงเมื่อชี้เมาส์หรือแตะดูข้อมูล */
  descriptions?: Record<string, string>;
  searchPlaceholder?: string;
  listHeading?: string;
  /** หัวข้อและช่องพิมพ์ด้านล่างสุด สำหรับรายการที่ไม่มีให้เลือก */
  customHeading?: string;
  customPlaceholder?: string;
  saveLabel?: string;
  /** ถ้าใส่ จะมีปุ่ม "ข้าม" ข้างปุ่มบันทึก (ใช้ในขั้นตอนที่ไม่บังคับ) */
  onSkip?: () => void;
  skipLabel?: string;
}

interface DialogProps extends Omit<OptionPickerModalProps, 'open'> {}

const PickerDialog: React.FC<DialogProps> = ({
  onClose,
  title,
  options,
  value,
  onSave,
  descriptions,
  searchPlaceholder = 'ค้นหา',
  listHeading = 'ทั้งหมด',
  customHeading = 'ไม่มีในรายการ? พิมพ์เพิ่มเอง',
  customPlaceholder = 'พิมพ์ชื่อที่ต้องการเพิ่ม',
  saveLabel = 'บันทึก',
  onSkip,
  skipLabel = 'ข้าม',
}) => {
  // state อยู่ในคอมโพเนนต์นี้ซึ่งสร้างใหม่ทุกครั้งที่เปิด จึงเริ่มจากค่าล่าสุดเสมอ
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState('');
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const [hovered, setHovered] = useState<{
    item: string;
    desc: string;
    rect: DOMRect;
  } | null>(null);

  const toggle = (item: string) =>
    setDraft((prev) => (prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]));

  const trimmed = query.trim();
  const filtered = useMemo(
    () => (trimmed ? options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase())) : options),
    [options, trimmed]
  );
  const customDraft = draft.filter((d) => !options.includes(d));
  const canAddFromSearch = trimmed.length > 0 && !options.includes(trimmed) && !draft.includes(trimmed);

  const addText = (text: string) => {
    const clean = text.trim();
    if (!clean || draft.includes(clean)) return;
    setDraft((prev) => [...prev, clean]);
  };

  const renderItem = (item: string) => {
    const desc = descriptions?.[item];
    const isChecked = draft.includes(item);
    const isInfoOpen = activeInfo === item;

    return (
      <li key={item} className="rounded-xl transition-colors hover:bg-slate-50/80 px-1.5 py-0.5">
        <div className="flex items-center justify-between gap-2 min-h-[44px]">
          <label
            className="flex-1 flex items-center gap-3 py-2 cursor-pointer select-none min-w-0"
            title={desc}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggle(item)}
              className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 rounded-md border-slate-400 text-purple-700 focus:ring-purple-600 focus:ring-offset-0 cursor-pointer"
            />
            <span
              className={cn(
                'text-base sm:text-lg leading-snug break-words transition-colors',
                isChecked ? 'font-semibold text-purple-950' : 'text-slate-800'
              )}
            >
              {item}
            </span>
          </label>

          {desc && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHovered(null);
                setActiveInfo((prev) => (prev === item ? null : item));
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHovered({ item, desc, rect });
              }}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'w-9 h-9 shrink-0 flex items-center justify-center rounded-full transition cursor-pointer',
                isInfoOpen
                  ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300'
                  : 'text-slate-400 hover:text-purple-700 hover:bg-purple-100/80 active:scale-95'
              )}
              aria-label={`ข้อมูลอาการ ${item}`}
              aria-expanded={isInfoOpen}
              title={desc}
            >
              <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* แถบคำอธิบายที่เปิดค้างไว้เมื่อแตะ/คลิกไอคอนข้อมูล (เหมาะกับมือถือและการอ่านละเอียด) */}
        {isInfoOpen && desc && (
          <div className="mb-2 ml-8 sm:ml-9 p-3 rounded-2xl bg-purple-50/95 border border-purple-200/90 text-purple-950 text-xs sm:text-sm leading-relaxed shadow-sm anim-pop">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs sm:text-sm">
                  <Info className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                  <span className="text-xs font-medium text-purple-700 bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-200">
                    ข้อมูลทางการแพทย์
                  </span>
                </div>
                <p className="text-slate-700 text-xs sm:text-sm leading-relaxed">{desc}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveInfo(null);
                }}
                className="px-2 py-1 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-200/70 transition-colors shrink-0 cursor-pointer"
                aria-label="ปิดคำอธิบาย"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={title}
        initialFocusSelector="input[type=search]"
        bodyLabel="รายการให้เลือก"
        onBodyScroll={() => setHovered(null)}
        headerExtra={
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search
                className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (canAddFromSearch && filtered.length === 0) {
                      addText(trimmed);
                      setQuery('');
                    }
                  }
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                className={fieldControlClass(false) + ' pl-12'}
              />
            </div>
            <p className="flex items-start gap-2 text-sm text-slate-600 leading-snug">
              <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>เลือกได้หลายรายการ ถ้าไม่เจอที่ต้องการ พิมพ์เพิ่มเองได้ที่ท้ายรายการ</span>
            </p>
            {descriptions && (
              <p className="flex items-center gap-2 text-xs sm:text-sm text-purple-900 bg-purple-50/90 border border-purple-200/80 rounded-xl px-3 py-2 leading-relaxed">
                <Info className="w-4 h-4 shrink-0 text-purple-600" aria-hidden="true" />
                <span>นำเมาส์ชี้หรือแตะที่ไอคอน ℹ️ ท้ายชื่อ เพื่อดูคำอธิบายอาการทางการแพทย์</span>
              </p>
            )}
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm sm:text-base font-semibold text-slate-700" role="status">
              เลือกแล้ว {draft.length} รายการ
            </p>
            <div className="flex items-center gap-2">
              {onSkip && (
                <Button type="button" variant="neutral" size="sm" onClick={onSkip}>
                  {skipLabel}
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => onSave(draft)} className="px-8">
                {saveLabel}
              </Button>
            </div>
          </div>
        }
      >
        <div className="py-4">
          {canAddFromSearch && (
            <button
              type="button"
              onClick={() => {
                addText(trimmed);
                setQuery('');
              }}
              className="w-full mb-3 flex items-center gap-2 min-h-[52px] px-4 rounded-2xl border border-dashed border-purple-400 bg-purple-50 text-purple-900 text-base font-semibold text-left hover:bg-purple-100 cursor-pointer"
            >
              <Plus className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span className="break-all">เพิ่ม “{trimmed}” เป็นรายการที่ระบุเอง</span>
            </button>
          )}

          {customDraft.length > 0 && !trimmed && (
            <>
              <p className="text-base font-bold text-slate-900 mb-1">ที่คุณเพิ่มเอง</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 mb-4">{customDraft.map(renderItem)}</ul>
            </>
          )}

          <p className="text-base font-bold text-slate-900 mb-1">
            {trimmed ? `ผลการค้นหา (${filtered.length})` : listHeading}
          </p>
          {filtered.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-6">{filtered.map(renderItem)}</ul>
          ) : (
            <p className="py-4 text-base text-slate-600">ไม่พบ “{trimmed}” ในรายการ พิมพ์เพิ่มเองได้ด้านล่าง</p>
          )}

          {/* ท้ายรายการ: พิมพ์รายการที่ไม่มีให้เลือก */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <label htmlFor="picker-custom" className="block text-base font-bold text-slate-900 mb-2">
              {customHeading}
            </label>
            <div className="flex gap-2">
              <input
                id="picker-custom"
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addText(custom);
                    setCustom('');
                  }
                }}
                placeholder={customPlaceholder}
                autoComplete="off"
                className={fieldControlClass(false)}
              />
              <Button
                type="button"
                variant="soft"
                size="sm"
                className="shrink-0"
                disabled={!custom.trim()}
                onClick={() => {
                  addText(custom);
                  setCustom('');
                }}
              >
                <Plus className="w-5 h-5" aria-hidden="true" />
                <span>เพิ่ม</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Floating Tooltip บน Desktop เมื่อนำเมาส์ไปชี้ไอคอน ℹ️ */}
      {hovered &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: Math.max(16, Math.min(window.innerWidth - 320, hovered.rect.left + hovered.rect.width / 2 - 160)),
              top: hovered.rect.top > 160 ? hovered.rect.top - 10 : hovered.rect.bottom + 10,
              transform: hovered.rect.top > 160 ? 'translateY(-100%)' : 'none',
              width: '300px',
              maxWidth: 'calc(100vw - 32px)',
            }}
            className="pointer-events-none z-[100] p-3 rounded-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm border border-slate-700/60 anim-pop text-left"
            role="tooltip"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-300 text-xs sm:text-sm">
                <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" aria-hidden="true" />
                <span>{hovered.item}</span>
              </div>
              <span className="text-xs font-medium text-purple-200 bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-700/50">
                ข้อมูลทางการแพทย์
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">{hovered.desc}</p>
            <p className="text-xs text-slate-400 mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between">
              <span>แตะหรือคลิก ℹ️ เพื่อเปิดค้างไว้</span>
            </p>
          </div>,
          document.body
        )}
    </>
  );
};

/** หน้าต่างเลือกหลายรายการจากรายการยาว: ค้นหาด้านบน ติ๊กเลือก และพิมพ์รายการอื่นที่ไม่มีไว้ท้ายรายการ */
export const OptionPickerModal: React.FC<OptionPickerModalProps> = ({ open, ...rest }) =>
  open ? <PickerDialog {...rest} /> : null;
