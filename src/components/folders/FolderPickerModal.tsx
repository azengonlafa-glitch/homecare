import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FolderOpen } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AttachmentThumb } from '../ui/AttachmentPicker';
import { consultBlocker } from '../../consult/folderFiles';
import { colorOf, formatDocDate, kindLabel, sortDocs, useFolders, type FolderDoc } from '../../lib/folders';
import { cn } from '../../lib/cn';

interface FolderPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** ส่งรายการที่ติ๊กกลับไปให้ผู้เรียกทำสำเนา */
  onConfirm: (docs: FolderDoc[]) => void;
}

const PickerBody: React.FC<Omit<FolderPickerModalProps, 'open'>> = ({ onClose, onConfirm }) => {
  const { folders } = useFolders();
  const [folderId, setFolderId] = useState(() => folders.find((f) => f.docs.length > 0)?.id ?? folders[0]?.id ?? '');
  const [picked, setPicked] = useState<Record<string, FolderDoc>>({});
  const folder = folders.find((f) => f.id === folderId);
  const count = Object.keys(picked).length;
  const hasAny = folders.some((f) => f.docs.length > 0);

  const toggle = (doc: FolderDoc) =>
    setPicked((p) => {
      const next = { ...p };
      if (next[doc.id]) delete next[doc.id];
      else next[doc.id] = doc;
      return next;
    });

  return (
    <Modal
      open
      onClose={onClose}
      title="เลือกเอกสารจากโฟลเดอร์"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={count === 0} onClick={() => onConfirm(Object.values(picked))}>
            {count > 0 ? `แนบ ${count} ไฟล์` : 'เลือกไฟล์ก่อน'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-5">
        {!hasAny ? (
          <div className="space-y-3 py-8 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-purple-700" aria-hidden="true" />
            <p className="text-lg font-semibold text-slate-900">ยังไม่มีเอกสารในโฟลเดอร์</p>
            <p className="text-base text-slate-700">เพิ่มเอกสารในโฟลเดอร์ก่อน แล้วกลับมาเลือกที่นี่</p>
            <Link to="/folders" target="_blank" rel="noreferrer" className="inline-block min-h-[48px] py-2.5 font-bold text-purple-800 underline">
              เปิดโฟลเดอร์ในแท็บใหม่
            </Link>
          </div>
        ) : (
          <>
            <p className="text-base text-slate-700">เลือกได้เฉพาะรูปและ PDF ไฟล์ละไม่เกิน 20 MB ระบบทำสำเนาไปส่ง ต้นฉบับในโฟลเดอร์ไม่เปลี่ยน</p>
            <div role="group" aria-label="เลือกโฟลเดอร์" className="flex flex-wrap gap-2">
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={folderId === f.id}
                  onClick={() => setFolderId(f.id)}
                  className={cn('min-h-[44px] cursor-pointer rounded-full border-2 px-4 text-base font-semibold', folderId === f.id ? 'text-slate-900' : 'border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200')}
                  style={folderId === f.id ? { background: colorOf(f.color).front, borderColor: colorOf(f.color).back } : undefined}
                >
                  {f.name} ({f.docs.length})
                </button>
              ))}
            </div>
            {folder && folder.docs.length === 0 && <p className="py-4 text-base text-slate-700">โฟลเดอร์นี้ยังว่างอยู่</p>}
            <ul className="space-y-2">
              {sortDocs(folder?.docs ?? []).map((d) => {
                const blocker = consultBlocker(d);
                const on = !!picked[d.id];
                return (
                  <li key={d.id}>
                    <label className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-2 pr-3', blocker ? 'cursor-not-allowed border-transparent bg-slate-50 opacity-70' : on ? 'border-purple-700 bg-purple-50' : 'border-slate-200 bg-white hover:bg-purple-50/50')}>
                      <input type="checkbox" className="sr-only" checked={on} disabled={!!blocker} onChange={() => toggle(d)} />
                      <AttachmentThumb attachment={d.attachment} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-base font-semibold text-slate-900">{d.title}</span>
                        <span className="block text-sm text-slate-700">
                          {kindLabel(d.kind)}
                          {d.docDate && ` · ${formatDocDate(d.docDate)}`}
                        </span>
                        {blocker && <span className="block text-sm font-semibold text-red-700">ส่งไม่ได้: {blocker}</span>}
                      </span>
                      <span aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 bg-white')}>
                        {on && <Check className="h-5 w-5" />}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
};

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({ open, ...rest }) => (open ? <PickerBody {...rest} /> : null);
