import React from 'react';

interface PageHeaderProps {
  /** คงไว้ให้หน้าเดิมเรียกใช้ได้ ไม่แสดงผลแล้ว */
  eyebrow?: string;
  /** ใช้เป็นหัวข้อสำหรับโปรแกรมอ่านหน้าจอเท่านั้น (ไม่แสดงบนจอ) */
  title: string;
  description?: string;
  /** ปุ่มหรือตัวควบคุม เช่น ปุ่มเพิ่มข้อมูล */
  action?: React.ReactNode;
}

/** ไม่มีแบนเนอร์หัวหน้าแล้ว เหลือแค่ปุ่มของหน้า (ถ้ามี) กับหัวข้อที่ซ่อนไว้ให้โปรแกรมอ่านหน้าจอ */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, action }) => (
  <header>
    <h1 className="sr-only">{title}</h1>
    {action && <div className="flex justify-end">{action}</div>}
  </header>
);
