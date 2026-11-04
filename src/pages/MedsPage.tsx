import React, { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, BellRing, ClipboardCheck, Pill, Plus } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { MedFormModal, type MedFormData } from '../components/meds/MedFormModal';
import { MedCabinet } from '../components/meds/MedCabinet';
import { MedDetailModal } from '../components/meds/MedDetailModal';
import { MedReport } from '../components/meds/MedReport';
import { RefillModal } from '../components/meds/RefillModal';
import { TodaySchedule } from '../components/meds/TodaySchedule';
import { deleteFiles } from '../lib/fileStore';
import { newId } from '../lib/journal';
import { useMedAlerts } from '../lib/medAlerts';
import { CURRENT_MEMBER_ID, getCurrentMember, loadSettings } from '../lib/settings';
import {
  DOSE_STATUS_LABEL,
  applyDoseStatus,
  daysLeft,
  formatQty,
  loadMeds,
  saveMeds,
  stockLevel,
  todayKey,
  type DosePeriod,
  type DoseStatus,
  type MedsState,
  type Medication,
} from '../lib/meds';
import { cn } from '../lib/cn';

type Tab = 'today' | 'cabinet' | 'report';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'today', label: 'วันนี้', icon: <ClipboardCheck className="w-5 h-5" aria-hidden="true" /> },
  { value: 'cabinet', label: 'รายการยา', icon: <Pill className="w-5 h-5" aria-hidden="true" /> },
  { value: 'report', label: 'รายงาน', icon: <BarChart3 className="w-5 h-5" aria-hidden="true" /> },
];

/** ตู้ยา (ส่วนตัว): ตารางกินยาวันนี้ (to-do) + รายการยาและจำนวนคงเหลือ + รายงานการใช้ยา */
export const MedsPage: React.FC = () => {
  const toast = useToast();
  const alerts = useMedAlerts();
  const [state, setState] = useState<MedsState>(loadMeds);
  const [tab, setTab] = useState<Tab>('today');
  const [form, setForm] = useState<
    { mode: 'new'; fromId?: string } | { mode: 'inventory' } | { mode: 'edit'; id: string } | null
  >(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Medication | null>(null);
  const [refilling, setRefilling] = useState<Medication | null>(null);

  const settings = useMemo(loadSettings, []);
  const me = getCurrentMember(settings);
  const by = { id: CURRENT_MEMBER_ID, name: me?.name ?? 'ฉัน' };

  const commit = (next: MedsState) => {
    setState(next);
    saveMeds(next);
  };

  const editing = form?.mode === 'edit' ? (state.meds.find((m) => m.id === form.id) ?? null) : null;
  const detail = detailId ? (state.meds.find((m) => m.id === detailId) ?? null) : null;
  const linkFrom = form?.mode === 'new' && form.fromId ? (state.meds.find((m) => m.id === form.fromId) ?? null) : null;

  const handleSave = (data: MedFormData, linkedId?: string | null) => {
    if (form?.mode === 'edit') {
      commit({
        ...state,
        meds: state.meds.map((m) =>
          m.id === form.id
            ? {
                ...m,
                ...data,
                // หยุดใช้: จำวันที่หยุดเพื่อไม่นับประวัติหลังจากนั้น · กลับมาใช้: ล้างวันที่หยุด
                stoppedAt: data.active ? null : (m.stoppedAt ?? todayKey()),
              }
            : m
        ),
      });
      toast.show('บันทึกการแก้ไขแล้ว');
    } else {
      // ยาจากตู้ (เลือกมา หรือชื่อตรงกับยาที่จดไว้): อัปเดตตัวเดิม ไม่สร้างซ้ำ จำนวนคงเหลือและรูปจึงต่อเนื่อง
      const inInventory = linkedId
        ? state.meds.find((m) => m.id === linkedId)
        : state.meds.find((m) => m.asNeeded && m.name.trim().toLowerCase() === data.name.trim().toLowerCase());
      if (inInventory) {
        commit({
          ...state,
          meds: state.meds.map((m) =>
            m.id === inInventory.id ? { ...m, ...data, stoppedAt: data.active ? null : todayKey() } : m
          ),
        });
        toast.show(
          data.asNeeded
            ? `อัปเดต ${data.name} ในตู้ยาแล้ว`
            : `ตั้งเวลาให้ ${data.name} แล้ว ใช้ข้อมูลและจำนวนคงเหลือเดิมจากตู้ยา`
        );
      } else {
        commit({
          ...state,
          meds: [
            ...state.meds,
            {
              ...data,
              id: newId(),
              stoppedAt: data.active ? null : todayKey(),
              refillRequestedAt: null,
              createdAt: new Date().toISOString(),
            },
          ],
        });
        toast.show(form?.mode === 'inventory' ? 'เพิ่มยาเข้าตู้ยาแล้ว' : 'เพิ่มยาแล้ว');
      }
    }
    setForm(null);
  };

  const handleDelete = () => {
    if (!deleting) return;
    // รูปอาจถูกใช้ร่วมกับยาอื่น (ใช้ข้อมูลเดิมซ้ำ) ลบไฟล์เฉพาะรูปที่ไม่มียาอื่นใช้อยู่
    const others = state.meds.filter((m) => m.id !== deleting.id);
    const stillUsed = new Set(others.flatMap((m) => [m.pillPhoto?.id, m.labelPhoto?.id]));
    void deleteFiles(
      [deleting.pillPhoto, deleting.labelPhoto].filter(
        (a): a is NonNullable<typeof a> => !!a && !stillUsed.has(a.id)
      )
    );
    commit({
      meds: others,
      logs: state.logs.filter((l) => l.medId !== deleting.id),
    });
    toast.show(`ลบ ${deleting.name} แล้ว`);
    setDeleting(null);
    setDetailId(null);
  };

  const handleDose = (med: Medication, period: DosePeriod, status: DoseStatus | null, reason?: string) => {
    const next = applyDoseStatus(state, med, period, status, by, todayKey(), { reason });
    commit(next);
    const updated = next.meds.find((m) => m.id === med.id);
    if (status === 'taken' && updated) {
      const left = daysLeft(updated);
      const stock = `เหลือ ${formatQty(updated.remaining)} ${updated.unit}${left !== null ? ` (พออีก ${left} วัน)` : ''}`;
      if (stockLevel(updated) !== 'good' && stockLevel(med) === 'good') {
        toast.show(`บันทึกกินแล้ว · ${med.name} ใกล้หมด ${stock} ลองกด “ขอเติมยา”`);
      } else {
        toast.show(`บันทึกกินแล้ว · ${stock}`);
      }
      return;
    }
    toast.show(status ? `บันทึก “${DOSE_STATUS_LABEL[status]}” แล้ว` : 'ล้างบันทึกแล้ว');
  };

  const markRequested = (med: Medication) => {
    commit({
      ...state,
      meds: state.meds.map((m) => (m.id === med.id ? { ...m, refillRequestedAt: new Date().toISOString() } : m)),
    });
    toast.show('บันทึกว่าขอเติมยาแล้ว');
  };

  const openEdit = (med: Medication) => {
    setDetailId(null);
    setForm({ mode: 'edit', id: med.id });
  };

  const openSchedule = (med: Medication) => {
    setDetailId(null);
    setForm({ mode: 'new', fromId: med.id });
  };

  const openRefill = (med: Medication) => {
    setDetailId(null);
    setRefilling(med);
  };

  const hasMeds = state.meds.length > 0;
  const missedAlerts = alerts.filter((a) => a.kind === 'missed');
  const stockAlerts = alerts.filter((a) => a.kind !== 'missed');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        eyebrow="ส่วนตัว"
        title="ยาและการดูแล"
        description="ตารางใช้ยา ยาฉีดเบาหวาน สิ่งดูแลสุขภาพ และการแจ้งเตือน เห็นเฉพาะคุณคนเดียว"
        action={
          hasMeds ? (
            <Button type="button" onClick={() => setForm({ mode: 'new' })} className="w-full sm:w-auto">
              <Plus className="w-5 h-5" aria-hidden="true" />
              <span>เพิ่มยา / การดูแล</span>
            </Button>
          ) : undefined
        }
      />

      {!hasMeds ? (
        <Card className="py-14 px-6 text-center">
          <Pill className="w-14 h-14 text-purple-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-xl font-bold text-slate-900">ยังไม่มีรายการยาหรือการดูแล</p>
          <p className="mt-2 text-base text-slate-600">
            เพิ่มยา ยาฉีดเบาหวาน หรือสิ่งดูแล หรือถ่ายรูปซองยาให้ช่วยกรอก เพื่อสร้างตารางและแจ้งเตือนเมื่อใกล้หมด
          </p>
          <Button type="button" className="mt-6" onClick={() => setForm({ mode: 'new' })}>
            <Plus className="w-5 h-5" aria-hidden="true" />
            <span>เพิ่มรายการแรก</span>
          </Button>
          <div className="mt-3">
            <Button type="button" variant="soft" onClick={() => setForm({ mode: 'inventory' })}>
              <Plus className="w-5 h-5" aria-hidden="true" />
              <span>เพิ่มยาเข้าตู้ยา (ไม่ตั้งเวลา)</span>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* แจ้งเตือน: ลืมกินยา / ยาใกล้หมด */}
          {alerts.length > 0 && (
            <div className="space-y-2" aria-live="polite">
              {missedAlerts.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <BellRing className="w-6 h-6 shrink-0 text-red-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-red-900">ยังไม่ได้บันทึก {missedAlerts.length} มื้อที่เลยเวลาแล้ว</p>
                    <p className="text-sm text-red-800 break-words">
                      {missedAlerts.slice(0, 3).map((a) => a.body).join(' · ')}
                    </p>
                  </div>
                  {tab !== 'today' && (
                    <Button size="sm" variant="neutral" onClick={() => setTab('today')} className="shrink-0">
                      ไปบันทึก
                    </Button>
                  )}
                </div>
              )}
              {stockAlerts.map((a) => {
                const med = state.meds.find((m) => m.id === a.medId);
                return (
                  <div
                    key={a.key}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-4',
                      a.tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                    )}
                  >
                    <AlertTriangle
                      className={cn('w-6 h-6 shrink-0', a.tone === 'danger' ? 'text-red-600' : 'text-amber-600')}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-slate-900 break-words">{a.title}</p>
                      <p className="text-sm text-slate-700">{a.body}</p>
                    </div>
                    {med && (
                      <Button size="sm" onClick={() => setRefilling(med)} className="shrink-0">
                        ขอเติมยานี้
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div
            role="tablist"
            aria-label="มุมมองตู้ยา"
            className="grid grid-cols-3 gap-1 p-1 rounded-full bg-slate-100 border border-slate-200"
          >
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                id={`meds-tab-${t.value}`}
                aria-selected={tab === t.value}
                aria-controls={`meds-panel-${t.value}`}
                onClick={() => setTab(t.value)}
                className={cn(
                  'inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full text-base font-bold transition-colors cursor-pointer',
                  tab === t.value ? 'bg-purple-700 text-white shadow-sm' : 'text-slate-700 hover:bg-white'
                )}
              >
                <span className="hidden sm:inline-flex">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div id={`meds-panel-${tab}`} role="tabpanel" aria-labelledby={`meds-tab-${tab}`}>
            {tab === 'today' ? (
              <TodaySchedule meds={state.meds} logs={state.logs} onSet={handleDose} />
            ) : tab === 'cabinet' ? (
              <MedCabinet
                meds={state.meds}
                onOpen={(m) => setDetailId(m.id)}
                onEdit={openEdit}
                onRefill={openRefill}
                onAdd={() => setForm({ mode: 'inventory' })}
              />
            ) : (
              <MedReport meds={state.meds} logs={state.logs} onOpen={(m) => setDetailId(m.id)} />
            )}
          </div>
        </>
      )}




      <MedFormModal
        open={form !== null}
        initial={editing}
        defaultLowStockDays={settings.reminders.lowStockDays}
        knownMeds={state.meds}
        mode={form?.mode === 'inventory' ? 'inventory' : 'full'}
        linkFrom={linkFrom}
        onSave={handleSave}
        onClose={() => setForm(null)}
      />

      <MedDetailModal
        med={detail}
        logs={state.logs}
        onEdit={openEdit}
        onDelete={setDeleting}
        onRefill={openRefill}
        onSchedule={openSchedule}
        onClose={() => setDetailId(null)}
      />

      <RefillModal
        med={refilling}
        homeName={settings.homeName}
        onMarkRequested={markRequested}
        onClose={() => setRefilling(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="ลบยานี้?"
        message={`“${deleting?.name ?? ''}” ประวัติการกินยา และรูปของยานี้จะถูกลบ ย้อนกลับไม่ได้ ถ้าแค่เลิกใช้ ให้กด “แก้ไข” แล้วปิด “กำลังใช้ยานี้อยู่” แทน ประวัติจะยังอยู่ในรายงาน`}
        confirmLabel="ลบยา"
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
