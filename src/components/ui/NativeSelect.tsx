import React from 'react';
import { SelectField } from './SelectField';

interface NativeSelectProps {
  id: string;
  label: string;
  labelSuffix?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * ช่องเลือกแบบรายการ (ชื่อเดิมคงไว้เพื่อให้หน้าเดิมเรียกใช้ได้เหมือนเดิม)
 * ตอนนี้ใช้เมนูแบบเดียวกับ SelectField ทั้งแอป ไม่ใช่ <select> ของเบราว์เซอร์แล้ว
 * เพราะเมนูของเบราว์เซอร์หน้าตาไม่เหมือนส่วนอื่น และ SelectField วางเมนูผ่าน portal จึงไม่ถูกตัดขอบในหน้าต่างที่เลื่อนได้
 */
export const NativeSelect: React.FC<NativeSelectProps> = ({ options, value, ...rest }) => {
  const items = options.map((option) => ({ value: String(option.value), label: option.label }));
  return <SelectField {...rest} options={items} value={String(value)} placeholder={items[0]?.label ?? ''} />;
};
