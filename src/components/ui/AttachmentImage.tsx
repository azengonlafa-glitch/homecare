import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { Attachment } from '../../lib/onboarding';
import { getFile, openAttachment } from '../../lib/fileStore';
import { cn } from '../../lib/cn';

interface AttachmentImageProps {
  attachment: Attachment;
  alt: string;
  className?: string;
}

/** แสดงรูปที่เก็บใน IndexedDB (โหลดเป็น blob URL แล้วคืนหน่วยความจำเมื่อเลิกใช้) กดเพื่อเปิดดูเต็มขนาด */
export const AttachmentImage: React.FC<AttachmentImageProps> = ({ attachment, alt, className }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    setMissing(false);
    getFile(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id]);

  if (missing) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 rounded-2xl bg-slate-100 text-slate-500 p-6 text-base',
          className
        )}
      >
        <ImageOff className="w-5 h-5" aria-hidden="true" />
        <span>ไม่พบรูปในเครื่องนี้</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void openAttachment(attachment)}
      aria-label={`เปิดดูรูปเต็มขนาด: ${alt}`}
      className={cn('block w-full overflow-hidden rounded-2xl bg-slate-100 cursor-zoom-in', className)}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="mx-auto w-full max-h-[28rem] object-contain" />
      ) : (
        <span className="block w-full h-full min-h-[8rem] animate-pulse bg-slate-200" aria-hidden="true" />
      )}
    </button>
  );
};
