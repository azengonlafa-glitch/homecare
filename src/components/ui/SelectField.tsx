import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, fieldControlClass } from './Field';

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectVariant = 'default' | 'pill' | 'filter';

interface SelectFieldProps {
  id: string;
  name?: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: SelectOption[];
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  variant?: SelectVariant;
}

/** ความสูงเมนูสูงสุด (เท่ากับ max-h-72) และระยะห่างจากช่อง/ขอบจอ */
const MENU_MAX_HEIGHT = 288;
const GAP = 8;
const EDGE = 8;

interface MenuPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

/**
 * Custom Dropdown สไตล์คลีน ใช้เป็นช่องเลือกมาตรฐานทั้งแอป:
 * - กล่องเมนูสีขาว ขอบมนโค้งเนียนตา (rounded-2xl) พร้อมเงาละมุน
 * - แถวตัวเลือกมีระยะขอบมน ไฮไลท์สีม่วง/ฟ้าอ่อนจางๆ สบายตา
 * - เมนูลอยอยู่นอกกรอบ (portal) จึงไม่ถูกตัดขอบเมื่อวางในหน้าต่างป๊อปอัปหรือพื้นที่เลื่อน
 *   และเปิดขึ้นด้านบนเองเมื่อที่ว่างด้านล่างไม่พอ
 * - ใช้คีย์บอร์ดได้: ลูกศรขึ้น/ลง, Home/End, Enter เลือก, Esc ปิด
 * - รองรับ variant: 'default' (ช่องฟอร์มมาตรฐาน), 'pill' (ทรงแคปซูลม่วง), 'filter' (ปุ่มตัวกรอง)
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  name,
  label,
  labelSuffix,
  hint,
  error,
  hideLabel,
  options,
  placeholder,
  value,
  onChange,
  className,
  disabled = false,
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  // ตัวเลือกค่าว่าง (เช่น "เลือกจังหวัด") แสดงเป็นข้อความจาง เหมือนยังไม่ได้เลือก
  const isPlaceholder = !selectedOption || selectedOption.value === '';
  const displayPlaceholder = placeholder ?? (options[0]?.label ?? 'เลือก...');

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  /** คำนวณตำแหน่งเมนูจากตำแหน่งของช่องบนหน้าจอ (เปิดขึ้นบนถ้าด้านล่างไม่พอ) */
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const room = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, room));

    // เมนูควรกว้างอย่างน้อย 190px แต่ไม่ล้นหน้าจอ
    const targetWidth = Math.max(rect.width, variant !== 'default' ? 190 : rect.width);
    const width = Math.min(targetWidth, window.innerWidth - EDGE * 2);
    let left = rect.left;
    if (left + width > window.innerWidth - EDGE) {
      left = Math.max(EDGE, window.innerWidth - EDGE - width);
    }

    setPosition({
      left,
      width,
      maxHeight,
      ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    });
  }, [variant]);

  // วางเมนูก่อนวาดหน้าจอ กันเมนูกระพริบ และตามช่องไปเมื่อหน้าจอเลื่อน/ย่อขยาย
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
    const onScroll = (event: Event) => {
      // เลื่อนรายการในเมนูเอง ไม่ต้องย้ายตำแหน่ง
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      updatePosition();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, updatePosition]);

  // ปิดเมนูเมื่อคลิกนอกพื้นที่ หรือกดปุ่ม Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };

    // ดักตั้งแต่ขั้นตอน capture เพื่อปิดเฉพาะเมนู ไม่ให้ Esc ไปปิดหน้าต่างป๊อปอัปที่ครอบอยู่ด้วย
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, closeMenu]);

  // เลื่อนรายการที่เลือก/ไฮไลต์ให้อยู่ในมุมมอง (ตอนเปิดจะเลื่อนไปที่ค่าที่เลือกไว้)
  useEffect(() => {
    if (!isOpen || !position || activeIndex < 0) return;
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, position, activeIndex]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    closeMenu();
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
        if (activeIndex >= 0 && options[activeIndex]) {
          event.preventDefault();
          handleSelect(options[activeIndex].value);
        }
        break;
      case 'Tab':
        closeMenu();
        break;
      default:
        break;
    }
  };

  const triggerClasses = () => {
    if (variant === 'pill') {
      return cn(
        'min-h-[44px] px-4 py-2 bg-white border border-purple-200 rounded-full text-base font-bold text-purple-900 shadow-2xs inline-flex items-center justify-between gap-2.5 cursor-pointer hover:border-purple-300 transition text-left',
        isOpen && 'ring-2 ring-purple-600 border-transparent',
        disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
        className
      );
    }
    if (variant === 'filter') {
      return cn(
        'min-h-[44px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm sm:text-base font-bold text-slate-800 shadow-2xs inline-flex items-center justify-between gap-2 cursor-pointer hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition text-left',
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

  const labelClasses = () => {
    if (variant === 'pill') {
      return cn('truncate text-base font-bold', isPlaceholder ? 'text-purple-400' : 'text-purple-900');
    }
    if (variant === 'filter') {
      return cn('truncate text-sm sm:text-base font-bold text-slate-800');
    }
    return cn('truncate text-base sm:text-lg', isPlaceholder ? 'text-slate-600' : 'text-slate-900 font-semibold');
  };

  const chevronClasses = () => {
    if (variant === 'pill') {
      return cn('w-4 h-4 text-purple-800 shrink-0 transition-transform duration-200', isOpen && 'rotate-180');
    }
    if (variant === 'filter') {
      return cn('w-4 h-4 text-slate-600 shrink-0 transition-transform duration-200', isOpen && 'rotate-180 text-purple-700');
    }
    return cn('w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200', isOpen && 'rotate-180 text-purple-700');
  };

  const renderContent = () => (
    <div className="relative inline-block w-full">
      {name && <input type="hidden" name={name} value={value} />}

      {/* ช่องกดเลือก (Trigger) */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
        className={triggerClasses()}
      >
        <span className={labelClasses()}>
          {selectedOption ? selectedOption.label : displayPlaceholder}
        </span>
        <ChevronDown className={chevronClasses()} aria-hidden="true" />
      </button>

      {/* เมนูลอยสไตล์คลีน วางผ่าน portal เพื่อไม่ให้ถูกตัดขอบ */}
      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={id}
            tabIndex={-1}
            style={{
              position: 'fixed',
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: position.maxHeight,
            }}
            className="anim-drop-in z-[70] overflow-y-auto overscroll-contain bg-[#FFFDF7] rounded-2xl border border-white ring-1 ring-slate-200 shadow-[0_18px_34px_-14px_rgba(14,74,39,0.45)] p-1.5"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={option.value}
                  id={`${id}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  // กันช่องเสียโฟกัสก่อนคลิกเลือก
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 my-0.5 rounded-xl text-sm sm:text-base font-medium cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-purple-100/70 text-purple-950 font-semibold'
                      : isActive
                        ? 'bg-slate-100/80 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="w-4 h-4 sm:w-5 sm:h-5 text-purple-700 shrink-0 ml-2" aria-hidden="true" />}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );

  if (variant !== 'default' && hideLabel) {
    return (
      <div className="relative inline-block max-w-full">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {renderContent()}
      </div>
    );
  }

  return (
    <Field id={id} label={label} labelSuffix={labelSuffix} hint={hint} error={error} hideLabel={hideLabel}>
      {renderContent()}
    </Field>
  );
};

export interface PillSelectProps {
  id: string;
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/** ช่องเลือกแบบทรงเม็ดยา สไตล์ละมุนขอบมน ใช้ในโมดอลปฏิทินและแถบตัวกรอง */
export const PillSelect: React.FC<PillSelectProps> = ({
  id,
  label,
  value,
  options,
  onChange,
  className,
  disabled,
}) => {
  const items = options.map((o) => ({ value: String(o.value), label: o.label }));
  return (
    <SelectField
      id={id}
      label={label}
      hideLabel
      variant="pill"
      options={items}
      value={String(value)}
      onChange={onChange}
      className={className}
      disabled={disabled}
    />
  );
};
