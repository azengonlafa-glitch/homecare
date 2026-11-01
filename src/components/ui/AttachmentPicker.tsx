import React, { useEffect, useRef, useState } from 'react';
import { Eye, File as FileIcon, FileText, Loader2, Paperclip, X } from 'lucide-react';
import type { Attachment } from '../../lib/onboarding';
import {
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  deleteFile,
  deleteFiles,
  formatFileSize,
  getFile,
  openAttachment,
  saveFile,
} from '../../lib/fileStore';
import { cn } from '../../lib/cn';

/** รูปย่อของไฟล์: ถ้าเป็นรูปภาพแสดงภาพจริง นอกนั้นแสดงไอคอน */
const AttachmentThumb: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const [src, setSrc] = useState<string | null>(null);
  const isImage = attachment.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let url: string | null = null;
    let cancelled = false;
    getFile(attachment.id)
      .then((blob) => {
        if (blob && !cancelled) {
          url = URL.createObjectURL(blob);
          setSrc(url);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, isImage]);

  return (
    <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-50 border border-purple-100 overflow-hidden flex items-center justify-center text-purple-700">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : attachment.type === 'application/pdf' ? (
        <FileText className="w-6 h-6" aria-hidden="true" />
      ) : (
        <FileIcon className="w-6 h-6" aria-hidden="true" />
      )}
    </div>
  );
};

interface AttachmentListProps {
  items: Attachment[];
  /** ไม่ส่ง = แสดงอย่างเดียว ลบไม่ได้ */
  onRemove?: (attachment: Attachment) => void;
  compact?: boolean;
}

/** รายการไฟล์ที่แนบ: เปิดดูได้ และลบได้ถ้ามี onRemove */
export const AttachmentList: React.FC<AttachmentListProps> = ({ items, onRemove, compact }) => {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white pr-2',
            compact ? 'p-1.5' : 'p-2'
          )}
        >
          <AttachmentThumb attachment={item} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900 truncate">{item.name}</p>
            <p className="text-sm text-slate-500">{formatFileSize(item.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => void openAttachment(item)}
            aria-label={`เปิดดู ${item.name}`}
            className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full text-purple-800 hover:bg-purple-50 cursor-pointer"
          >
            <Eye className="w-5 h-5" aria-hidden="true" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`ลบ ${item.name}`}
              className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full text-slate-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

interface AttachmentPickerProps {
  id: string;
  value: Attachment[];
  onChange: (value: Attachment[]) => void;
  /** ประเภทไฟล์ที่รับ เช่น "image/*,.pdf" (ไม่ระบุ = ทุกประเภท) */
  accept?: string;
  title?: string;
  description?: string;
  /** จำนวนไฟล์สูงสุด (เช่น 1 = แทนที่ไฟล์เดิมเมื่อเลือกใหม่) ไม่ระบุ = ไม่จำกัด */
  maxFiles?: number;
  /** ขนาดสูงสุดต่อไฟล์ (ไบต์) ไม่ระบุ = ใช้ค่ามาตรฐานของที่เก็บไฟล์ */
  maxBytes?: number;
  /** ไม่ลบไฟล์ออกจากที่เก็บเมื่อผู้ใช้ลบ/แทนที่ ให้ผู้เรียกจัดการเอง (ใช้ตอนแก้ไขโพสต์ที่ยังกดยกเลิกได้) */
  deferDelete?: boolean;
}

/** แนบไฟล์หรือรูปภาพ: กดเลือก ถ่ายรูป (บนมือถือ) หรือลากไฟล์มาวางได้ */
export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  id,
  value,
  onChange,
  accept,
  title = 'แนบไฟล์หรือรูปภาพ',
  description,
  maxFiles,
  maxBytes,
  deferDelete,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setMessage('');
    const saved: Attachment[] = [];
    const problems: string[] = [];
    for (const file of list) {
      if (maxBytes && file.size > maxBytes) {
        problems.push(`“${file.name}” ใหญ่เกิน ${formatFileSize(maxBytes)}`);
        continue;
      }
      try {
        saved.push(await saveFile(file));
      } catch (err) {
        problems.push(
          err instanceof Error && err.message === 'too-large'
            ? `“${file.name}” ใหญ่เกิน ${MAX_FILE_LABEL}`
            : `บันทึก “${file.name}” ไม่สำเร็จ (เบราว์เซอร์อาจปิดการเก็บไฟล์ เช่น โหมดส่วนตัว)`
        );
      }
    }
    if (saved.length > 0) {
      const next = [...valueRef.current, ...saved];
      if (maxFiles && next.length > maxFiles) {
        // เกินจำนวนที่กำหนด: เก็บไฟล์ล่าสุด ลบไฟล์เก่าออกจากที่เก็บด้วย
        if (!deferDelete) await deleteFiles(next.slice(0, next.length - maxFiles));
        onChange(next.slice(next.length - maxFiles));
      } else {
        onChange(next);
      }
    }
    if (problems.length > 0) setMessage(problems.join(' · '));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (attachment: Attachment) => {
    if (!deferDelete) await deleteFile(attachment.id);
    onChange(valueRef.current.filter((a) => a.id !== attachment.id));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center transition-colors',
          dragging ? 'border-purple-600 bg-purple-100' : 'border-purple-300 bg-purple-50/60'
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple={maxFiles !== 1}
          accept={accept}
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-white border border-purple-300 text-purple-900 text-base font-bold hover:bg-purple-50 disabled:opacity-60 cursor-pointer"
        >
          {busy ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="w-5 h-5" aria-hidden="true" />
          )}
          <span>{busy ? 'กำลังบันทึกไฟล์…' : title}</span>
        </button>
        <p className="text-sm text-slate-600 mt-2">
          {description ??
            `กดเลือก หรือลากไฟล์มาวางที่นี่ · ไม่เกิน ${maxBytes ? formatFileSize(maxBytes) : MAX_FILE_LABEL} ต่อไฟล์`}
        </p>
      </div>

      {message && (
        <p role="alert" className="text-base font-semibold text-red-700">
          {message}
        </p>
      )}

      <AttachmentList items={value} onRemove={handleRemove} />
    </div>
  );
};

export { MAX_FILE_BYTES };
