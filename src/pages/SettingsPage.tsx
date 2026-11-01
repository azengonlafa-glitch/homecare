import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { PageLayout } from '../components/settings/PageLayout';
import { Card } from '../components/ui/Card';
import { Button, buttonClass } from '../components/ui/Button';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { fontScaleLabel, getCurrentMember, loadSettings, resetSettings } from '../lib/settings';
import { resetDemoState } from '../lib/demo';
import { FEEDBACK_URL, PHARMACY } from '../lib/config';

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
      className="flex items-center gap-3 min-h-[72px] px-5 py-4 hover:bg-purple-50 active:bg-purple-100 transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-base sm:text-lg font-bold text-slate-900 break-words">{label}</span>
        {value && <span className="block mt-0.5 text-sm text-slate-600 truncate">{value}</span>}
      </span>
      <ChevronRight className="w-6 h-6 shrink-0 text-slate-500" aria-hidden="true" />
    </Link>
  </li>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // เครื่องมือทดสอบแสดงเฉพาะเมื่อ URL มี ?test=1
  const isTestMode = params.get('test') === '1';

  const [settings] = useState(loadSettings);
  const [confirm, setConfirm] = useState<'logout' | 'reset' | null>(null);

  const currentMember = getCurrentMember(settings);
  const canManageMembers = currentMember?.permission === 'edit';
  const enabledReminders = [
    settings.reminders.lowStock,
    settings.reminders.doseWindow,
    settings.reminders.appointment,
  ].filter(Boolean).length;

  const handleLogout = () => {
    localStorage.removeItem('growa_auth_user');
    navigate('/login', { replace: true });
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
          <SettingsRow to="/settings/home" label="บ้านและรหัสชวน" value={settings.homeName} />
          <SettingsRow
            to="/settings/members"
            label="สมาชิกในบ้าน"
            value={`${settings.members.length} คน${canManageMembers ? '' : ' · คุณดูได้อย่างเดียว'}`}
          />
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
            to="/settings/font-size"
            label="ขนาดตัวอักษร"
            value={fontScaleLabel(settings.fontScale)}
          />
          <SettingsRow to="/settings/pharmacy" label="ร้านยาของเรา" value={PHARMACY.name} />
          <SettingsRow to="/settings/about" label="เกี่ยวกับต้นแบบ" />
        </ul>
      </Card>

      {isTestMode && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/60">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">เครื่องมือทดสอบ</p>
          <p className="mt-1 text-sm text-slate-600">แสดงเฉพาะเมื่อเปิดลิงก์ด้วย ?test=1</p>

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
          onClick={() => setConfirm('logout')}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[58px] px-6 rounded-2xl sm:rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-lg font-bold shadow-sm shadow-red-200 transition-colors cursor-pointer"
        >
          <LogOut className="w-6 h-6" aria-hidden="true" />
          <span>ออกจากบ้าน</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirm === 'logout'}
        title="ออกจากบ้าน?"
        message="คุณจะออกจากระบบและกลับไปหน้าเข้าสู่ระบบ ข้อมูลของบ้านและสมาชิกยังอยู่ครบ เข้ามาใหม่ได้ด้วยบัญชีเดิม"
        confirmLabel="ออกจากบ้าน"
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
