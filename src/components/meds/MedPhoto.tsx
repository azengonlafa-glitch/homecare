import React, { useEffect, useState } from 'react';
import { getFile } from '../../lib/fileStore';
import type { Attachment } from '../../lib/onboarding';
import type { Medication } from '../../lib/meds';
import { cn } from '../../lib/cn';

/** รูปที่ผู้ใช้แนบไว้กับยา: ใช้รูปเม็ดยาก่อน ถ้าไม่มีใช้รูปฉลาก/ซองยา */
export const medPhotoOf = (med: Pick<Medication, 'pillPhoto' | 'labelPhoto'>): Attachment | null =>
  med.pillPhoto ?? med.labelPhoto ?? null;

interface MedPhotoProps {
  med: Pick<Medication, 'name' | 'pillPhoto' | 'labelPhoto'>;
  className?: string;
  /** แสดงเมื่อไม่มีรูป (เช่น ไอคอนประจำรูปแบบยา) */
  fallback?: React.ReactNode;
}

/** แสดงรูปยา (โหลดจาก IndexedDB เป็น blob URL แล้วคืนหน่วยความจำเมื่อเลิกใช้) */
export const MedPhoto: React.FC<MedPhotoProps> = ({ med, className, fallback = null }) => {
  const photo = medPhotoOf(med);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    if (!photo) return;
    getFile(photo.id)
      .then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo?.id]);

  if (!src) {
    return <div className={cn('flex items-center justify-center', className)}>{fallback}</div>;
  }
  return <img src={src} alt={med.name} className={cn('object-cover', className)} />;
};
