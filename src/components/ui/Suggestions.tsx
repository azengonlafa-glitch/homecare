import React, { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

/** คำแนะนำที่ขึ้นใต้ช่องพิมพ์ */
export interface Suggestion {
  value: string;
  /** คำอธิบายสั้น ๆ ใต้ชื่อ */
  detail?: string;
  /** คำที่ใช้ค้นหาเพิ่ม (เช่น ชื่อภาษาอังกฤษ) */
  keywords?: string;
}

export type SuggestionItem = string | Suggestion;

const toSuggestion = (item: SuggestionItem): Suggestion => (typeof item === 'string' ? { value: item } : item);
const norm = (s: string) => s.trim().toLowerCase();

/** กรองคำแนะนำตามที่พิมพ์ (ขึ้นต้นด้วยคำที่พิมพ์ก่อน แล้วค่อยตามด้วยที่มีคำนั้นอยู่ตรงกลาง) */
export function filterSuggestions(items: SuggestionItem[], query: string, limit = 6): Suggestion[] {
  const q = norm(query);
  if (!q) return [];
  const starts: Suggestion[] = [];
  const contains: Suggestion[] = [];
  for (const raw of items) {
    const item = toSuggestion(raw);
    const value = norm(item.value);
    if (value === q) continue; // พิมพ์ตรงกับคำแนะนำแล้ว ไม่ต้องแสดงซ้ำ
    const haystack = `${value} ${norm(item.keywords ?? '')}`;
    if (value.startsWith(q)) starts.push(item);
    else if (haystack.includes(q)) contains.push(item);
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * ใช้กับช่องพิมพ์ใด ๆ: คืนรายการที่กรองแล้ว สถานะเปิด/ปิด และตัวช่วยคีย์บอร์ด
 * mode "list" = พิมพ์หลายคำคั่นด้วยจุลภาค แนะนำเฉพาะคำสุดท้ายที่กำลังพิมพ์
 */
export function useSuggestions(
  items: SuggestionItem[] | undefined,
  value: string,
  mode: 'replace' | 'list' = 'replace'
) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const query = mode === 'list' ? value.slice(value.lastIndexOf(',') + 1) : value;

  const results = useMemo(
    () => (items && focused ? filterSuggestions(items, query) : []),
    [items, focused, query]
  );

  /** ข้อความใหม่ของช่องเมื่อเลือกคำแนะนำ */
  const apply = (picked: string) => {
    if (mode !== 'list') return picked;
    const head = value.slice(0, value.lastIndexOf(',') + 1).trim();
    return head ? `${head} ${picked}` : picked;
  };

  return {
    results,
    active: Math.min(active, results.length - 1),
    setActive,
    onFocus: () => setFocused(true),
    onBlur: () => window.setTimeout(() => setFocused(false), 150),
    close: () => setFocused(false),
    apply,
  };
}

interface SuggestionListProps {
  id: string;
  items: Suggestion[];
  active: number;
  onPick: (value: string) => void;
}

/** กล่องคำแนะนำ (วางในกล่องที่เป็น relative) */
export const SuggestionList: React.FC<SuggestionListProps> = ({ id, items, active, onPick }) => {
  if (items.length === 0) return null;
  return (
    <ul
      id={`${id}-suggestions`}
      role="listbox"
      aria-label="คำแนะนำ"
      className="absolute left-0 right-0 top-full z-40 mt-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl"
    >
      {items.map((s, i) => (
        <li key={s.value}>
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            // กันช่องพิมพ์เสียโฟกัสก่อนคลิกสำเร็จ
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(s.value)}
            className={cn(
              'flex w-full flex-col items-start rounded-xl px-3 py-2 text-left cursor-pointer hover:bg-purple-50',
              i === active && 'bg-purple-50'
            )}
          >
            <span className="text-base font-bold text-slate-900">{s.value}</span>
            {s.detail && <span className="text-sm text-slate-600">{s.detail}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
};

/** ใส่ค่าลงช่อง input แล้วให้ onChange ของ React ทำงานตามปกติ (ไม่ต้องแก้โค้ดฝั่งที่เรียกใช้) */
export function setNativeInputValue(input: HTMLInputElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
