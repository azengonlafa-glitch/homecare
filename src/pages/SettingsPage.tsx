import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { PageLayout } from '../components/settings/PageLayout';
import { Card } from '../components/ui/Card';
import { Button, buttonClass } from '../components/ui/Button';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { CURRENT_MEMBER_ID, fontScaleLabel, loadSettings, resetSettings } from '../lib/settings';
import { loadMemberRecord } from '../lib/members';
import { pendingIncoming } from '../lib/access';
import { resetDemoState } from '../lib/demo';
import { FEEDBACK_URL } from '../lib/config';
import { cloudEnabled } from '../cloud/client';
import { clearHomeCaches, deleteHome, explainError, getCtx, leaveHome, signOutAll } from '../cloud/engine';
import { clearHomeSetup } from '../lib/homeSetup';
import { useToast } from '../components/ui/Toast';

interface SettingsRowProps {
  to: string;
  label: string;
  value?: string;
}

/** แถวเมนูในหน้าตั้งค่า: แตะทั้งแถวเพื่อเปิดหน้าย่อย */
const SettingsRow: React.FC<SettingsRowProps> = ({ to, label, value }) => (
  <li>
    <Link
      to={to}
      className="group flex items-center gap-3 min-h-[72px] px-5 py-4 hover:bg-purple-50 active:bg-purple-100 transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-base sm:text-lg font-bold text-slate-900 break-words">{label}</span>
        {value && <span className="block mt-0.5 text-sm text-slate-600 break-words">{value}</span>}
      </span>
      <ChevronRight
        className="w-6 h-6 shrink-0 text-slate-500 transition-transform duration-200 group-hover:translate-x-1"
        aria-hidden="true"
      />
    </Link>
  </li>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // เครื่องมือทดสอบแสดงเฉพาะเมื่อ URL มี ?test=1
  const isTestMode = !cloudEnabled && params.get('test') === '1';

  const [settings] = useState(loadSettings);
  const [confirm, setConfirm] = useState<'logout' | 'reset' | 'leave' | null>(null);

  // สรุปการตั้งค่าความเป็นส่วนตัว (ข้อมูลของฉันเอง)
  const myPrivacy = loadMemberRecord(CURRENT_MEMBER_ID).sharing;
  const privacySummary = !myPrivacy.shareData
    ? 'ซ่อนข้อมูลของฉันจากคนในบ้าน'
    : myPrivacy.editPolicy === 'all'
      ? 'ให้ดูได้ทุกคน · ให้ทุกคนแก้ไขได้'
      : `ให้ดูได้ทุกคน · แก้ไขได้ ${myPrivacy.allowedEditors.length} คน`;

  const pendingRequests = pendingIncoming().length;

  const enabledReminders = [
    settings.reminders.lowStock,
    settings.reminders.doseWindow,
    settings.reminders.appointment,
  ].filter(Boolean).length;

  const toast = useToast();
  const hasHomeNow = cloudEnabled ? !!getCtx()?.homeId : true;
  // ผู้ดูแลหลักออกจากบ้านตรง ๆ ไม่ได้ (เซิร์ฟเวอร์ไม่อนุญาต) ต้องมอบบทบาทหรือลบบ้านก่อน
  const isOwner = cloudEnabled && getCtx()?.role === 'owner';
  // ผู้ดูแลหลักที่อยู่คนเดียวในบ้าน: ออกจากบ้านได้ด้วยการลบบ้านนั้นทิ้ง (ไม่มีใครให้มอบบทบาทต่อ)
  const isSoloOwner = isOwner && settings.members.length <= 1;

  const handleLogout = () => {
    if (cloudEnabled) {
      void signOutAll();
      return;
    }
    localStorage.removeItem('growa_auth_user');
    navigate('/login', { replace: true });
  };

  /** ออกจากบ้านนี้ แล้วพาไปหน้ากรอกรหัสบ้านหรือสร้างบ้านใหม่ (ยังล็อกอินอยู่) */
  const handleLeaveHome = async () => {
    if (cloudEnabled) {
      try {
        // สำเร็จแล้วระบบจะพาไปหน้า /setup เอง
        await leaveHome();
      } catch (err) {
        setConfirm(null);
        toast.show(explainError(err), { tone: 'error' });
      }
      return;
    }
    clearHomeSetup();
    clearHomeCaches();
    setConfirm(null);
    navigate('/setup', { replace: true });
  };

  const handleDeleteAndLeave = async () => {
    try {
      await deleteHome();
    } catch (err) {
      setConfirm(null);
      toast.show(explainError(err), { tone: 'error' });
      return;
    }
    localStorage.removeItem('growa_last_visited_path');
    setConfirm(null);
    navigate('/setup', { replace: true });
  };

  const goManageHome = () => {
    setConfirm(null);
    navigate('/home-settings');
  };

  const handleReset = () => {
    resetSettings();
    resetDemoState();
    setConfirm(null);
    navigate('/setup', { replace: true });
  };

  return (
    <PageLayout title="ตั้งค่า" description="จัดการข้อมูลบ้านของคุณแบบง่าย ๆ" back={false}>

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-slate-200">
          <SettingsRow to="/settings/profile" label="โปรไฟล์ของฉัน" value={settings.nickname} />
          <SettingsRow
            to="/settings/reminders"
            label="การเตือน"
            value={
              enabledReminders > 0
                ? `เปิด ${enabledReminders} จาก 3 อย่าง · เตือนยาเหลือ ${settings.reminders.lowStockDays} วัน`
                : 'ปิดการเตือนทั้งหมด'
            }
          />
          <SettingsRow
            to="/settings/privacy"
            label="ความเป็นส่วนตัว"
            value={
              pendingRequests > 0 ? `${privacySummary} · มี ${pendingRequests} คำขอรออนุมัติ` : privacySummary
            }
          />
          <SettingsRow
            to="/settings/data"
            label="ข้อมูลและความยินยอมของฉัน"
            value="ขอสำเนา ถอนความยินยอม ลบบัญชี"
          />
          <SettingsRow
            to="/settings/font-size"
            label="ขนาดตัวอักษร"
            value={fontScaleLabel(settings.fontScale)}
          />
        </ul>
      </Card>

      {isTestMode && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/60">
          <p className="text-sm font-bold text-slate-600">เครื่องมือสำหรับผู้พัฒนา</p>

          <div className="mt-4 space-y-3">
            <Button variant="neutral" fullWidth onClick={() => setConfirm('reset')}>
              รีเซ็ตข้อมูลสมมติ
            </Button>

            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('soft', 'md', true)}
            >
              ส่งความคิดเห็น
            </a>
          </div>
        </Card>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={() => setConfirm('leave')}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[58px] px-6 rounded-2xl sm:rounded-full bg-white/90 hover:bg-red-50 active:bg-red-100 border-2 border-red-300 text-red-700 text-lg font-bold transition-colors cursor-pointer"
        >
          <LogOut className="w-6 h-6" aria-hidden="true" />
          <span>ออกจากกลุ่มบ้าน</span>
        </button>
        {hasHomeNow && (
          <button
            type="button"
            onClick={() => setConfirm('logout')}
            className="mt-3 w-full min-h-[52px] px-6 rounded-2xl border border-slate-300 bg-white text-base font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            ออกจากระบบ
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'leave'}
        title={isSoloOwner ? 'ออกจากกลุ่มบ้านและลบบ้านนี้?' : isOwner ? 'ออกจากกลุ่มบ้านนี้ยังไม่ได้' : 'ออกจากกลุ่มบ้านนี้?'}
        message={
          isSoloOwner
            ? 'คุณอยู่คนเดียวในบ้านนี้ การออกจากกลุ่มบ้านจะลบบ้านและข้อมูลของบ้าน (บันทึกอาการ ปฏิทิน) ทั้งหมด กู้คืนไม่ได้ แล้วระบบจะพาไปหน้ากรอกรหัสบ้านหรือสร้างบ้านใหม่ ข้อมูลสุขภาพส่วนตัวของคุณยังอยู่'
            : isOwner
              ? 'คุณเป็นผู้ดูแลหลักของบ้านนี้ ต้องมอบบทบาทผู้ดูแลหลักให้คนอื่นก่อน แล้วค่อยออกจากกลุ่มบ้านได้ ไปจัดการที่หน้าตั้งค่าบ้านได้เลย'
              : 'คุณจะไม่เห็นข้อมูลของบ้านนี้อีก แล้วระบบจะพาไปหน้ากรอกรหัสบ้านหรือสร้างบ้านใหม่ ข้อมูลสุขภาพส่วนตัวของคุณยังอยู่'
        }
        confirmLabel={isSoloOwner ? 'ลบบ้านและออก' : isOwner ? 'ไปหน้าตั้งค่าบ้าน' : 'ออกจากกลุ่มบ้าน'}
        onCancel={() => setConfirm(null)}
        onConfirm={isSoloOwner ? handleDeleteAndLeave : isOwner ? goManageHome : handleLeaveHome}
      />

      <ConfirmDialog
        open={confirm === 'logout'}
        title="ออกจากระบบ?"
        message="คุณจะกลับไปหน้าเข้าสู่ระบบ ข้อมูลของบ้านและสมาชิกยังอยู่ครบ เข้ามาใหม่ได้ด้วยบัญชีเดิม"
        confirmLabel="ออกจากระบบ"
        onCancel={() => setConfirm(null)}
        onConfirm={handleLogout}
      />

      <ConfirmDialog
        open={confirm === 'reset'}
        title="รีเซ็ตข้อมูลสมมติ?"
        message="ข้อมูลทั้งหมดในเครื่องนี้จะถูกลบ ได้แก่ ข้อมูลสุขภาพ บ้านและรหัสชวน บันทึกอาการ กิจกรรมในปฏิทิน และรูปที่แนบไว้ แล้วเริ่มใหม่ที่หน้าตั้งค่าบ้าน กู้คืนไม่ได้"
        confirmLabel="รีเซ็ตข้อมูล"
        onCancel={() => setConfirm(null)}
        onConfirm={handleReset}
      />
    </PageLayout>
  );
};
