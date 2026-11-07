import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, PauseCircle, Pencil, PlayCircle, Trash2 } from 'lucide-react';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { ProviderDetail } from '../../components/consult/ProviderDetail';
import { ProviderCard, StatusChip } from '../../components/consult/ProviderCard';
import { StaffManager } from '../../components/consult/StaffManager';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, getBackend } from '../../consult/backend';
import { useConsultData } from '../../consult/hooks';
import type { Provider, Review } from '../../consult/types';
import { cn } from '../../lib/cn';


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card className="space-y-3 p-5 sm:p-6">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    {children}
  </Card>
);

/** กรอกเหตุผลก่อนปิดชั่วคราวหรือแบน เหตุผลเห็นเฉพาะแอดมิน */
const StatusModal: React.FC<{ mode: 'paused' | 'banned'; provider: Provider; busy: boolean; onClose: () => void; onConfirm: (note: string) => void }> = ({ mode, provider, busy, onClose, onConfirm }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const banned = mode === 'banned';
  const submit = () => {
    if (banned && !note.trim()) {
      setError('กรุณาบอกเหตุผลที่แบน เพื่อเก็บไว้ตรวจสอบภายหลัง');
      document.getElementById('status-note')?.focus();
      return;
    }
    onConfirm(note.trim());
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={banned ? `แบน ${provider.displayName}?` : `ปิดชั่วคราว ${provider.displayName}?`}
      initialFocusSelector="#status-note"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className={cn('inline-flex min-h-[54px] w-full cursor-pointer items-center justify-center rounded-2xl px-4 text-base font-bold text-white disabled:opacity-50 sm:text-lg', banned ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-700 hover:bg-purple-800')}
          >
            {banned ? 'แบนร้านนี้' : 'ปิดชั่วคราว'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-4">
        <ul className="list-disc space-y-1 pl-6 text-base text-slate-800">
          <li>ผู้ใช้จะไม่เห็นร้านนี้ในหน้าเลือกปรึกษา และเริ่มปรึกษาใหม่ไม่ได้</li>
          {banned ? (
            <>
              <li>
                <strong>การปรึกษาที่ค้างอยู่ทั้งหมดจะถูกยกเลิกทันที</strong> ผู้ป่วยเห็นว่าถูกยกเลิก
              </li>
              <li>ทีมงานของร้านเข้าพื้นที่เภสัชกรและเปิดรายงานผู้ป่วยไม่ได้อีก</li>
            </>
          ) : (
            <li>การปรึกษาที่เปิดอยู่ยังคุยต่อได้จนจบ ทีมงานยังทำงานกับเคสเดิมได้</li>
          )}
          <li>เปิดกลับมาให้บริการได้ทุกเมื่อ</li>
        </ul>
        <TextAreaField id="status-note" label="เหตุผล" labelSuffix={banned ? '(จำเป็น)' : '(ไม่บังคับ)'} hint="เห็นเฉพาะแอดมิน ผู้ใช้ไม่เห็น" rows={3} maxLength={300} value={note} error={error} onChange={(e) => { setNote(e.target.value); setError(''); }} />
      </div>
    </Modal>
  );
};

/** รายละเอียดร้านสำหรับแอดมิน: ข้อมูลทั้งหมด ทีมงาน และการจัดการสถานะ/ลบ */
export const AdminProviderPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [providers, staff, reviews] = await Promise.all([b.listAllProviders(), b.listStaff(), b.listReviews(id)]);
      return { providers, staff, reviews };
    },
    [],
    { sessionId: null }
  );
  const [dialog, setDialog] = useState<null | 'paused' | 'banned' | 'delete' | 'reopen-banned'>(null);
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <LoadingCard label="กำลังโหลดข้อมูลร้าน..." />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;
  const provider = data?.providers.find((p) => p.id === id);
  if (!data || !provider) {
    return (
      <div className="space-y-4">
        <ErrorCard message="ไม่พบผู้ให้บริการนี้ อาจถูกลบไปแล้ว" />
        <Link to="/admin" className={buttonClass('neutral', 'sm')}>
          กลับไปรายการ
        </Link>
      </div>
    );
  }
  const staff = data.staff.filter((s) => s.providerId === provider.id);

  const changeStatus = async (status: Provider['status'], note: string) => {
    setBusy(true);
    try {
      const backend = await getBackend();
      const cancelled = await backend.setProviderStatus(provider.id, status, note);
      toast.show(
        status === 'open'
          ? 'เปิดให้บริการอีกครั้งแล้ว'
          : status === 'paused'
            ? 'ปิดชั่วคราวแล้ว'
            : cancelled > 0
              ? `แบนแล้ว และยกเลิกการปรึกษาที่ค้างอยู่ ${cancelled} รายการ`
              : 'แบนแล้ว'
      );
      setDialog(null);
      reload();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removeReview = async () => {
    if (!reviewToDelete) return;
    setBusy(true);
    try {
      const backend = await getBackend();
      await backend.deleteReview(reviewToDelete.id);
      toast.show('ลบรีวิวแล้ว คะแนนของร้านคำนวณใหม่แล้ว');
      setReviewToDelete(null);
      reload();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const backend = await getBackend();
      await backend.deleteProvider(provider.id);
      toast.show('ลบผู้ให้บริการแล้ว');
      navigate('/admin', { replace: true });
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
      setDialog(null);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/admin" className="inline-flex min-h-[48px] items-center gap-1.5 text-base font-bold text-purple-800 hover:underline">
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        ผู้ให้บริการทั้งหมด
      </Link>

      <ProviderDetail
        provider={provider}
        reviews={data.reviews}
        onDeleteReview={setReviewToDelete}
        badges={<StatusChip provider={provider} />}
        actions={
          <Link to={`/admin/providers/${provider.id}/edit`} className={cn(buttonClass('primary', 'sm'), 'w-full sm:w-auto')}>
            <Pencil className="w-5 h-5" aria-hidden="true" />
            แก้ไขข้อมูล
          </Link>
        }
        banner={
          provider.status !== 'open' ? (
            <p role="status" className={cn('mt-4 rounded-2xl border p-3 text-base font-semibold', provider.status === 'banned' ? 'border-red-300 bg-red-50 text-red-950' : 'border-amber-300 bg-amber-50 text-amber-950')}>
              {provider.status === 'banned' ? 'ร้านนี้ถูกแบน ผู้ใช้ไม่เห็นและทีมงานเข้าไม่ได้' : 'ร้านนี้ปิดชั่วคราว ผู้ใช้ไม่เห็นและเริ่มปรึกษาใหม่ไม่ได้'}
              {provider.statusNote && <span className="block font-normal">เหตุผล: {provider.statusNote}</span>}
            </p>
          ) : undefined
        }
        aside={
          <>
            <Section title="ทีมงาน">
              <StaffManager provider={provider} staff={staff} onChanged={reload} />
            </Section>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">การ์ดที่ผู้ใช้เห็น</h2>
              <p className="text-sm text-slate-600">แสดงให้ผู้ใช้เฉพาะตอนร้านเปิดให้บริการ</p>
              <ProviderCard provider={provider} interactive={false} />
            </div>

            <Section title="สถานะร้าน">
              {provider.status === 'open' && (
                <div className="space-y-2">
                  <p className="text-base text-slate-700">ร้านเปิดให้บริการอยู่ ผู้ใช้เห็นและเริ่มปรึกษาได้</p>
                  <Button variant="neutral" size="sm" fullWidth onClick={() => setDialog('paused')}>
                    <PauseCircle className="w-5 h-5" aria-hidden="true" />
                    ปิดชั่วคราว
                  </Button>
                </div>
              )}
              {provider.status === 'paused' && (
                <Button size="sm" fullWidth disabled={busy} onClick={() => void changeStatus('open', '')}>
                  <PlayCircle className="w-5 h-5" aria-hidden="true" />
                  เปิดให้บริการอีกครั้ง
                </Button>
              )}
              {provider.status === 'banned' && (
                <Button size="sm" fullWidth onClick={() => setDialog('reopen-banned')}>
                  <PlayCircle className="w-5 h-5" aria-hidden="true" />
                  ยกเลิกการแบนและเปิดให้บริการ
                </Button>
              )}
              {provider.status !== 'banned' && (
                <button type="button" onClick={() => setDialog('banned')} className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-5 text-base font-bold text-red-700 hover:bg-red-50">
                  <Ban className="w-5 h-5" aria-hidden="true" />
                  แบนร้านนี้
                </button>
              )}
            </Section>

            <Section title="ลบร้าน">
              <p className="text-base text-slate-700">ลบถาวรได้เฉพาะร้านที่ยังไม่เคยมีการปรึกษา ถ้ามีประวัติแล้วให้แบนหรือปิดชั่วคราวแทน เพื่อไม่ให้ประวัติของผู้ป่วยขาดหาย</p>
              <button type="button" onClick={() => setDialog('delete')} className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-5 text-base font-bold text-red-700 hover:bg-red-50">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
                ลบร้านนี้
              </button>
            </Section>
          </>
        }
      />

      {(dialog === 'paused' || dialog === 'banned') && <StatusModal mode={dialog} provider={provider} busy={busy} onClose={() => setDialog(null)} onConfirm={(note) => void changeStatus(dialog, note)} />}
      <ConfirmDialog
        open={!!reviewToDelete}
        title="ลบรีวิวนี้?"
        message="ลบเฉพาะรีวิวที่ไม่เหมาะสม เช่น คำหยาบหรือข้อมูลส่วนตัว คะแนนเฉลี่ยของร้านจะคำนวณใหม่ทันที"
        confirmLabel="ลบรีวิว"
        onConfirm={() => void removeReview()}
        onCancel={() => setReviewToDelete(null)}
      />
      <ConfirmDialog
        open={dialog === 'reopen-banned'}
        title="ยกเลิกการแบน?"
        message={`${provider.displayName} จะกลับมาเปิดให้บริการ ผู้ใช้เห็นและเริ่มปรึกษาได้ ทีมงานเข้าพื้นที่ทำงานได้อีกครั้ง การปรึกษาที่ถูกยกเลิกไปแล้วจะไม่กลับมา`}
        confirmLabel="เปิดให้บริการ"
        tone="primary"
        onConfirm={() => void changeStatus('open', '')}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={`ลบ ${provider.displayName} ถาวร?`}
        message="ข้อมูลร้านและบัญชีทีมงานที่ผูกไว้จะถูกลบ กู้คืนไม่ได้ ถ้าร้านนี้เคยมีการปรึกษา ระบบจะไม่ให้ลบ"
        confirmLabel="ลบถาวร"
        onConfirm={() => void remove()}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
};
