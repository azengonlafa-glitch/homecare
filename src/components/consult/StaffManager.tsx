import React, { useState } from 'react';
import { Check, Pencil, Phone, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { ConfirmDialog } from '../settings/ConfirmDialog';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { useToast } from '../ui/Toast';
import { consultErrorText, getBackend } from '../../consult/backend';
import { EMAIL_PATTERN, MAX_STAFF_PER_PROVIDER, PHONE_PATTERN, digitsOnly, formatPhone } from '../../consult/format';
import type { Provider, StaffRecord } from '../../consult/types';

interface Row {
  key: number;
  email: string;
  phone: string;
  error: string;
}

let rowCounter = 0;
const blankRow = (): Row => ({ key: ++rowCounter, email: '', phone: '', error: '' });
const isBlank = (r: Row) => !r.email.trim() && !r.phone.trim();
const PHONE_ERROR = 'เบอร์ต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0';

/**
 * ทีมงานของร้าน ผูกได้สูงสุด 5 คน กดปุ่มบวกเพื่อเพิ่มแถว กรอกอีเมลและเบอร์ได้ทีละหลายคนแล้วผูกพร้อมกัน
 * อีเมลต้องเป็นบัญชีที่สมัครใช้งานแล้ว
 */
export const StaffManager: React.FC<{ provider: Provider; staff: StaffRecord[]; onChanged: () => void }> = ({ provider, staff, onChanged }) => {
  const toast = useToast();
  const capacity = MAX_STAFF_PER_PROVIDER - staff.length;
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<StaffRecord | null>(null);
  const [editing, setEditing] = useState<{ userId: string; phone: string; error: string } | null>(null);

  const patchRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: '' } : r)));
  const addRow = () => setRows((rs) => (rs.length < capacity ? [...rs, blankRow()] : rs));
  const removeRow = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [blankRow()]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rows.every(isBlank)) {
      setRows((rs) => rs.map((r, i) => (i === 0 ? { ...r, error: 'กรอกอีเมลของทีมงานก่อน' } : r)));
      document.getElementById(`staff-email-${rows[0].key}`)?.focus();
      return;
    }
    const seen = new Set(staff.map((s) => s.email.toLowerCase()));
    const checked = rows.map((r) => {
      if (isBlank(r)) return r;
      const email = r.email.trim().toLowerCase();
      let error = '';
      if (!EMAIL_PATTERN.test(email)) error = 'กรุณากรอกอีเมลให้ถูกต้อง';
      else if (seen.has(email)) error = 'อีเมลนี้อยู่ในทีมงานแล้ว หรือกรอกซ้ำในรายการ';
      else if (r.phone.trim() && !PHONE_PATTERN.test(digitsOnly(r.phone))) error = PHONE_ERROR;
      if (!error) seen.add(email);
      return { ...r, error };
    });
    setRows(checked);
    const firstBad = checked.find((r) => r.error);
    if (firstBad) {
      document.getElementById(`staff-email-${firstBad.key}`)?.focus();
      return;
    }

    setBusy(true);
    let saved = 0;
    const remaining: Row[] = [];
    const backend = await getBackend();
    for (const r of checked) {
      if (isBlank(r)) continue;
      try {
        await backend.assignStaff(r.email, provider.id, r.phone);
        saved += 1;
      } catch (err) {
        remaining.push({ ...r, error: consultErrorText(err) });
      }
    }
    setRows(remaining.length ? remaining : [blankRow()]);
    setBusy(false);
    if (saved > 0) {
      toast.show(`ผูกบัญชีแล้ว ${saved} คน`);
      onChanged();
    }
  };

  const savePhone = async (member: StaffRecord) => {
    if (!editing) return;
    if (editing.phone.trim() && !PHONE_PATTERN.test(digitsOnly(editing.phone))) {
      setEditing({ ...editing, error: PHONE_ERROR });
      return;
    }
    try {
      const backend = await getBackend();
      await backend.assignStaff(member.email, provider.id, editing.phone);
      toast.show('บันทึกเบอร์แล้ว');
      setEditing(null);
      onChanged();
    } catch (err) {
      setEditing({ ...editing, error: consultErrorText(err) });
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      const backend = await getBackend();
      await backend.removeStaff(removing.userId);
      toast.show('ถอดสิทธิ์แล้ว');
      onChanged();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    }
    setRemoving(null);
  };

  const filledCount = rows.filter((r) => !isBlank(r)).length;

  return (
    <div className="space-y-4">
      <p className="text-base text-slate-700">
        ทีมงานที่เข้าพื้นที่เภสัชกรและตอบผู้ป่วยได้ <strong>{staff.length}/{MAX_STAFF_PER_PROVIDER} คน</strong>
      </p>

      {staff.length === 0 ? (
        <p className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-base text-amber-950">ยังไม่มีทีมงาน ผู้ใช้ส่งคำขอได้ แต่จะไม่มีใครตอบ</p>
      ) : (
        <ul className="space-y-2">
          {staff.map((s) => (
            <li key={s.userId} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-all text-base font-bold text-slate-900">{s.email}</p>
                  {editing?.userId !== s.userId && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-base text-slate-700">
                      <Phone className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
                      {s.phone ? formatPhone(s.phone) : <span className="text-slate-500">ยังไม่ระบุเบอร์</span>}
                    </p>
                  )}
                </div>
                {editing?.userId !== s.userId && (
                  <>
                    <button type="button" aria-label={`แก้เบอร์ของ ${s.email}`} onClick={() => setEditing({ userId: s.userId, phone: s.phone, error: '' })} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200 cursor-pointer">
                      <Pencil className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={`ถอดสิทธิ์ ${s.email}`} onClick={() => setRemoving(s)} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-red-700 hover:bg-red-50 cursor-pointer">
                      <Trash2 className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
              {editing?.userId === s.userId && (
                <div className="mt-2 space-y-2">
                  <TextField id={`staff-edit-phone-${s.userId}`} type="tel" inputMode="tel" label={`เบอร์ของ ${s.email}`} placeholder="08x-xxx-xxxx" value={editing.phone} error={editing.error} onChange={(e) => setEditing({ ...editing, phone: e.target.value, error: '' })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="neutral" size="sm" onClick={() => setEditing(null)}>
                      <X className="w-5 h-5" aria-hidden="true" />
                      ยกเลิก
                    </Button>
                    <Button size="sm" onClick={() => void savePhone(s)}>
                      <Check className="w-5 h-5" aria-hidden="true" />
                      บันทึกเบอร์
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {capacity <= 0 ? (
        <p role="status" className="rounded-2xl bg-slate-100 p-3 text-base font-semibold text-slate-800">
          ครบ {MAX_STAFF_PER_PROVIDER} คนแล้ว ถอดคนเดิมออกก่อนจึงจะเพิ่มคนใหม่ได้
        </p>
      ) : (
        <form noValidate onSubmit={(e) => void submit(e)} className="space-y-3">
          <h3 className="text-base font-bold text-slate-900">เพิ่มทีมงาน</h3>
          <p className="text-sm sm:text-base text-slate-600">เจ้าของอีเมลต้องสมัครใช้งานแอปแล้ว เพิ่มได้อีก {capacity} คน</p>
          {rows.map((r, i) => (
            <div key={r.key} className="space-y-3 rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-bold text-slate-800">คนที่ {staff.length + i + 1}</p>
                {rows.length > 1 && (
                  <button type="button" aria-label={`เอาแถวคนที่ ${staff.length + i + 1} ออก`} onClick={() => removeRow(r.key)} className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer">
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`staff-email-${r.key}`} type="email" label="อีเมล" placeholder="name@example.com" value={r.email} error={r.error} onChange={(e) => patchRow(r.key, { email: e.target.value })} />
                <TextField id={`staff-phone-${r.key}`} type="tel" inputMode="tel" label="เบอร์โทร" labelSuffix="(ไม่บังคับ)" placeholder="08x-xxx-xxxx" value={r.phone} onChange={(e) => patchRow(r.key, { phone: e.target.value })} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="neutral" size="sm" disabled={rows.length >= capacity} onClick={addRow}>
              <Plus className="w-5 h-5" aria-hidden="true" />
              เพิ่มอีกคน
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              <UserPlus className="w-5 h-5" aria-hidden="true" />
              {filledCount > 1 ? `ผูกบัญชี ${filledCount} คน` : 'ผูกบัญชี'}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={!!removing}
        title="ถอดสิทธิ์บัญชีนี้?"
        message={`${removing?.email ?? ''} จะเข้าพื้นที่เภสัชกรและเห็นการปรึกษาของ ${provider.displayName} ไม่ได้อีก`}
        confirmLabel="ถอดสิทธิ์"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
};
