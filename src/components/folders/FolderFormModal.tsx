import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { FOLDER_COLORS, MAX_NAME, validateFolderName, type Folder, type FolderColor, type FoldersState } from '../../lib/folders';
import { useSettings } from '../../lib/useSettings';
import { cn } from '../../lib/cn';
import { FolderIcon } from './FolderIcon';

interface FolderFormModalProps {
  open: boolean;
  state: FoldersState;
  /** ส่งมา = แก้ไขโฟลเดอร์นี้ ไม่ส่ง = สร้างใหม่ */
  folder?: Folder;
  onClose: () => void;
  onSubmit: (input: { name: string; about: string; color: FolderColor }) => void;
}

const FormBody: React.FC<Omit<FolderFormModalProps, 'open'>> = ({ state, folder, onClose, onSubmit }) => {
  const [name, setName] = useState(folder?.name ?? '');
  const [about, setAbout] = useState(folder?.about ?? '');
  const [color, setColor] = useState<FolderColor>(folder?.color ?? FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length].id);
  const [error, setError] = useState('');
  const members = useSettings().members.map((m) => m.name).filter(Boolean);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateFolderName(name, state, folder?.id);
    if (problem) {
      setError(problem);
      document.getElementById('folder-name')?.focus();
      return;
    }
    onSubmit({ name: name.trim(), about: about.trim(), color });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={folder ? 'แก้ไขโฟลเดอร์' : 'สร้างโฟลเดอร์ใหม่'}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" form="folder-form">
            {folder ? 'บันทึก' : 'สร้างโฟลเดอร์'}
          </Button>
        </div>
      }
    >
      <form id="folder-form" noValidate onSubmit={submit} className="space-y-5 py-5">
        <div className="flex justify-center" aria-hidden="true">
          <FolderIcon color={color} count={folder?.docs.length ?? 0} className="h-28 w-32" still />
        </div>
        <TextField
          id="folder-name"
          label="ชื่อโฟลเดอร์"
          placeholder="เช่น ผลตรวจเลือด ใบสั่งยา"
          maxLength={MAX_NAME}
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          autoComplete="off"
        />
        <div className="space-y-2">
          <TextField id="folder-about" label="เกี่ยวกับใคร" labelSuffix="(ไม่บังคับ)" placeholder="เช่น คุณแม่" maxLength={MAX_NAME} value={about} onChange={(e) => setAbout(e.target.value)} autoComplete="off" />
          {members.length > 0 && (
            <div role="group" aria-label="เลือกจากสมาชิกในบ้าน" className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={about === m}
                  onClick={() => setAbout(about === m ? '' : m)}
                  className={cn('min-h-[44px] cursor-pointer rounded-full border px-4 text-base font-semibold', about === m ? 'border-purple-700 bg-purple-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-purple-50')}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-base font-bold text-slate-900">สีโฟลเดอร์</legend>
          <div role="radiogroup" aria-label="สีโฟลเดอร์" className="flex flex-wrap gap-3">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.id}
                aria-label={c.label}
                onClick={() => setColor(c.id)}
                className={cn('h-12 w-12 cursor-pointer rounded-2xl border-4', color === c.id ? 'border-slate-900' : 'border-white ring-1 ring-slate-200')}
                style={{ background: `linear-gradient(135deg, ${c.front}, ${c.back})` }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};

export const FolderFormModal: React.FC<FolderFormModalProps> = ({ open, ...rest }) => (open ? <FormBody key={rest.folder?.id ?? 'new'} {...rest} /> : null);
