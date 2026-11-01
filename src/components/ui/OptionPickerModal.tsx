import React, { useMemo, useState } from 'react';
import { Info, Plus, Search } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { fieldControlClass } from './Field';

interface OptionPickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** รายการให้เลือกทั้งหมด (เรียงแล้ว) */
  options: string[];
  value: string[];
  onSave: (value: string[]) => void;
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

  const renderItem = (item: string) => (
    <li key={item}>
      <label className="flex items-start gap-3 min-h-[48px] py-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={draft.includes(item)}
          onChange={() => toggle(item)}
          className="mt-0.5 w-6 h-6 shrink-0 rounded-md border-slate-400 text-purple-700 focus:ring-purple-600 focus:ring-offset-0 cursor-pointer"
        />
        <span className="text-base sm:text-lg text-slate-800 leading-snug">{item}</span>
      </label>
    </li>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      initialFocusSelector="input[type=search]"
      bodyLabel="รายการให้เลือก"
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
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{filtered.map(renderItem)}</ul>
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
  );
};

/** หน้าต่างเลือกหลายรายการจากรายการยาว: ค้นหาด้านบน ติ๊กเลือก และพิมพ์รายการอื่นที่ไม่มีไว้ท้ายรายการ */
export const OptionPickerModal: React.FC<OptionPickerModalProps> = ({ open, ...rest }) =>
  open ? <PickerDialog {...rest} /> : null;
