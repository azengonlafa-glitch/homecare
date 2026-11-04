import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { AttachmentImage } from '../ui/AttachmentImage';
import { saveFile } from '../../lib/fileStore';
import type { Attachment } from '../../lib/onboarding';

interface PhotoSlotProps {
  id: string;
  label: string;
  emptyText: string;
  value: Attachment | null;
  /** ไฟล์ใหม่ที่เพิ่งบันทึก (ผู้เรียกจัดการลบไฟล์เก่าเอง) หรือ null เมื่อกดลบ */
  onChange: (value: Attachment | null) => void;
}

/** ช่องรูปเดี่ยว: กดเพื่อถ่าย/เลือกรูป แสดงรูปย่อ และลบได้ */
export const PhotoSlot: React.FC<PhotoSlotProps> = ({ id, label, emptyText, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('เลือกไฟล์รูปภาพเท่านั้น');
      return;
    }
    setBusy(true);
    setError('');
    try {
      onChange(await saveFile(file));
    } catch {
      setError('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="min-w-0">
      <p className="text-base font-bold text-slate-900 mb-2">{label}</p>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {value ? (
        <div className="space-y-2">
          <AttachmentImage attachment={value} alt={label} className="h-36 [&_img]:h-36 [&_img]:object-cover" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              เปลี่ยนรูป
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              ลบรูป
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:border-purple-400 hover:bg-purple-50 cursor-pointer disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="w-7 h-7" aria-hidden="true" />
          )}
          <span className="text-sm font-semibold px-2 text-center">{busy ? 'กำลังบันทึกรูป…' : emptyText}</span>
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
};
