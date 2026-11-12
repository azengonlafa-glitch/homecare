import React, { useRef, useState } from 'react';
import { FilePlus2, Loader2, Upload, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { DateField } from '../ui/DatePicker';
import { TextAreaField } from '../ui/TextAreaField';
import { useToast } from '../ui/Toast';
import { DOC_KINDS, MAX_NOTE, MAX_TITLE, validateDoc, type DocInput, type DocKind, type FolderDoc } from '../../lib/folders';
import { MAX_FILE_BYTES, MAX_FILE_LABEL, deleteFile, formatFileSize, saveFile } from '../../lib/fileStore';
import type { Attachment } from '../../lib/onboarding';
import { cn } from '../../lib/cn';

interface PendingFile {
  attachment: Attachment;
  title: string;
  error?: string;
}

interface DocumentFormModalProps {
  open: boolean;
  /** ส่งมา = แก้ไขรายละเอียดเอกสารนี้ (ไม่เปลี่ยนไฟล์) ไม่ส่ง = เพิ่มเอกสารใหม่ */
  doc?: FolderDoc;
  onClose: () => void;
  onAdd?: (items: { attachment: Attachment; input: DocInput }[]) => void;
  onEdit?: (input: DocInput) => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const baseName = (name: string) => name.replace(/\.[^.]+$/, '');

const FormBody: React.FC<Omit<DocumentFormModalProps, 'open'>> = ({ doc, onClose, onAdd, onEdit }) => {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(doc?.title ?? '');
  const [kind, setKind] = useState<DocKind>(doc?.kind ?? 'result');
  const [docDate, setDocDate] = useState(doc?.docDate ?? '');
  const [note, setNote] = useState(doc?.note ?? '');
  const [errors, setErrors] = useState<Partial<Record<keyof DocInput | 'files', string>>>({});
  const editing = !!doc;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length === 0) return;
    setUploading(true);
    const added: PendingFile[] = [];
    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        toast.show(`${file.name} ใหญ่เกิน ${MAX_FILE_LABEL}`, { tone: 'error' });
        continue;
      }
      try {
        added.push({ attachment: await saveFile(file), title: baseName(file.name).slice(0, MAX_TITLE) });
      } catch {
        toast.show(`เก็บ ${file.name} ไม่สำเร็จ`, { tone: 'error' });
      }
    }
    setFiles((f) => [...f, ...added]);
    setErrors((er) => ({ ...er, files: undefined }));
    setUploading(false);
  };

  const removePending = (id: string) => {
    setFiles((f) => f.filter((x) => x.attachment.id !== id));
    void deleteFile(id);
  };

  /** ปิดหน้าต่างโดยไม่บันทึก: ไฟล์ที่อัปโหลดไปแล้วต้องไม่ค้างในที่เก็บ */
  const cancel = () => {
    if (!editing) files.forEach((f) => void deleteFile(f.attachment.id));
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const shared = { kind, docDate, note };
    if (editing) {
      const found = validateDoc({ title, ...shared });
      if (Object.keys(found).length) {
        setErrors(found);
        return;
      }
      onEdit?.({ title: title.trim(), ...shared });
      return;
    }
    if (files.length === 0) {
      setErrors({ files: 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์' });
      return;
    }
    const checked = files.map((f) => ({ ...f, error: validateDoc({ title: f.title, ...shared }).title }));
    const sharedErrors = validateDoc({ title: 'x', ...shared });
    setFiles(checked);
    if (checked.some((f) => f.error) || Object.keys(sharedErrors).length) {
      setErrors(sharedErrors);
      return;
    }
    onAdd?.(files.map((f) => ({ attachment: f.attachment, input: { title: f.title.trim(), ...shared } })));
  };

  return (
    <Modal
      open
      onClose={cancel}
      title={editing ? 'แก้ไขรายละเอียดเอกสาร' : 'เพิ่มเอกสารในโฟลเดอร์'}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" onClick={cancel}>
            ยกเลิก
          </Button>
          <Button type="submit" form="doc-form" disabled={uploading}>
            {editing ? 'บันทึก' : files.length > 1 ? `เพิ่ม ${files.length} เอกสาร` : 'เพิ่มเอกสาร'}
          </Button>
        </div>
      }
    >
      <form id="doc-form" noValidate onSubmit={submit} className="space-y-5 py-5">
        {!editing && (
          <div className="space-y-2">
            <input ref={inputRef} type="file" multiple className="sr-only" tabIndex={-1} aria-label="เลือกไฟล์เอกสาร" onChange={(e) => void pick(e)} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'flex min-h-[96px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[1.75rem] border-2 border-dashed bg-purple-50 px-4 py-4 text-center text-purple-900 hover:bg-purple-100',
                errors.files ? 'border-red-500' : 'border-purple-300'
              )}
            >
              {uploading ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" /> : <Upload className="h-7 w-7" aria-hidden="true" />}
              <span className="text-base font-bold">{uploading ? 'กำลังเก็บไฟล์...' : 'เลือกรูป PDF หรือไฟล์เอกสาร'}</span>
              <span className="text-sm text-slate-700">เลือกได้หลายไฟล์พร้อมกัน ไฟล์ละไม่เกิน {MAX_FILE_LABEL}</span>
            </button>
            {errors.files && (
              <p role="alert" className="text-base font-semibold text-red-700">
                {errors.files}
              </p>
            )}
            {files.length > 0 && (
              <ul className="space-y-3">
                {files.map((f, i) => (
                  <li key={f.attachment.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                    <div className="mb-1 flex items-center gap-2">
                      <FilePlus2 className="h-5 w-5 shrink-0 text-purple-700" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                        {f.attachment.name} · {formatFileSize(f.attachment.size)}
                      </span>
                      <button type="button" aria-label={`เอา ${f.attachment.name} ออก`} onClick={() => removePending(f.attachment.id)} className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white">
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <TextField
                      id={`doc-title-${i}`}
                      label={files.length > 1 ? `ชื่อเอกสารไฟล์ที่ ${i + 1}` : 'ชื่อเอกสาร'}
                      maxLength={MAX_TITLE}
                      value={f.title}
                      error={f.error}
                      onChange={(e) => setFiles((list) => list.map((x) => (x.attachment.id === f.attachment.id ? { ...x, title: e.target.value, error: undefined } : x)))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {editing && <TextField id="doc-title" label="ชื่อเอกสาร" maxLength={MAX_TITLE} value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />}

        <fieldset className="space-y-2">
          <legend className="text-base font-bold text-slate-900">ชนิดเอกสาร</legend>
          <div role="radiogroup" aria-label="ชนิดเอกสาร" className="flex flex-wrap gap-2">
            {DOC_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={cn('min-h-[48px] cursor-pointer rounded-full border px-4 text-base font-semibold', kind === k.id ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-purple-50')}
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <DateField id="doc-date" label="วันที่ของเอกสาร" labelSuffix="(ไม่บังคับ)" max={today()} value={docDate} error={errors.docDate} onChange={setDocDate} />
        <TextAreaField id="doc-note" label="โน้ตช่วยจำ" labelSuffix="(ไม่บังคับ)" rows={2} maxLength={MAX_NOTE} placeholder="เช่น น้ำตาลหลังอดอาหาร ตรวจที่โรงพยาบาลใกล้บ้าน" value={note} error={errors.note} onChange={(e) => setNote(e.target.value)} />
      </form>
    </Modal>
  );
};

export const DocumentFormModal: React.FC<DocumentFormModalProps> = ({ open, ...rest }) => (open ? <FormBody key={rest.doc?.id ?? 'new'} {...rest} /> : null);
