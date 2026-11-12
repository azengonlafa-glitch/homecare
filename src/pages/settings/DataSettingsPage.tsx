import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileText, ShieldOff, Trash2 } from 'lucide-react';
import { PageLayout } from '../../components/settings/PageLayout';
import { ConfirmDialog } from '../../components/settings/ConfirmDialog';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { explainError } from '../../cloud/engine';
import { cloudEnabled } from '../../cloud/client';
import { CURRENT_MEMBER_ID } from '../../lib/settings';
import { loadMemberRecord } from '../../lib/members';
import { loadOnboarding } from '../../lib/onboarding';
import {
  CURRENT_CONSENT_VERSION,
  EXPORT_NOT_INCLUDED,
  deleteAccountAndData,
  downloadMyData,
  withdrawConsent,
} from '../../lib/privacyRights';

/** ข้อความที่ต้องพิมพ์ยืนยันก่อนลบบัญชี (กันกดพลาด ลบแล้วกู้คืนไม่ได้) */
const DELETE_PHRASE = 'ลบบัญชี';

const dangerButton =
  'inline-flex items-center justify-center gap-2 min-h-[54px] px-6 rounded-2xl sm:rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-base sm:text-lg font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

const formatThaiDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });

/**
 * ตั้งค่า › ข้อมูลและความยินยอมของฉัน
 * ใช้สิทธิเจ้าของข้อมูลตาม PDPA ได้เองในแอป: ดูความยินยอม ขอสำเนา ถอนความยินยอม และลบบัญชี
 */
export const DataSettingsPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const profile = loadOnboarding().profile;
  const sharing = loadMemberRecord(CURRENT_MEMBER_ID).sharing;

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDownload = () => {
    try {
      downloadMyData();
      toast.show('ดาวน์โหลดสำเนาข้อมูลแล้ว');
    } catch {
      toast.show('ดาวน์โหลดสำเนาข้อมูลไม่สำเร็จ ลองอีกครั้ง', { tone: 'error' });
    }
  };

  const handleWithdraw = () => {
    withdrawConsent();
    setWithdrawOpen(false);
    toast.show('ถอนความยินยอมแล้ว');
    navigate('/onboarding', { replace: true });
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setPhrase('');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccountAndData();
      // สำเร็จแล้วหน้าจะถูกพาไปหน้าเข้าสู่ระบบเอง
    } catch (err) {
      setDeleting(false);
      setDeleteOpen(false);
      setPhrase('');
      toast.show(explainError(err), { tone: 'error' });
    }
  };

  return (
    <PageLayout title="ข้อมูลและความยินยอมของฉัน" description="ดูว่าคุณยินยอมอะไรไว้ และขอสำเนา ถอนความยินยอม หรือลบข้อมูลของคุณได้เอง">
      <Card className="p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <FileText className="h-6 w-6 text-purple-700" aria-hidden="true" />
          ความยินยอมของฉัน
        </h2>
        <ul className="mt-4 space-y-2 text-base text-slate-800">
          <li>
            {profile.consent && profile.consentAt
              ? `ยอมรับเอกสารเมื่อ ${formatThaiDateTime(profile.consentAt)} (เวอร์ชัน ${profile.consentVersion ?? '-'})`
              : 'ยังไม่ได้ให้ความยินยอม'}
          </li>
          {profile.consent && profile.consentVersion && profile.consentVersion !== CURRENT_CONSENT_VERSION && (
            <li className="font-semibold text-amber-900">
              เอกสารมีฉบับใหม่ (เวอร์ชัน {CURRENT_CONSENT_VERSION}) ระบบจะขอให้อ่านอีกครั้งตอนเริ่มปรึกษา
            </li>
          )}
          <li>
            แสดงข้อมูลให้สมาชิกบ้าน: {sharing.shareData ? 'เปิด' : 'ปิด'}{' '}
            <Link to="/settings/privacy" className="font-bold text-purple-800 underline underline-offset-2">
              เปลี่ยนที่ความเป็นส่วนตัว
            </Link>
          </li>
          <li>การปรึกษาเภสัชกรหรือคลินิก: ขอความยินยอมแยกทุกครั้ง และถอนได้ที่หน้าประวัติการปรึกษา</li>
        </ul>
        <p className="mt-4">
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center font-bold text-purple-800 underline underline-offset-2"
          >
            อ่านนโยบายความเป็นส่วนตัวและเอกสารยินยอม (เปิดแท็บใหม่)
          </a>
        </p>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Download className="h-6 w-6 text-purple-700" aria-hidden="true" />
          ขอสำเนาข้อมูล
        </h2>
        <p className="mt-3 text-base text-slate-700">
          ดาวน์โหลดไฟล์ข้อมูลของคุณ: โปรไฟล์สุขภาพ ตู้ยา การตั้งค่า ข้อมูลของคุณในรายชื่อสมาชิกบ้าน และบันทึกอาการที่คุณเขียน
        </p>
        <p className="mt-2 text-sm text-slate-700">
          ไม่รวม: {EXPORT_NOT_INCLUDED.join(' · ')} ขอส่วนนี้ได้ทางช่องทางติดต่อในเอกสารความเป็นส่วนตัว (ข้อ 1)
        </p>
        <div className="mt-5">
          <Button type="button" variant="soft" fullWidth onClick={handleDownload}>
            <Download className="h-5 w-5" aria-hidden="true" />
            <span>ดาวน์โหลดสำเนาข้อมูลของฉัน</span>
          </Button>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <ShieldOff className="h-6 w-6 text-purple-700" aria-hidden="true" />
          ถอนความยินยอม
        </h2>
        <p className="mt-3 text-base text-slate-700">
          ถอนแล้วคุณจะใช้แอปต่อไม่ได้ จนกว่าจะให้ความยินยอมใหม่ และระบบจะหยุดแสดงข้อมูลของคุณให้คนในบ้านทันที
          ข้อมูลของคุณยังอยู่จนกว่าคุณจะลบบัญชี
        </p>
        <div className="mt-5">
          <Button type="button" variant="neutral" fullWidth onClick={() => setWithdrawOpen(true)}>
            ถอนความยินยอม
          </Button>
        </div>
      </Card>

      <Card className="border-2 border-red-200 p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-red-800">
          <Trash2 className="h-6 w-6" aria-hidden="true" />
          ลบบัญชีและข้อมูลของฉัน
        </h2>
        <p className="mt-3 text-base text-slate-700">
          {cloudEnabled
            ? 'ลบบัญชี โปรไฟล์สุขภาพ ตู้ยา การตั้งค่า และการปรึกษาของคุณออกจากระบบ ย้อนกลับไม่ได้'
            : 'ล้างข้อมูลทั้งหมดของแอปในเครื่องนี้ ย้อนกลับไม่ได้'}
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm text-slate-700">
          <li>ถ้าคุณอยู่คนเดียวในบ้านที่สร้างไว้ บ้านและข้อมูลของบ้านจะถูกลบด้วย</li>
          <li>ถ้าคุณเป็นผู้ดูแลหลักของบ้านที่ยังมีคนอื่นอยู่ ต้องมอบบทบาทให้คนอื่นก่อนจึงจะลบได้</li>
          <li>โพสต์และกิจกรรมที่คุณเขียนในบ้านที่ใช้ร่วมกับคนอื่นอาจยังอยู่ในบ้านนั้น ลบรายการเหล่านั้นก่อนถ้าไม่ต้องการ</li>
          <li>สำเนาที่เภสัชกรหรือคลินิกคัดลอกไปเก็บเองไม่ถูกลบ ต้องขอกับผู้ให้บริการนั้นโดยตรง</li>
        </ul>
        <div className="mt-5">
          <button type="button" className={`${dangerButton} w-full`} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            <span>ลบบัญชีและข้อมูลของฉัน</span>
          </button>
        </div>
      </Card>

      <ConfirmDialog
        open={withdrawOpen}
        title="ถอนความยินยอม?"
        message="ถอนแล้วจะใช้แอปต่อไม่ได้จนกว่าจะยินยอมใหม่ และระบบจะหยุดแสดงข้อมูลของคุณให้คนในบ้านทันที ข้อมูลของคุณยังอยู่จนกว่าคุณจะลบบัญชี"
        confirmLabel="ถอนความยินยอม"
        onCancel={() => setWithdrawOpen(false)}
        onConfirm={handleWithdraw}
      />

      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        title="ลบบัญชีและข้อมูลของฉัน?"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="neutral" fullWidth onClick={closeDelete} disabled={deleting}>
              ยกเลิก
            </Button>
            <button
              type="button"
              className={dangerButton}
              disabled={phrase.trim() !== DELETE_PHRASE || deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? 'กำลังลบ…' : 'ลบถาวร'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 py-6">
          <p className="text-base text-slate-700">
            บัญชีและข้อมูลของคุณจะถูกลบถาวร กู้คืนไม่ได้ ถ้าอยากเก็บสำเนาไว้ ให้ดาวน์โหลดสำเนาข้อมูลก่อน
          </p>
          <TextField
            id="delete-account-confirm"
            label={`พิมพ์ “${DELETE_PHRASE}” เพื่อยืนยัน`}
            autoComplete="off"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
        </div>
      </Modal>
    </PageLayout>
  );
};
