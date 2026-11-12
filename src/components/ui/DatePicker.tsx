import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, fieldControlClass } from './Field';

export type DatePickerVariant = 'default' | 'pill' | 'compact';

export interface DatePickerProps {
  id?: string;
  name?: string;
  value: string; // "YYYY-MM-DD" หรือ ""
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string; // "YYYY-MM-DD"
  max?: string; // "YYYY-MM-DD"
  disabled?: boolean;
  className?: string;
  variant?: DatePickerVariant;
  ariaLabel?: string;
  error?: string;
}

export interface DateFieldProps extends DatePickerProps {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export interface DateTimePickerProps extends Omit<DatePickerProps, 'value' | 'onChange'> {
  value: string; // "YYYY-MM-DDTHH:MM" หรือ ""
  onChange: (value: string) => void;
}

export interface DateTimeFieldProps extends DateTimePickerProps {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

export const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

const WEEKDAYS = [
  { short: 'อา.', full: 'วันอาทิตย์', isWeekend: true },
  { short: 'จ.', full: 'วันจันทร์', isWeekend: false },
  { short: 'อ.', full: 'วันอังคาร', isWeekend: false },
  { short: 'พ.', full: 'วันพุธ', isWeekend: false },
  { short: 'พฤ.', full: 'วันพฤหัสบดี', isWeekend: false },
  { short: 'ศ.', full: 'วันศุกร์', isWeekend: false },
  { short: 'ส.', full: 'วันเสาร์', isWeekend: true },
];

/** แปลง "YYYY-MM-DD" เป็นข้อความไทย เช่น "12 พ.ย. 2569" */
export function formatThaiDate(dateStr: string, mode: 'short' | 'full' = 'short'): string {
  if (!dateStr || !dateStr.includes('-')) return '';
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return dateStr;
  const monthName = mode === 'full' ? THAI_MONTHS_FULL[m - 1] : THAI_MONTHS_SHORT[m - 1];
  const thaiYear = y + 543;
  return `${d} ${monthName} ${thaiYear}`;
}

/** แปลง "YYYY-MM-DDTHH:MM" เป็นข้อความไทย เช่น "12 พ.ย. 2569 09:30 น." */
export function formatThaiDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  const [datePart, timePart] = dateTimeStr.split('T');
  if (!datePart) return dateTimeStr;
  const dateText = formatThaiDate(datePart, 'short');
  if (!timePart) return dateText;
  return `${dateText} เวลา ${timePart} น.`;
}

/** จัดการปี ค.ศ. เป็น พ.ศ. */
export const toThaiYear = (ceYear: number) => ceYear + 543;
export const toCeYear = (beYear: number) => beYear - 543;

const POPUP_HEIGHT = 420;
const GAP = 8;
const EDGE = 8;

interface PopupPosition {
  left: number;
  top?: number;
  bottom?: number;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'วว/ดด/ปปปป',
  min,
  max,
  disabled = false,
  className,
  variant = 'default',
  ariaLabel,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopupPosition | null>(null);

  // สถานะมุมมองปฏิทิน: เดือน/ปี ที่กำลังดูอยู่
  const today = useMemo(() => new Date(), []);
  const initialDate = useMemo(() => {
    if (value && value.includes('-')) {
      const [y, m, d] = value.split('-').map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return today;
  }, [value, today]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-11
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);

  // เมื่อเปิด ให้ไปที่เดือนของค่าที่เลือกอยู่
  useEffect(() => {
    if (isOpen) {
      if (value && value.includes('-')) {
        const [y, m] = value.split('-').map(Number);
        if (y && m) {
          setViewYear(y);
          setViewMonth(m - 1);
        }
      } else {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }
      setIsYearPickerOpen(false);
    }
  }, [isOpen, value, today]);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsYearPickerOpen(false);
  }, []);

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    const openUp = spaceBelow < POPUP_HEIGHT && spaceAbove > spaceBelow;

    const popupWidth = 320;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - EDGE) {
      left = Math.max(EDGE, window.innerWidth - EDGE - popupWidth);
    }

    setPosition({
      left,
      ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
    const onScroll = (e: Event) => {
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) return;
      updatePosition();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, close]);

  // เลื่อนปีที่เลือกให้อยู่กลางจอเมื่อเปิด year picker
  useEffect(() => {
    if (isYearPickerOpen) {
      const activeEl = yearListRef.current?.querySelector<HTMLElement>(`[data-year="${viewYear}"]`);
      activeEl?.scrollIntoView({ block: 'center' });
    }
  }, [isYearPickerOpen, viewYear]);

  // คำนวณตารางวันในเดือน
  const daysInMonth = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthLastDate = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // วันของเดือนก่อนหน้าเพื่อเติมแถวแรก
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDisabled = (!!min && dateStr < min) || (!!max && dateStr > max);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isDisabled,
        isToday: false,
        isSelected: dateStr === value,
      });
    }

    // วันของเดือนปัจจุบัน
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDisabled = (!!min && dateStr < min) || (!!max && dateStr > max);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isDisabled,
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // วันของเดือนถัดไปเพื่อเติมให้ครบแถว (รวมเป็นจำนวนเท่าของ 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isDisabled = (!!min && dateStr < min) || (!!max && dateStr > max);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isDisabled,
        isToday: false,
        isSelected: dateStr === value,
      });
    }

    return cells;
  }, [viewYear, viewMonth, min, max, value, today]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    close();
  };

  const handleToday = () => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    onChange(todayStr);
    close();
  };

  const handleClear = () => {
    onChange('');
    close();
  };

  const displayText = value ? formatThaiDate(value, 'short') : placeholder;

  const triggerClasses = () => {
    if (variant === 'pill') {
      return cn(
        'min-h-[44px] px-4 py-2 bg-white border border-purple-200 rounded-full font-bold text-purple-900 shadow-2xs inline-flex items-center justify-between gap-2.5 cursor-pointer hover:border-purple-300 transition text-left',
        isOpen && 'ring-2 ring-purple-600 border-transparent',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
        className
      );
    }
    if (variant === 'compact') {
      return cn(
        'min-h-[44px] px-3.5 py-1.5 bg-white border border-slate-300 rounded-xl text-sm sm:text-base font-bold text-slate-800 inline-flex items-center justify-between gap-2 cursor-pointer shadow-2xs hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition text-left',
        isOpen && 'ring-2 ring-purple-600 border-transparent',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
        className
      );
    }
    return cn(
      fieldControlClass(!!error),
      'w-full flex items-center justify-between text-left cursor-pointer transition',
      isOpen && 'ring-2 ring-purple-600 border-transparent',
      disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
      className
    );
  };

  // รายการปีให้เลือกด่วน (ย้อนหลัง 100 ปี - ล่วงหน้า 20 ปี)
  const years = useMemo(() => {
    const curCe = today.getFullYear();
    const list: number[] = [];
    for (let y = curCe - 100; y <= curCe + 25; y++) {
      list.push(y);
    }
    return list;
  }, [today]);

  return (
    <div className="relative inline-block max-w-full">
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel ?? (id ? undefined : 'เลือกวันที่')}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        className={triggerClasses()}
      >
        <span className={cn('truncate', !value && (variant === 'pill' ? 'text-purple-400' : 'text-slate-500'))}>
          {displayText}
        </span>
        <CalendarIcon
          className={cn(
            'w-4 h-4 shrink-0',
            variant === 'pill' ? 'text-purple-700' : 'text-slate-500'
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label="ปฏิทินเลือกวันที่"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: 320,
            }}
            className="anim-drop-in z-[70] bg-[#FFFDF7] rounded-3xl border border-white ring-1 ring-slate-200 shadow-[0_20px_45px_-12px_rgba(14,74,39,0.35)] p-4 text-slate-800"
          >
            {/* ส่วนหัว: เดือนและปี พ.ศ. พร้อมปุ่มเลือก */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="เดือนก่อนหน้า"
                className="w-8 h-8 rounded-full text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsYearPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-purple-50 text-base font-extrabold text-purple-950 transition cursor-pointer"
              >
                <span>{THAI_MONTHS_FULL[viewMonth]}</span>
                <span className="text-purple-800">{toThaiYear(viewYear)}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-purple-700 transition-transform duration-200',
                    isYearPickerOpen && 'rotate-180'
                  )}
                />
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="เดือนถัดไป"
                className="w-8 h-8 rounded-full text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* กล่องเลือกเดือนและปีแบบรวดเร็ว (เมื่อคลิกที่หัวข้อ) */}
            {isYearPickerOpen ? (
              <div className="py-2">
                <div className="text-xs font-bold text-slate-500 mb-2 text-center">เลือกเดือนและปี พ.ศ.</div>
                {/* ตารางเลือกเดือน 12 เดือน */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {THAI_MONTHS_SHORT.map((mShort, idx) => {
                    const isSel = idx === viewMonth;
                    return (
                      <button
                        key={mShort}
                        type="button"
                        onClick={() => {
                          setViewMonth(idx);
                        }}
                        className={cn(
                          'py-1.5 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center',
                          isSel
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'bg-purple-50/70 text-purple-950 hover:bg-purple-100'
                        )}
                      >
                        {mShort}
                      </button>
                    );
                  })}
                </div>

                {/* รายการปี พ.ศ. เลื่อนได้ */}
                <div className="text-xs font-bold text-slate-500 mb-1 text-center">ปี พ.ศ.</div>
                <div
                  ref={yearListRef}
                  className="h-40 overflow-y-auto overscroll-contain grid grid-cols-3 gap-1.5 p-1 border rounded-2xl border-slate-200 bg-white"
                >
                  {years.map((y) => {
                    const isSel = y === viewYear;
                    return (
                      <button
                        key={y}
                        type="button"
                        data-year={y}
                        onClick={() => {
                          setViewYear(y);
                          setIsYearPickerOpen(false);
                        }}
                        className={cn(
                          'py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center',
                          isSel
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'text-slate-800 hover:bg-purple-50'
                        )}
                      >
                        {toThaiYear(y)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* แถวชื่อวันในสัปดาห์ */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w.short}
                      className={cn(
                        'text-xs font-bold py-1',
                        w.isWeekend ? 'text-purple-900/80' : 'text-slate-500'
                      )}
                    >
                      {w.short}
                    </div>
                  ))}
                </div>

                {/* ตารางวันในเดือน */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {daysInMonth.map((cell) => {
                    const isDisabled = cell.isDisabled;
                    const isSelected = cell.isSelected;
                    const isToday = cell.isToday;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectDate(cell.dateStr)}
                        className={cn(
                          'h-9 w-full rounded-xl text-sm font-semibold transition cursor-pointer flex items-center justify-center relative',
                          isDisabled && 'opacity-25 cursor-not-allowed hover:bg-transparent',
                          isSelected &&
                            'bg-purple-700 text-white font-extrabold shadow-sm scale-105 z-10',
                          !isSelected && cell.isCurrentMonth && 'text-slate-900 hover:bg-purple-100',
                          !isSelected && !cell.isCurrentMonth && 'text-slate-400 hover:bg-slate-100',
                          isToday && !isSelected && 'ring-2 ring-purple-600/60 font-bold text-purple-900'
                        )}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>

                {/* แถบล่าง: วันนี้ / ล้างค่า */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleToday}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-xl cursor-pointer transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    วันนี้
                  </button>

                  {value && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl cursor-pointer transition"
                    >
                      ล้างค่า
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={close}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition ml-auto"
                  >
                    ปิด
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export const DateField: React.FC<DateFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  hideLabel,
  ...pickerProps
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error} hideLabel={hideLabel}>
    <DatePicker id={id} error={error} {...pickerProps} />
  </Field>
);

export const PillDatePicker: React.FC<DatePickerProps> = (props) => (
  <DatePicker {...props} variant="pill" />
);

/**
 * DateTimePicker: เลือกวันที่และเวลา (YYYY-MM-DDTHH:MM)
 */
export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'เลือกวันที่และเวลา',
  min,
  max,
  disabled = false,
  className,
  variant: _variant = 'default',
  ariaLabel,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopupPosition | null>(null);

  // แยก date และ time
  const [curDate, curTime] = value ? value.split('T') : ['', ''];
  const [selectedDate, setSelectedDate] = useState(curDate || '');
  const [selectedH, setSelectedH] = useState(curTime ? curTime.split(':')[0] ?? '08' : '08');
  const [selectedM, setSelectedM] = useState(curTime ? curTime.split(':')[1] ?? '00' : '00');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (value && value.includes('T')) {
        const [d, t] = value.split('T');
        setSelectedDate(d || '');
        if (t) {
          const [h, m] = t.split(':');
          setSelectedH(h || '08');
          setSelectedM(m || '00');
        }
      } else {
        const now = new Date();
        setSelectedDate(
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        );
        setSelectedH(String(now.getHours()).padStart(2, '0'));
        setSelectedM(String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0'));
      }
    }
  }, [isOpen, value]);

  const close = useCallback(() => setIsOpen(false), []);
  const open = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    const openUp = spaceBelow < 480 && spaceAbove > spaceBelow;

    const popupWidth = 330;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - EDGE) {
      left = Math.max(EDGE, window.innerWidth - EDGE - popupWidth);
    }

    setPosition({
      left,
      ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
    const onScroll = (e: Event) => {
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) return;
      updatePosition();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, close]);

  const handleApply = () => {
    if (!selectedDate) {
      close();
      return;
    }
    onChange(`${selectedDate}T${selectedH.padStart(2, '0')}:${selectedM.padStart(2, '0')}`);
    close();
  };

  const handleClear = () => {
    onChange('');
    close();
  };

  const displayText = value ? formatThaiDateTime(value) : placeholder;

  return (
    <div className="relative inline-block w-full">
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel ?? (id ? undefined : 'เลือกวันที่และเวลา')}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        className={cn(
          fieldControlClass(!!error),
          'w-full flex items-center justify-between text-left cursor-pointer transition',
          isOpen && 'ring-2 ring-purple-600 border-transparent',
          disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
          className
        )}
      >
        <span className={cn('truncate', !value && 'text-slate-500')}>{displayText}</span>
        <div className="flex items-center gap-1.5 text-slate-500">
          <CalendarIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <Clock className="w-4 h-4 shrink-0 text-purple-700" aria-hidden="true" />
        </div>
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label="เลือกวันที่และเวลา"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: 330,
            }}
            className="anim-drop-in z-[70] bg-[#FFFDF7] rounded-3xl border border-white ring-1 ring-slate-200 shadow-[0_20px_45px_-12px_rgba(14,74,39,0.35)] p-4 text-slate-800"
          >
            {/* เลือกวันที่ */}
            <div className="mb-3">
              <div className="text-xs font-bold text-slate-500 mb-1.5">1. วันที่</div>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                min={min ? min.split('T')[0] : undefined}
                max={max ? max.split('T')[0] : undefined}
                className="w-full"
              />
            </div>

            {/* เลือกเวลา */}
            <div className="pt-2 border-t border-slate-100 mb-3">
              <div className="text-xs font-bold text-slate-500 mb-1.5">2. เวลา (24 ชม.)</div>
              <div className="flex items-center justify-center gap-2 bg-purple-50/70 p-2.5 rounded-2xl">
                <Clock className="w-4 h-4 text-purple-700 shrink-0" />
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={selectedH}
                  onChange={(e) => {
                    const num = Math.max(0, Math.min(23, Number(e.target.value) || 0));
                    setSelectedH(String(num).padStart(2, '0'));
                  }}
                  className="w-14 text-center py-1.5 px-1 bg-white border border-purple-200 rounded-xl text-base font-extrabold text-purple-950 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <span className="text-base font-extrabold text-purple-900">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={selectedM}
                  onChange={(e) => {
                    const num = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                    setSelectedM(String(num).padStart(2, '0'));
                  }}
                  className="w-14 text-center py-1.5 px-1 bg-white border border-purple-200 rounded-xl text-base font-extrabold text-purple-950 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <span className="text-sm font-bold text-purple-900">น.</span>
              </div>
            </div>

            {/* แถบล่าง */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl cursor-pointer transition"
                >
                  ล้างค่า
                </button>
              )}
              <button
                type="button"
                onClick={close}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition ml-auto"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl cursor-pointer transition shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                ตกลง
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export const DateTimeField: React.FC<DateTimeFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  hideLabel,
  ...pickerProps
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error} hideLabel={hideLabel}>
    <DateTimePicker id={id} error={error} {...pickerProps} />
  </Field>
);
