import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, RotateCcw, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, fieldControlClass } from './Field';

export type TimePickerVariant = 'default' | 'pill' | 'compact';

export interface TimePickerProps {
  id?: string;
  name?: string;
  value: string; // "HH:MM" หรือ ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: TimePickerVariant;
  ariaLabel?: string;
}

export interface TimeFieldProps extends TimePickerProps {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const PRESETS = [
  { label: 'เช้า', time: '08:00' },
  { label: 'กลางวัน', time: '12:00' },
  { label: 'เย็น', time: '18:00' },
  { label: 'ก่อนนอน', time: '21:00' },
];

const POPUP_HEIGHT = 380;
const GAP = 8;
const EDGE = 8;

interface PopupPosition {
  left: number;
  top?: number;
  bottom?: number;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = '--:-- น.',
  disabled = false,
  className,
  variant = 'default',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopupPosition | null>(null);

  // ค่าชั่วโมงและนาทีชั่วคราวขณะเปิดป๊อปอัป
  const parseTime = (val: string) => {
    if (!val || !val.includes(':')) {
      const now = new Date();
      return {
        h: String(now.getHours()).padStart(2, '0'),
        m: String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0'),
        hasValue: false,
      };
    }
    const [h, m] = val.split(':');
    return {
      h: (h ?? '08').padStart(2, '0'),
      m: (m ?? '00').padStart(2, '0'),
      hasValue: true,
    };
  };

  const parsed = parseTime(value);
  const [selectedH, setSelectedH] = useState(parsed.h);
  const [selectedM, setSelectedM] = useState(parsed.m);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoursColRef = useRef<HTMLDivElement>(null);
  const minutesColRef = useRef<HTMLDivElement>(null);

  // เมื่อเปิดป๊อปอัป ให้รีเซ็ตเวลาเลือกให้ตรงกับ value ปัจจุบัน
  useEffect(() => {
    if (isOpen) {
      const p = parseTime(value);
      setSelectedH(p.h);
      setSelectedM(p.m);
    }
  }, [isOpen, value]);

  const close = useCallback(() => setIsOpen(false), []);

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  // คำนวณตำแหน่งป๊อปอัป
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    const openUp = spaceBelow < POPUP_HEIGHT && spaceAbove > spaceBelow;

    const popupWidth = 280;
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

  // ปิดเมื่อคลิกข้างนอกหรือกด Escape
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

  // เลื่อนชั่วโมงและนาทีที่เลือกให้อยู่กึ่งกลางมุมมองเมื่อเปิด
  useEffect(() => {
    if (!isOpen || !position) return;
    const scrollHour = hoursColRef.current?.querySelector<HTMLElement>(`[data-hour="${selectedH}"]`);
    scrollHour?.scrollIntoView({ block: 'center' });
    const scrollMin = minutesColRef.current?.querySelector<HTMLElement>(`[data-min="${selectedM}"]`);
    scrollMin?.scrollIntoView({ block: 'center' });
  }, [isOpen, position]);

  const commitTime = (h: string, m: string) => {
    onChange(`${h}:${m}`);
  };

  const handleApply = () => {
    commitTime(selectedH, selectedM);
    close();
  };

  const handleClear = () => {
    onChange('');
    close();
  };

  const handleNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    setSelectedH(h);
    setSelectedM(m);
    commitTime(h, m);
    close();
  };

  const handlePreset = (presetTime: string) => {
    const [h, m] = presetTime.split(':');
    setSelectedH(h);
    setSelectedM(m);
    commitTime(h, m);
    close();
  };

  const displayText = value ? `${value} น.` : placeholder;

  const triggerClasses = () => {
    if (variant === 'pill') {
      return cn(
        'min-h-[44px] px-4 py-2 bg-white border border-purple-200 rounded-full font-bold text-purple-900 shadow-2xs inline-flex items-center gap-2 cursor-pointer hover:border-purple-300 transition text-left',
        isOpen && 'ring-2 ring-purple-600 border-transparent',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
        className
      );
    }
    if (variant === 'compact') {
      return cn(
        'min-h-[44px] px-3.5 py-1.5 bg-white border border-purple-200 rounded-full text-base font-bold text-purple-900 inline-flex items-center gap-2 cursor-pointer shadow-2xs hover:border-purple-300 transition text-left',
        isOpen && 'ring-2 ring-purple-600 border-transparent',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
        className
      );
    }
    return cn(
      fieldControlClass(false),
      'w-full flex items-center justify-between text-left cursor-pointer transition',
      isOpen && 'ring-2 ring-purple-600 border-transparent',
      disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
      className
    );
  };

  return (
    <div className="relative inline-block max-w-full">
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel ?? (id ? undefined : 'เลือกเวลา')}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        className={triggerClasses()}
      >
        <span className={cn('truncate', !value && 'text-purple-400')}>{displayText}</span>
        <Clock className="w-4 h-4 text-purple-700 shrink-0" aria-hidden="true" />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            role="dialog"
            aria-label="เลือกเวลา"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              bottom: position.bottom,
              width: 290,
            }}
            className="anim-drop-in z-[70] bg-[#FFFDF7] rounded-3xl border border-white ring-1 ring-slate-200 shadow-[0_20px_40px_-12px_rgba(14,74,39,0.35)] p-4 text-slate-800"
          >
            {/* หัวข้อแสดงเวลาปัจจุบัน */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">เลือกเวลา (24 ชม.)</div>
                  <div className="text-xl font-extrabold text-purple-950 tracking-wide">
                    {selectedH} : {selectedM} น.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="ปิด"
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ทางลัดช่วงเวลา */}
            <div className="grid grid-cols-4 gap-1.5 my-3">
              {PRESETS.map((p) => {
                const isSelected = value === p.time;
                return (
                  <button
                    key={p.time}
                    type="button"
                    onClick={() => handlePreset(p.time)}
                    className={cn(
                      'py-1.5 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center',
                      isSelected
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-purple-50/70 text-purple-900 hover:bg-purple-100'
                    )}
                  >
                    <div>{p.label}</div>
                    <div className="text-[10px] font-normal opacity-80">{p.time}</div>
                  </button>
                );
              })}
            </div>

            {/* คอลัมน์เลือกชั่วโมงและนาที */}
            <div className="grid grid-cols-2 gap-2 py-1 border-t border-b border-slate-100">
              {/* ชั่วโมง */}
              <div>
                <div className="text-xs font-bold text-slate-500 text-center mb-1">ชั่วโมง</div>
                <div
                  ref={hoursColRef}
                  className="h-44 overflow-y-auto overscroll-contain space-y-1 pr-1 scrollbar-thin"
                >
                  {HOURS.map((h) => {
                    const isSel = h === selectedH;
                    return (
                      <button
                        key={h}
                        type="button"
                        data-hour={h}
                        onClick={() => {
                          setSelectedH(h);
                          commitTime(h, selectedM);
                        }}
                        className={cn(
                          'w-full py-1.5 rounded-xl text-sm font-semibold transition cursor-pointer text-center',
                          isSel
                            ? 'bg-purple-700 text-white shadow-xs font-bold'
                            : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* นาที */}
              <div>
                <div className="text-xs font-bold text-slate-500 text-center mb-1">นาที</div>
                <div
                  ref={minutesColRef}
                  className="h-44 overflow-y-auto overscroll-contain space-y-1 pr-1 scrollbar-thin"
                >
                  {MINUTES.map((m) => {
                    const isSel = m === selectedM;
                    const isStep5 = Number(m) % 5 === 0;
                    return (
                      <button
                        key={m}
                        type="button"
                        data-min={m}
                        onClick={() => {
                          setSelectedM(m);
                          commitTime(selectedH, m);
                        }}
                        className={cn(
                          'w-full py-1.5 rounded-xl text-sm transition cursor-pointer text-center',
                          isSel
                            ? 'bg-purple-700 text-white shadow-xs font-bold'
                            : isStep5
                              ? 'text-slate-900 font-semibold hover:bg-slate-100'
                              : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* แถบล่าง: ตอนนี้ / ล้างค่า / ตกลง */}
            <div className="flex items-center justify-between gap-2 pt-3">
              <button
                type="button"
                onClick={handleNow}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-xl cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                ตอนนี้
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl cursor-pointer transition"
                >
                  ล้างค่า
                </button>
              )}
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl cursor-pointer transition shadow-xs ml-auto"
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

export const TimeField: React.FC<TimeFieldProps> = ({
  id,
  label,
  labelSuffix,
  hint,
  error,
  hideLabel,
  ...pickerProps
}) => (
  <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error} hideLabel={hideLabel}>
    <TimePicker id={id} {...pickerProps} />
  </Field>
);

