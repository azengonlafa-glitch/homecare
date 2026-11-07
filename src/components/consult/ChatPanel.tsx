import React, { useEffect, useRef, useState } from 'react';
import { FileText, FolderOpen, Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { FolderPickerModal } from '../folders/FolderPickerModal';
import { copyManyToConsult } from '../../consult/folderFiles';
import type { FolderDoc } from '../../lib/folders';
import { consultErrorText, getBackend } from '../../consult/backend';
import { CONSULT_FILE_ACCEPT, deleteLocalFile, saveLocalFile, getLocalFile } from '../../consult/files';
import { useConsultData } from '../../consult/hooks';
import type { Attachment } from '../../lib/onboarding';
import { cn } from '../../lib/cn';
import { useToast } from '../ui/Toast';

const openBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  if (!blob.type.startsWith('image/') && blob.type !== 'application/pdf') link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** ลิงก์เปิดไฟล์แนบ ดึงผ่าน backend จึงอยู่ภายใต้สิทธิ์ของการปรึกษานั้น */
export const AttachmentLinks: React.FC<{ sessionId: string; items: Attachment[]; light?: boolean }> = ({ sessionId, items, light }) => {
  const toast = useToast();
  if (!items.length) return null;
  const open = async (a: Attachment) => {
    try {
      const backend = await getBackend();
      openBlob(await backend.downloadFile(sessionId, a), a.name);
    } catch {
      toast.show('เปิดไฟล์ไม่ได้ ไฟล์อาจยังอัปโหลดไม่สำเร็จ', { tone: 'error' });
    }
  };
  return (
    <ul className="mt-1 space-y-1">
      {items.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => void open(a)}
            className={cn('inline-flex min-h-[44px] items-center gap-2 text-left font-semibold underline cursor-pointer break-all', light ? 'text-white' : 'text-purple-800')}
          >
            <FileText className="w-5 h-5 shrink-0" aria-hidden="true" />
            {a.name}
          </button>
        </li>
      ))}
    </ul>
  );
};

interface ChatPanelProps {
  sessionId: string;
  as: 'patient' | 'staff';
  canSend: boolean;
  closedText?: string;
  /** ข้อความที่แทรกจากภายนอก เช่น คำถามแนะนำของเภสัชกร */
  insert?: { text: string; key: number } | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId, as, canSend, closedText, insert }) => {
  const { data: messages, loading, error, reload } = useConsultData((b) => b.listMessages(sessionId), [sessionId], { sessionId });
  const toast = useToast();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  useEffect(() => {
    if (insert) {
      setText((t) => (t ? `${t}\n${insert.text}` : insert.text));
      textRef.current?.focus();
    }
  }, [insert]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const saved = await saveLocalFile(file);
      setFiles((f) => [...f, saved]);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'แนบไฟล์ไม่สำเร็จ', { tone: 'error' });
    }
  };

  const attachFromFolders = async (docs: FolderDoc[]) => {
    setPicking(false);
    const { attached, problems } = await copyManyToConsult(docs);
    if (attached.length) setFiles((f) => [...f, ...attached]);
    if (problems.length) toast.show(problems[0], { tone: 'error' });
  };

  const removeFile = (a: Attachment) => {
    setFiles((f) => f.filter((x) => x.id !== a.id));
    void deleteLocalFile(a.id);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && files.length === 0) return;
    setBusy(true);
    try {
      const backend = await getBackend();
      for (const a of files) {
        const blob = await getLocalFile(a.id);
        if (blob) await backend.uploadFile(sessionId, a, blob);
      }
      await backend.sendMessage(sessionId, body, files, as);
      if (backend.mode === 'live') files.forEach((a) => void deleteLocalFile(a.id));
      setText('');
      setFiles([]);
      reload();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[24rem] rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <FolderPickerModal open={picking} onClose={() => setPicking(false)} onConfirm={(docs) => void attachFromFolders(docs)} />
      <div ref={listRef} aria-live="polite" aria-label="ข้อความ" className="flex-1 max-h-[60vh] overflow-y-auto overscroll-contain p-4 space-y-3 bg-slate-50/60">
        {loading && !messages ? (
          <p className="flex items-center justify-center gap-2 py-10 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            กำลังโหลดข้อความ...
          </p>
        ) : error ? (
          <p role="alert" className="py-10 text-center font-semibold text-red-700">
            {error}
          </p>
        ) : !messages?.length ? (
          <div className="py-10 text-center text-slate-600">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 text-slate-300" aria-hidden="true" />
            <p className="font-medium">ยังไม่มีข้อความ</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === as;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5', mine ? 'bg-purple-700 text-white' : 'bg-white border border-slate-200 text-slate-900')}>
                  {m.body && <p className="text-base whitespace-pre-wrap break-words">{m.body}</p>}
                  <AttachmentLinks sessionId={sessionId} items={m.attachments} light={mine} />
                  <p className={cn('mt-1 text-xs', mine ? 'text-purple-100' : 'text-slate-500')}>
                    {new Date(m.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canSend ? (
        <form onSubmit={(e) => void send(e)} className="border-t border-slate-200 p-3 space-y-2">
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((a) => (
                <li key={a.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-purple-200 bg-purple-50 pl-3 pr-1 text-sm font-semibold text-purple-900">
                  <span className="truncate">{a.name}</span>
                  <button type="button" aria-label={`เอา ${a.name} ออก`} onClick={() => removeFile(a)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-purple-100 cursor-pointer">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <input ref={inputRef} type="file" accept={CONSULT_FILE_ACCEPT} className="sr-only" aria-label="แนบรูปหรือไฟล์" tabIndex={-1} onChange={(e) => void pickFile(e)} />
            <button type="button" aria-label="แนบรูปหรือไฟล์" onClick={() => inputRef.current?.click()} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-300 text-slate-700 hover:bg-purple-50 cursor-pointer">
              <Paperclip className="w-6 h-6" aria-hidden="true" />
            </button>
            {as === 'patient' && (
              <button type="button" aria-label="เลือกไฟล์จากโฟลเดอร์" onClick={() => setPicking(true)} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-300 text-slate-700 hover:bg-purple-50 cursor-pointer">
                <FolderOpen className="w-6 h-6" aria-hidden="true" />
              </button>
            )}
            <textarea
              ref={textRef}
              rows={1}
              maxLength={4000}
              aria-label="พิมพ์ข้อความ"
              placeholder="พิมพ์ข้อความ..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl/Cmd + Enter ส่งทันที สำหรับคนที่ตอบหลายเคสบนคอมพิวเตอร์
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="min-h-[48px] min-w-0 flex-1 resize-y rounded-2xl border border-slate-300 px-4 py-2.5 text-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
            <button type="submit" disabled={busy || (!text.trim() && files.length === 0)} aria-label="ส่งข้อความ" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
              {busy ? <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" /> : <Send className="w-6 h-6" aria-hidden="true" />}
            </button>
          </div>
        </form>
      ) : (
        <p className="border-t border-slate-200 p-4 text-center text-base font-semibold text-slate-600">{closedText ?? 'การปรึกษานี้ปิดแล้ว'}</p>
      )}
    </div>
  );
};
