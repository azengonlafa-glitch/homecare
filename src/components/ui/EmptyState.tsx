import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { Dino, type DinoPose } from './Dino';

interface EmptyStateProps {
  /** คงไว้ให้หน้าเดิมเรียกใช้ได้ ไม่แสดงผลแล้ว (ใช้ไดโนเสาร์แทน) */
  icon?: LucideIcon;
  message: string;
  /** ท่าของไดโนเสาร์ (ค่าเริ่มต้น หลับ = ยังว่าง) */
  pose?: DinoPose;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, pose = 'sleep' }) => (
  <Card className="py-10 text-center">
    <Dino pose={pose} bob className="mx-auto mb-3 h-28 w-32" />
    <p className="text-slate-600 font-medium">{message}</p>
  </Card>
);
