import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { FieldGroup } from './ChoiceChips';

interface ConditionPickerProps {
  id: string;
  label: string;
  hint?: string;
  /** รายการให้เลือกทั้งหมด (เรียงแล้ว) */
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  /** คงไว้ให้โค้ดเดิมเรียกได้ ไม่ได้ใช้แล้ว */
  modalTitle?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

const SHOWN = 10;

/**
 * เลือกโรคแบบไม่ต้องเปิดหน้าต่าง: มีช่องค้นหาให้พิมพ์ทันที ใต้ช่องมีรายการให้กดเลือก
 * ถ้าไม่มีในรายการ กด "เพิ่ม" หรือ Enter เพื่อใช้ข้อความที่พิมพ์
 */
export const ConditionPicker: React.FC<ConditionPickerProps> = ({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  searchPlaceholder = 'พิมพ์ชื่อโรคเพื่อค้นหา เช่น เบาหวาน ความดัน',
  disabled,
}) => {
  const [query, setQuery] = useState('');
  const q = query.trim();

  const matches = useMemo(() => {
    const left = options.filter((o) => !value.includes(o));
    const found = q ? left.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : left;
    return found.slice(0, SHOWN);
  }, [options, value, q]);

  const exact = options.some((o) => o.toLowerCase() === q.toLowerCase()) || value.some((v) => v.toLowerCase() === q.toLowerCase());

  const add = (item: string) => {
    if (!item || value.includes(item)) return;
    onChange([...value, item]);
    setQuery('');
  };

  return (
    <FieldGroup label={label} hint={hint}>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`${label} ที่เลือกไว้`}>
          {value.map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-1 pl-4 pr-1 min-h-[44px] rounded-full bg-purple-100 text-purple-900 text-base font-semibold"
            >
              <span>{item}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== item))}
                aria-label={`ลบ ${item}`}
                className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-purple-200 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          id={id}
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q) {
              e.preventDefault();
              add(matches.find((m) => m.toLowerCase() === q.toLowerCase()) ?? q);
            }
          }}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="min-h-[52px] w-full rounded-full border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-500 focus:border-purple-700 focus:outline-none disabled:opacity-50"
        />
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="กดเลือกจากรายการ">
          {!q && <p className="w-full text-sm text-slate-600">กดเลือกได้เลย หรือพิมพ์ค้นหาด้านบน</p>}
          {matches.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => add(o)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-base font-semibold text-slate-800 hover:bg-purple-50 cursor-pointer"
            >
              <Plus className="h-4 w-4 text-purple-700" aria-hidden="true" />
              {o}
            </button>
          ))}
          {q && !exact && (
            <button
              type="button"
              onClick={() => add(q)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-purple-700 px-4 text-base font-bold text-white cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              เพิ่ม “{q}”
            </button>
          )}
          {q && matches.length === 0 && exact && <p className="text-sm text-slate-600">เลือกรายการนี้ไว้แล้ว</p>}
        </div>
      )}
    </FieldGroup>
  );
};
