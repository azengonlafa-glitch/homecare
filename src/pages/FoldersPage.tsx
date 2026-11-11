import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderPlus, ShieldCheck } from 'lucide-react';
import { FolderIcon } from '../components/folders/FolderIcon';
import { FolderFormModal } from '../components/folders/FolderFormModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Mascot } from '../components/ui/Mascot';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import { MAX_FOLDERS, STARTER_FOLDERS, colorOf, createFolderIn, saveFolders, totalDocs, useFolders, type FolderColor } from '../lib/folders';

const updatedText = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

export const FoldersPage: React.FC = () => {
  const state = useFolders();
  const navigate = useNavigate();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const full = state.folders.length >= MAX_FOLDERS;

  const create = (input: { name: string; about: string; color: FolderColor }) => {
    try {
      const { state: next, folder } = createFolderIn(state, input);
      saveFolders(next);
      setCreating(false);
      toast.show(`สร้างโฟลเดอร์ ${folder.name} แล้ว`);
      navigate(`/folders/${folder.id}`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'สร้างโฟลเดอร์ไม่สำเร็จ', { tone: 'error' });
    }
  };

  const createStarters = () => {
    try {
      let next = state;
      for (const s of STARTER_FOLDERS) next = createFolderIn(next, { name: s.name, color: s.color }).state;
      saveFolders(next);
      toast.show(`สร้างโฟลเดอร์ ${STARTER_FOLDERS.length} โฟลเดอร์แล้ว`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'สร้างโฟลเดอร์ไม่สำเร็จ', { tone: 'error' });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="ส่วนตัว"
        title="โฟลเดอร์เอกสาร"
        description="เก็บผลตรวจ ใบสั่งยา และเอกสารทางการแพทย์ไว้ที่เดียว แล้วหยิบส่งให้เภสัชกรหรือคลินิกได้ตอนปรึกษา"
        action={
          <Button onClick={() => setCreating(true)} disabled={full}>
            <FolderPlus className="h-6 w-6" aria-hidden="true" />
            สร้างโฟลเดอร์
          </Button>
        }
      />

      <p className="flex items-start gap-2 rounded-[1.5rem] bg-mint-soft p-4 text-base font-medium text-slate-800">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
        โฟลเดอร์เป็นของบัญชีคุณ ไม่แสดงให้คนในบ้านเห็นในแอป และจะส่งให้ผู้เชี่ยวชาญเฉพาะไฟล์ที่คุณเลือกเองเท่านั้น
      </p>

      {state.folders.length === 0 ? (
        <Card className="space-y-5 py-10 text-center">
          <Mascot kind="cloud" mood="sleepy" className="mx-auto h-28 w-28" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">ยังไม่มีโฟลเดอร์</h2>
            <p className="mx-auto max-w-md text-base text-slate-700">เริ่มจากโฟลเดอร์สำเร็จรูป 4 ใบ หรือสร้างโฟลเดอร์ของคุณเองก็ได้</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={createStarters}>สร้างโฟลเดอร์สำเร็จรูป 4 ใบ</Button>
            <Button variant="soft" onClick={() => setCreating(true)}>
              ตั้งชื่อเอง
            </Button>
          </div>
          <p className="text-sm text-slate-600">{STARTER_FOLDERS.map((s) => s.name).join(' · ')}</p>
        </Card>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-700">
            {state.folders.length} โฟลเดอร์ · {totalDocs(state)} เอกสาร
          </p>
          <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {state.folders.map((folder) => (
              <li key={folder.id}>
                <Link
                  to={`/folders/${folder.id}`}
                  aria-label={`โฟลเดอร์ ${folder.name} ${folder.docs.length} เอกสาร`}
                  className="group relative flex h-full min-h-[200px] flex-col items-center rounded-[2rem] bg-white p-4 text-center shadow-[0_12px_28px_-20px_rgba(42,34,29,0.55)] ring-1 ring-[#EADBCC] hover:ring-2"
                  style={{ ['--tw-ring-color' as string]: colorOf(folder.color).ring }}
                >
                  <FolderIcon color={folder.color} count={folder.docs.length} className="h-32 w-36 sm:h-36 sm:w-40" />
                  <span className="mt-2 block w-full break-words text-lg font-semibold leading-snug text-slate-900">{folder.name}</span>
                  {folder.about && <span className="mt-1 inline-block max-w-full truncate rounded-full bg-slate-100 px-3 py-0.5 text-sm font-semibold text-slate-700">{folder.about}</span>}
                  <span className="mt-auto pt-2 text-sm font-medium text-slate-600">
                    {folder.docs.length} เอกสาร · แก้ไข {updatedText(folder.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <FolderFormModal open={creating} state={state} onClose={() => setCreating(false)} onSubmit={create} />
    </div>
  );
};
