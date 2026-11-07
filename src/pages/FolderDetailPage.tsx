import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, FilePlus2, Pencil, Search, Trash2 } from 'lucide-react';
import { DocumentFormModal } from '../components/folders/DocumentFormModal';
import { FolderFormModal } from '../components/folders/FolderFormModal';
import { FolderIcon } from '../components/folders/FolderIcon';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { AttachmentThumb } from '../components/ui/AttachmentPicker';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Mascot } from '../components/ui/Mascot';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';
import {
  DOC_KINDS,
  addDocsIn,
  colorOf,
  deleteFolderIn,
  filterDocs,
  formatDocDate,
  kindLabel,
  removeDocIn,
  saveFolders,
  updateDocIn,
  updateFolderIn,
  useFolders,
  type DocInput,
  type DocKind,
  type FolderColor,
  type FolderDoc,
} from '../lib/folders';
import { deleteFile, deleteFiles, formatFileSize, openAttachment } from '../lib/fileStore';
import type { Attachment } from '../lib/onboarding';
import { cn } from '../lib/cn';

export const FolderDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const state = useFolders();
  const navigate = useNavigate();
  const toast = useToast();
  const folder = state.folders.find((f) => f.id === id);

  const [adding, setAdding] = useState(false);
  const [editingDoc, setEditingDoc] = useState<FolderDoc | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<FolderDoc | null>(null);
  const [editingFolder, setEditingFolder] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [kind, setKind] = useState<DocKind | 'all'>('all');
  const [query, setQuery] = useState('');

  const docs = useMemo(() => (folder ? filterDocs(folder.docs, kind, query) : []), [folder, kind, query]);
  const kindsPresent = useMemo(() => DOC_KINDS.filter((k) => folder?.docs.some((d) => d.kind === k.id)), [folder]);

  if (!folder) {
    return (
      <Card className="space-y-4 py-12 text-center">
        <Mascot kind="cloud" mood="calm" className="mx-auto h-24 w-24" />
        <h1 className="text-xl font-semibold text-slate-900">ไม่พบโฟลเดอร์นี้</h1>
        <p className="text-base text-slate-700">โฟลเดอร์อาจถูกลบไปแล้ว</p>
        <Link to="/folders" className="inline-block font-bold text-purple-800 underline">
          กลับไปโฟลเดอร์ทั้งหมด
        </Link>
      </Card>
    );
  }

  const color = colorOf(folder.color);
  const fail = (err: unknown) => toast.show(err instanceof Error ? err.message : 'ทำรายการไม่สำเร็จ', { tone: 'error' });

  const addDocs = (items: { attachment: Attachment; input: DocInput }[]) => {
    try {
      saveFolders(addDocsIn(state, folder.id, items));
      setAdding(false);
      toast.show(items.length > 1 ? `เพิ่ม ${items.length} เอกสารแล้ว` : 'เพิ่มเอกสารแล้ว');
    } catch (err) {
      fail(err);
    }
  };

  const editDoc = (input: DocInput) => {
    if (!editingDoc) return;
    try {
      saveFolders(updateDocIn(state, folder.id, editingDoc.id, input));
      setEditingDoc(null);
      toast.show('บันทึกรายละเอียดแล้ว');
    } catch (err) {
      fail(err);
    }
  };

  const removeDoc = () => {
    if (!deletingDoc) return;
    const { state: next, file } = removeDocIn(state, folder.id, deletingDoc.id);
    saveFolders(next);
    if (file) void deleteFile(file.id);
    setDeletingDoc(null);
    toast.show('ลบเอกสารแล้ว');
  };

  const editFolder = (input: { name: string; about: string; color: FolderColor }) => {
    try {
      saveFolders(updateFolderIn(state, folder.id, input));
      setEditingFolder(false);
      toast.show('บันทึกโฟลเดอร์แล้ว');
    } catch (err) {
      fail(err);
    }
  };

  const removeFolder = () => {
    const { state: next, files } = deleteFolderIn(state, folder.id);
    saveFolders(next);
    void deleteFiles(files);
    toast.show(`ลบโฟลเดอร์ ${folder.name} แล้ว`);
    navigate('/folders', { replace: true });
  };

  return (
    <div className="space-y-5">
      <Link to="/folders" className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-slate-800 ring-1 ring-purple-100 hover:bg-purple-50">
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        โฟลเดอร์ทั้งหมด
      </Link>

      <header className="hero-in relative overflow-hidden rounded-[2.25rem] p-5 sm:p-8" style={{ background: color.front }}>
        <span aria-hidden="true" className="blob-morph pointer-events-none absolute -right-14 -top-20 h-60 w-60 bg-white/50" />
        <div className="relative flex items-center gap-4">
          <FolderIcon color={folder.color} count={folder.docs.length} className="h-24 w-28 shrink-0 sm:h-32 sm:w-36" />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-3xl font-semibold text-slate-900 sm:text-4xl">{folder.name}</h1>
            <p className="mt-1 text-base font-medium text-slate-800 sm:text-lg">
              {folder.about ? `${folder.about} · ` : ''}
              {folder.docs.length} เอกสาร
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setAdding(true)}>
            <FilePlus2 className="h-6 w-6" aria-hidden="true" />
            เพิ่มเอกสาร
          </Button>
          <Button variant="neutral" size="sm" onClick={() => setEditingFolder(true)}>
            <Pencil className="h-5 w-5" aria-hidden="true" />
            แก้ไขโฟลเดอร์
          </Button>
          <Button variant="neutral" size="sm" onClick={() => setDeletingFolder(true)}>
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            ลบโฟลเดอร์
          </Button>
        </div>
      </header>

      {folder.docs.length === 0 ? (
        <Card className="space-y-4 py-10 text-center">
          <Mascot kind="ball" mood="sleepy" className="mx-auto h-24 w-24" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">โฟลเดอร์นี้ยังว่างอยู่</h2>
            <p className="text-base text-slate-700">เพิ่มรูปหรือไฟล์ PDF แล้วใส่ชื่อ ชนิด และวันที่ จะหาเจอง่ายตอนปรึกษา</p>
          </div>
          <Button onClick={() => setAdding(true)} className="mx-auto">
            <FilePlus2 className="h-6 w-6" aria-hidden="true" />
            เพิ่มเอกสารแรก
          </Button>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <TextField id="doc-search" type="search" hideLabel label="ค้นหาเอกสาร" placeholder="ค้นหาชื่อหรือโน้ตในโฟลเดอร์นี้" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
            {kindsPresent.length > 1 && (
              <div role="group" aria-label="กรองตามชนิดเอกสาร" className="flex flex-wrap gap-2">
                {[{ id: 'all' as const, label: 'ทั้งหมด' }, ...kindsPresent].map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    aria-pressed={kind === k.id}
                    onClick={() => setKind(k.id)}
                    className={cn('min-h-[44px] cursor-pointer rounded-full border px-4 text-base font-semibold', kind === k.id ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-purple-50')}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {docs.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-base text-slate-700">
              <Search className="h-5 w-5 text-slate-500" aria-hidden="true" />
              ไม่พบเอกสารที่ตรงกับคำค้น
            </p>
          ) : (
            <ul className="stagger space-y-3">
              {docs.map((d) => (
                <li key={d.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <AttachmentThumb attachment={d.attachment} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <h2 className="break-words text-lg font-semibold leading-snug text-slate-900">{d.title}</h2>
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                          <span className="rounded-full bg-purple-100 px-3 py-0.5 text-purple-900">{kindLabel(d.kind)}</span>
                          {d.docDate && <span>{formatDocDate(d.docDate)}</span>}
                          <span className="font-medium text-slate-600">{formatFileSize(d.attachment.size)}</span>
                        </p>
                        {d.note && <p className="whitespace-pre-wrap break-words text-base text-slate-800">{d.note}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() =>
                          void openAttachment(d.attachment).then((ok) => {
                            if (!ok) toast.show('เปิดไฟล์ไม่ได้ ไฟล์อาจยังไม่ถูกส่งขึ้นระบบหรืออยู่ในอุปกรณ์อื่น', { tone: 'error' });
                          })
                        }
                      >
                        <Eye className="h-5 w-5" aria-hidden="true" />
                        เปิดดู
                      </Button>
                      <Button variant="neutral" size="sm" onClick={() => setEditingDoc(d)} aria-label={`แก้ไขรายละเอียด ${d.title}`}>
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                        แก้ไข
                      </Button>
                      <Button variant="neutral" size="sm" onClick={() => setDeletingDoc(d)} aria-label={`ลบ ${d.title}`}>
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                        ลบ
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <DocumentFormModal open={adding} onClose={() => setAdding(false)} onAdd={addDocs} />
      <DocumentFormModal open={!!editingDoc} doc={editingDoc ?? undefined} onClose={() => setEditingDoc(null)} onEdit={editDoc} />
      <FolderFormModal open={editingFolder} state={state} folder={folder} onClose={() => setEditingFolder(false)} onSubmit={editFolder} />
      <ConfirmDialog open={!!deletingDoc} title="ลบเอกสารนี้?" message={`ลบ “${deletingDoc?.title ?? ''}” ออกจากโฟลเดอร์ ไฟล์จะถูกลบด้วยและกู้คืนไม่ได้ (ถ้าเคยส่งให้ผู้เชี่ยวชาญแล้ว สำเนาที่ส่งไปจะยังอยู่ในประวัติการปรึกษา)`} confirmLabel="ลบเอกสาร" onConfirm={removeDoc} onCancel={() => setDeletingDoc(null)} />
      <ConfirmDialog open={deletingFolder} title={`ลบโฟลเดอร์ ${folder.name}?`} message={folder.docs.length > 0 ? `เอกสาร ${folder.docs.length} ไฟล์ในโฟลเดอร์นี้จะถูกลบทั้งหมดและกู้คืนไม่ได้` : 'โฟลเดอร์นี้ว่างอยู่ ลบได้ทันที'} confirmLabel="ลบโฟลเดอร์" onConfirm={removeFolder} onCancel={() => setDeletingFolder(false)} />
    </div>
  );
};
