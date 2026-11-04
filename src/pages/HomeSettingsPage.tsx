import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Camera, Check, ChevronDown, Copy, Crown, House, Image as ImageIcon, MessageCircle, Plus, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { TextField } from '../components/ui/TextField';
import { NativeSelect } from '../components/ui/NativeSelect';
import { ConditionPicker } from '../components/ui/ConditionPicker';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { COUNTRIES, DEFAULT_COUNTRY, THAI_PROVINCES } from '../data/addressOptions';
import { MEDICAL_CONDITIONS } from '../data/medicalConditions';
import { TIME_ZONE_OPTIONS } from '../data/timeZones';
import { deleteFiles } from '../lib/fileStore';
import { cloudEnabled } from '../cloud/client';
import {
  deleteHome as cloudDeleteHome,
  explainError,
  regenerateInvite,
  removeMember as cloudRemoveMember,
  setMemberRole as cloudSetMemberRole,
  transferOwnership as cloudTransferOwnership,
} from '../cloud/engine';
import { loadEvents, clearCalendar } from '../lib/calendar';
import { clearJournal } from '../lib/journal';
import { copyToClipboard } from '../lib/clipboard';
import { clearHomeSetup } from '../lib/homeSetup';
import { resetHomeData } from '../lib/storage';
import { resizeToAvatar, resizeToBanner } from '../lib/photo';
import { cn } from '../lib/cn';
import {
  CURRENT_MEMBER_ID,
  ROLE_META,
  ROLE_ORDER,
  canManageHome,
  defaultSettings,
  generateInviteCode,
  loadSettings,
  saveSettings,
  type AppSettings,
  type HouseholdMember,
  type MemberRole,
} from '../lib/settings';

const MAX_HOME_NAME = 40;
const COPIED_LABEL_MS = 2000;

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));
const PROVINCE_OPTIONS = [
  { value: '', label: 'เลือกจังหวัด' },
  ...THAI_PROVINCES.map((name) => ({ value: name, label: name })),
];

/** "482 916" เพื่อให้อ่านและบอกต่อได้ง่าย */
const formatCode = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : `${code.slice(0, 3)} ${code.slice(3)}`;

/** ป้ายบทบาทแบบ Discord: จุดสี + ชื่อบทบาท */
const RoleChip: React.FC<{ role: MemberRole; className?: string }> = ({ role, className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-2 min-h-[32px] px-3 rounded-full border border-slate-300 bg-slate-50 text-sm sm:text-base font-semibold text-slate-800',
      className
    )}
  >
    {role === 'owner' ? (
      <Crown className="w-4 h-4 text-amber-500 fill-amber-400" aria-hidden="true" />
    ) : (
      <span className={cn('w-3 h-3 rounded-full', ROLE_META[role].dot)} aria-hidden="true" />
    )}
    {ROLE_META[role].label}
  </span>
);

/** ปุ่ม “บทบาท +” เปิดเมนูเลือกบทบาท (หนึ่งคนมีหนึ่งบทบาท) */
const RoleMenu: React.FC<{
  member: HouseholdMember;
  onSelect: (role: MemberRole) => void;
}> = ({ member, onSelect }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`เปลี่ยนบทบาทของ ${member.name}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-full border border-dashed border-slate-400 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>บทบาท</span>
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`บทบาทของ ${member.name}`}
          className="absolute left-0 sm:left-auto sm:right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {ROLE_ORDER.map((role) => {
            const meta = ROLE_META[role];
            const selected = member.role === role;
            return (
              <button
                key={role}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onSelect(role);
                }}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50 cursor-pointer"
              >
                {role === 'owner' ? (
                  <Crown className="w-5 h-5 mt-0.5 shrink-0 text-amber-500 fill-amber-400" aria-hidden="true" />
                ) : (
                  <span className={cn('w-4 h-4 mt-1 mx-0.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold text-slate-900">{meta.label}</span>
                  <span className="block text-sm text-slate-600">{meta.description}</span>
                </span>
                {selected && <Check className="w-5 h-5 mt-0.5 shrink-0 text-purple-700" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SectionTitle: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="mb-5">
    <h2 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h2>
    {hint && <p className="mt-1 text-base text-slate-600">{hint}</p>}
  </div>
);

const dangerButton =
  'inline-flex items-center justify-center min-h-[54px] px-6 rounded-2xl sm:rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-base sm:text-lg font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

interface ManageRowProps {
  title: string;
  description: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

const ManageRow: React.FC<ManageRowProps> = ({ title, description, label, danger, onClick }) => (
  <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-2xl border border-slate-200 p-4">
    <div className="min-w-0 flex-1">
      <p className="text-base sm:text-lg font-bold text-slate-900">{title}</p>
      <p className="mt-0.5 text-sm sm:text-base text-slate-600">{description}</p>
    </div>
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center justify-center min-h-[48px] px-6 rounded-full text-base font-bold transition-colors cursor-pointer',
        danger
          ? 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200'
          : 'bg-purple-50 text-purple-900 hover:bg-purple-100 active:bg-purple-200'
      )}
    >
      {label}
    </button>
  </li>
);

interface ProfileForm {
  homeName: string;
  timeZone: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zip: string;
}

const toForm = (s: AppSettings): ProfileForm => ({
  homeName: s.homeName,
  timeZone: s.home.timeZone,
  address1: s.home.address1,
  address2: s.home.address2,
  country: s.home.country,
  state: s.home.state,
  city: s.home.city,
  zip: s.home.zip,
});

/** ตั้งค่าบ้าน (ระบบบ้าน): ข้อมูลบ้าน รูป โรคในบ้าน รหัสชวน สมาชิก และการจัดการบ้าน ทุกคนในบ้านเห็นสิ่งที่แก้ที่นี่ */
export const HomeSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [settings, setSettings] = useState(loadSettings);
  const [form, setForm] = useState<ProfileForm>(() => toForm(settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmChange, setConfirmChange] = useState(false);
  const [removingMember, setRemovingMember] = useState<HouseholdMember | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // เฉพาะ “ผู้ดูแลหลักของบ้าน” เท่านั้นที่เห็นหน้านี้ จัดการบ้านและมอบบทบาทได้
  const canManage = canManageHome(settings);
  const home = settings.home;
  const isThailand = form.country === DEFAULT_COUNTRY;

  const code = settings.inviteCode;
  const shownCode = formatCode(code);
  const shareText = `ชวนเข้าร่วมบ้าน "${settings.homeName}" บน Growa Homecare ใช้รหัสชวน ${shownCode} ${window.location.origin}`;

  const dirty = JSON.stringify({ ...form, homeName: form.homeName.trim() }) !== JSON.stringify(toForm(settings));

  const commit = (next: AppSettings) => setSettings(saveSettings(next));
  const setField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  // ----- โปรไฟล์บ้าน -----
  const handleCancel = () => {
    setForm(toForm(settings));
    setErrors({});
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!form.homeName.trim()) found['home-name'] = 'กรอกชื่อบ้านก่อนนะ';
    if (isThailand && form.zip.trim() && !/^\d{5}$/.test(form.zip.trim())) {
      found['home-zip'] = 'รหัสไปรษณีย์ไทยมี 5 หลัก';
    }
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    const { homeName, ...address } = form;
    const trimmed = Object.fromEntries(Object.entries(address).map(([k, v]) => [k, v.trim()])) as Omit<
      ProfileForm,
      'homeName'
    >;
    const next = { ...settings, homeName: homeName.trim(), home: { ...settings.home, ...trimmed } };
    commit(next);
    setForm(toForm(next));
    toast.show('บันทึกข้อมูลบ้านแล้ว');
  };

  // ----- รูปบ้าน / โรคในบ้าน (บันทึกทันที) -----
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const photo = await resizeToAvatar(file);
      commit({ ...settings, home: { ...settings.home, photo } });
      toast.show('เปลี่ยนรูปบ้านแล้ว');
    } catch {
      setPhotoError('ใช้ไฟล์นี้ไม่ได้ เลือกรูปภาพ (JPG, PNG) อีกครั้ง');
    }
  };

  const removePhoto = () => {
    commit({ ...settings, home: { ...settings.home, photo: '' } });
    toast.show('ลบรูปบ้านแล้ว');
  };

  const handleBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBannerError('');
    try {
      const banner = await resizeToBanner(file);
      commit({ ...settings, home: { ...settings.home, banner } });
      toast.show('เปลี่ยนภาพพื้นหลังบ้านแล้ว');
    } catch {
      setBannerError('ใช้ไฟล์นี้ไม่ได้ เลือกรูปภาพ (JPG, PNG) อีกครั้ง');
    }
  };

  const removeBanner = () => {
    commit({ ...settings, home: { ...settings.home, banner: '' } });
    toast.show('ลบภาพพื้นหลังบ้านแล้ว');
  };

  const changeConditions = (conditions: string[]) => commit({ ...settings, home: { ...settings.home, conditions } });

  // ----- รหัสชวน -----
  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_LABEL_MS);
      toast.show('คัดลอกแล้ว');
    } else {
      toast.show('คัดลอกไม่ได้ กรุณากดค้างที่รหัสเพื่อคัดลอกเอง', { tone: 'error' });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'ชวนเข้าร่วมบ้าน Growa Homecare', text: shareText });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  /** ทำรายการกับเซิร์ฟเวอร์ แล้วโหลดข้อมูลบ้านล่าสุดมาแสดง (ถ้าล้มเหลวจะแจ้งเหตุผล) */
  const runCloud = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      setSettings(loadSettings());
      return true;
    } catch (err) {
      toast.show(explainError(err), { tone: 'error' });
      return false;
    }
  };

  const handleChangeCode = async () => {
    if (cloudEnabled) {
      if (!(await runCloud(regenerateInvite))) return;
    } else {
      commit({ ...settings, inviteCode: generateInviteCode() });
    }
    setCopied(false);
    setConfirmChange(false);
    toast.show('เปลี่ยนรหัสใหม่แล้ว');
  };

  // ----- สมาชิก -----
  const [roleChange, setRoleChange] = useState<{ member: HouseholdMember; role: MemberRole } | null>(null);

  const changeRole = async (member: HouseholdMember, role: MemberRole) => {
    // ผู้ดูแลหลักมีได้คนเดียว: ต้องเตือนก่อนมอบ เพราะเราจะเสียบทบาทนี้ไป
    if (role === 'owner') {
      setRoleChange({ member, role });
      return;
    }
    if (cloudEnabled) {
      if (!(await runCloud(() => cloudSetMemberRole(member.id, role as 'member' | 'external')))) return;
    } else {
      commit({ ...settings, members: settings.members.map((m) => (m.id === member.id ? { ...m, role } : m)) });
    }
    toast.show(`ให้บทบาท “${ROLE_META[role].label}” กับ ${member.name} แล้ว`);
  };

  const confirmRemoveMember = async () => {
    if (!removingMember) return;
    const name = removingMember.name;
    if (cloudEnabled) {
      if (!(await runCloud(() => cloudRemoveMember(removingMember.id)))) return;
    } else {
      commit({ ...settings, members: settings.members.filter((m) => m.id !== removingMember.id) });
    }
    setRemovingMember(null);
    toast.show(`นำ ${name} ออกจากบ้านแล้ว`);
  };

  // ----- จัดการบ้าน -----
  const otherMembers = settings.members.filter((m) => m.role !== 'owner');

  const transferOwnership = async (targetId: string) => {
    const target = settings.members.find((m) => m.id === targetId);
    if (!target) return;
    if (cloudEnabled) {
      if (!(await runCloud(() => cloudTransferOwnership(target.id)))) return;
    } else {
      commit({
        ...settings,
        members: settings.members.map((m) =>
          m.id === target.id
            ? { ...m, role: 'owner' as const }
            : m.role === 'owner'
              ? { ...m, role: 'member' as const }
              : m
        ),
      });
    }
    setTransferOpen(false);
    setTransferTo('');
    setRoleChange(null);
    toast.show(`มอบบทบาทผู้ดูแลหลักให้ ${target.name} แล้ว`);
  };

  const setActive = (active: boolean) => {
    commit({ ...settings, home: { ...settings.home, active } });
    setDeactivateOpen(false);
    toast.show(active ? 'เปิดใช้งานบ้านอีกครั้งแล้ว' : 'ปิดใช้งานบ้านชั่วคราวแล้ว');
  };

  const handleDeleteHome = async () => {
    if (cloudEnabled) {
      if (!(await runCloud(cloudDeleteHome))) return;
      void deleteFiles(loadEvents().flatMap((ev) => ev.attachments));
      navigate('/setup', { replace: true });
      return;
    }
    // ลบข้อมูลของบ้าน (กิจกรรม บันทึกอาการ) แต่เก็บโปรไฟล์ส่วนตัวและข้อมูลสุขภาพของเราไว้
    void deleteFiles(loadEvents().flatMap((ev) => ev.attachments));
    clearCalendar();
    clearJournal();
    clearHomeSetup();
    resetHomeData();
    saveSettings({ ...defaultSettings(), profile: settings.profile, nickname: settings.nickname });
    navigate('/setup', { replace: true });
  };

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeleteConfirmText('');
  };

  // สมาชิกและผู้ดูแลภายนอกไม่เห็นหน้านี้ (รวมถึงหลังมอบบทบาทผู้ดูแลหลักให้คนอื่นแล้ว)
  if (!canManage) return <Navigate to="/calendar" replace />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        eyebrow="ระบบบ้าน"
        title="ตั้งค่าบ้าน"
        description="ข้อมูลบ้าน สมาชิก และการจัดการบ้าน สิ่งที่เปลี่ยนที่นี่ทุกคนในบ้านจะเห็น"
      />

      {!home.active && (
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="flex-1 text-base font-semibold text-amber-900">
              บ้านนี้ปิดใช้งานชั่วคราว สมาชิกจะยังไม่เห็นการเปลี่ยนแปลงใหม่จนกว่าจะเปิดใช้งานอีกครั้ง
            </p>
            {canManage && (
              <Button type="button" size="sm" onClick={() => setActive(true)}>
                เปิดใช้งานอีกครั้ง
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6 lg:items-start">
        {/* ซ้าย: โปรไฟล์บ้าน + โรคในบ้าน */}
        <div className="space-y-6 min-w-0">
          <Card className="p-6 sm:p-8">
            <form onSubmit={handleSaveProfile} noValidate>
              <div className="contents">
                <SectionTitle title="โปรไฟล์บ้าน" />
                <div className="space-y-5">
                  <TextField
                    id="home-name"
                    label="ชื่อบ้าน"
                    maxLength={MAX_HOME_NAME}
                    autoComplete="off"
                    value={form.homeName}
                    error={errors['home-name']}
                    onChange={(e) => setField('homeName', e.target.value)}
                  />
                  <NativeSelect
                    id="home-timezone"
                    label="เขตเวลา"
                    labelSuffix="(ไม่บังคับ)"
                    options={TIME_ZONE_OPTIONS}
                    value={form.timeZone}
                    onChange={(v) => setField('timeZone', v)}
                  />
                </div>

                <h3 className="mt-8 mb-4 text-lg font-bold text-slate-900">ที่อยู่ของบ้าน</h3>
                <div className="space-y-5">
                  <TextField
                    id="home-address1"
                    label="ที่อยู่ (บรรทัดที่ 1)"
                    labelSuffix="(ไม่บังคับ)"
                    autoComplete="off"
                    value={form.address1}
                    onChange={(e) => setField('address1', e.target.value)}
                  />
                  <TextField
                    id="home-address2"
                    label="ที่อยู่ (บรรทัดที่ 2)"
                    labelSuffix="(ไม่บังคับ)"
                    autoComplete="off"
                    value={form.address2}
                    onChange={(e) => setField('address2', e.target.value)}
                  />
                  <NativeSelect
                    id="home-country"
                    label="ประเทศ"
                    labelSuffix="(ไม่บังคับ)"
                    options={COUNTRY_OPTIONS}
                    value={form.country}
                    onChange={(v) => setForm((prev) => ({ ...prev, country: v, state: '' }))}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <TextField
                      id="home-city"
                      label={isThailand ? 'อำเภอ / เขต' : 'เมือง'}
                      labelSuffix="(ไม่บังคับ)"
                      autoComplete="off"
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                    />
                    {isThailand ? (
                      <NativeSelect
                        id="home-state"
                        label="จังหวัด"
                        labelSuffix="(ไม่บังคับ)"
                        options={PROVINCE_OPTIONS}
                        value={form.state}
                        onChange={(v) => setField('state', v)}
                      />
                    ) : (
                      <TextField
                        id="home-state"
                        label="รัฐ / แคว้น"
                        labelSuffix="(ไม่บังคับ)"
                        autoComplete="off"
                        value={form.state}
                        onChange={(e) => setField('state', e.target.value)}
                      />
                    )}
                    <TextField
                      id="home-zip"
                      label="รหัสไปรษณีย์"
                      labelSuffix="(ไม่บังคับ)"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.zip}
                      error={errors['home-zip']}
                      onChange={(e) => setField('zip', e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  <Button type="button" variant="neutral" fullWidth disabled={!dirty} onClick={handleCancel}>
                    ยกเลิก
                  </Button>
                  <Button type="submit" fullWidth disabled={!dirty}>
                    บันทึก
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          <Card className="p-6 sm:p-8">
            <SectionTitle
              title="โรคและภาวะสุขภาพในบ้าน"
              hint="บอกโรคหรือภาวะของคนในบ้าน เพื่อให้ระบบแนะนำและเตือนได้ตรงกับครอบครัวคุณมากขึ้น"
            />
            <ConditionPicker
              id="home-conditions"
              label="โรคและภาวะสุขภาพ"
              hint="กดเลือกจากรายการ ค้นหาได้ ติ๊กได้หลายโรค ถ้าไม่มีในรายการพิมพ์เพิ่มเองได้"
              modalTitle="เลือกโรคและภาวะสุขภาพ"
              options={MEDICAL_CONDITIONS}
              value={home.conditions}
              onChange={changeConditions}
             
            />
          </Card>
        </div>

        {/* ขวา: รูปบ้าน + รหัสชวน + จัดการบ้าน */}
        <div className="space-y-6 min-w-0">
          <Card className="p-6 sm:p-8">
            <SectionTitle title="รูปบ้าน" />
            <div className="flex flex-col items-center gap-4">
              {home.photo ? (
                <img src={home.photo} alt="รูปบ้าน" className="w-32 h-32 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="w-32 h-32 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"
                >
                  <House className="w-14 h-14" />
                </span>
              )}
              <input
                ref={fileRef}
                id="home-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={handlePhoto}
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
                  <Camera className="w-5 h-5" aria-hidden="true" />
                  <span>{home.photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}</span>
                </Button>
                {home.photo && (
                  <Button type="button" variant="soft" size="sm" onClick={removePhoto}>
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                    <span>ลบรูป</span>
                  </Button>
                )}
              </div>
              {photoError && (
                <p role="alert" className="text-base font-semibold text-red-700">
                  {photoError}
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <SectionTitle title="ภาพพื้นหลังบ้าน" hint="แสดงที่มุมบนซ้ายของแอป คล้ายแบนเนอร์เซิร์ฟเวอร์ใน Discord" />
            <div className="flex flex-col gap-4">
              <div className="relative h-28 rounded-2xl overflow-hidden border border-slate-200 bg-purple-50 flex items-end">
                {home.banner ? (
                  <img src={home.banner} alt="ภาพพื้นหลังบ้าน" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-purple-400" aria-hidden="true">
                    <ImageIcon className="w-10 h-10" />
                  </span>
                )}
                {home.banner && (
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
                )}
                <span className={'relative px-4 pb-3 text-lg font-bold truncate max-w-full ' + (home.banner ? 'text-white drop-shadow' : 'text-purple-700')}>
                  {settings.homeName || 'ชื่อบ้าน'}
                </span>
              </div>
              <input
                ref={bannerRef}
                id="home-banner"
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={handleBanner}
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" size="sm" onClick={() => bannerRef.current?.click()}>
                  <ImageIcon className="w-5 h-5" aria-hidden="true" />
                  <span>{home.banner ? 'เปลี่ยนภาพพื้นหลัง' : 'อัปโหลดภาพพื้นหลัง'}</span>
                </Button>
                {home.banner && (
                  <Button type="button" variant="soft" size="sm" onClick={removeBanner}>
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                    <span>ลบภาพ</span>
                  </Button>
                )}
              </div>
              {bannerError && (
                <p role="alert" className="text-base font-semibold text-red-700">
                  {bannerError}
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <SectionTitle title="รหัสชวน" hint="ให้ญาติกด “เข้าร่วมบ้าน” แล้วใส่รหัสนี้" />
            <div className="rounded-2xl bg-purple-50 border border-purple-200 px-4 py-6 text-center [container-type:inline-size]">
              <p className="text-base font-semibold text-purple-900 flex items-center justify-center gap-1.5">
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                รหัสชวน 8 หลัก
              </p>
              {/* ขนาดตัวเลขปรับตามความกว้างกล่อง เลขจึงไม่ล้นแม้จอหรือกล่องแคบ */}
              <p className="mt-2 text-[clamp(1.5rem,11cqw,3rem)] leading-tight font-extrabold tracking-[0.08em] text-purple-700 whitespace-nowrap select-all">
                {shownCode}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
              <Button fullWidth onClick={handleShare}>
                <Share2 className="w-6 h-6" aria-hidden="true" />
                <span>ชวนทางไลน์</span>
              </Button>
              <Button variant="soft" fullWidth onClick={handleCopy}>
                {copied ? <Check className="w-6 h-6" aria-hidden="true" /> : <Copy className="w-6 h-6" aria-hidden="true" />}
                <span>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกรหัส'}</span>
              </Button>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setConfirmChange(true)}
                className="mt-2 w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl text-base font-bold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" aria-hidden="true" />
                <span>เปลี่ยนรหัสใหม่</span>
              </button>
            )}
          </Card>

          {canManage && (
            <Card className="p-6 sm:p-8">
              <SectionTitle title="จัดการบ้าน" hint="เฉพาะผู้ดูแลหลักเท่านั้นที่เห็นส่วนนี้" />
              <ul className="space-y-3">
                <ManageRow
                  title="โอนความเป็นเจ้าของบ้าน"
                  description="ยกความเป็นผู้ดูแลหลักของบ้านนี้ให้สมาชิกคนอื่น"
                  label="โอนบ้าน"
                  onClick={() => setTransferOpen(true)}
                />
                <ManageRow
                  title={home.active ? 'ปิดใช้งานบ้านชั่วคราว' : 'เปิดใช้งานบ้าน'}
                  description={home.active ? 'พักการใช้งานบ้านนี้ไว้ก่อน กลับมาเปิดได้ทุกเมื่อ' : 'บ้านนี้ปิดอยู่ กดเพื่อเปิดใช้งานอีกครั้ง'}
                  label={home.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  onClick={() => (home.active ? setDeactivateOpen(true) : setActive(true))}
                />
                <ManageRow
                  title="ลบบ้าน"
                  description="ลบบ้านนี้และข้อมูลของบ้านทั้งหมดถาวร ย้อนกลับไม่ได้"
                  label="ลบบ้าน"
                  danger
                  onClick={() => setDeleteOpen(true)}
                />
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* บทบาทในบ้าน (คล้ายระบบบทบาทของ Discord) */}
      <Card className="p-0">
        <div className="px-6 sm:px-8 pt-6 sm:pt-8">
          <SectionTitle
            title={`สมาชิกและบทบาท (${settings.members.length} คน)`}
            hint="บทบาทกำหนดว่าใครทำอะไรในบ้านได้ หนึ่งคนมีหนึ่งบทบาท"
          />
          <ul className="grid gap-3 lg:grid-cols-3 pb-6">
            {ROLE_ORDER.map((role) => (
              <li key={role} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <RoleChip role={role} className="bg-white" />
                <p className="mt-2 text-sm sm:text-base text-slate-600">{ROLE_META[role].description}</p>
              </li>
            ))}
          </ul>
        </div>

        {settings.members.length === 0 ? (
          <p className="px-5 py-10 text-center text-base text-slate-600">ยังไม่มีสมาชิกในบ้านนี้</p>
        ) : (
          <ul className="divide-y divide-slate-200 border-t border-slate-200">
            {settings.members.map((member) => {
              const isOwnerRow = member.role === 'owner';
              return (
                <li
                  key={member.id}
                  className="px-6 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Avatar
                      name={member.name}
                      src={member.id === CURRENT_MEMBER_ID ? settings.profile.photo : undefined}
                      className="w-12 h-12 text-xl"
                    />
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-900 break-words">
                        {member.name}
                        {member.id === CURRENT_MEMBER_ID && <span className="font-normal text-slate-600"> (คุณ)</span>}
                      </p>
                      <p className="text-base text-slate-600 break-words">{member.relation}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <RoleChip role={member.role} />
                    {!isOwnerRow && <RoleMenu member={member} onSelect={(role) => changeRole(member, role)} />}
                    {!isOwnerRow && (
                      <button
                        type="button"
                        onClick={() => setRemovingMember(member)}
                        className="inline-flex items-center min-h-[40px] px-3 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-50 active:bg-red-100 transition-colors cursor-pointer"
                      >
                        นำออก
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmChange}
        title="เปลี่ยนรหัสชวนใหม่?"
        message="รหัสเดิมจะใช้ไม่ได้ทันที ญาติที่ยังไม่ได้เข้าร่วมบ้านต้องขอรหัสใหม่จากคุณ ส่วนคนที่อยู่ในบ้านแล้วไม่ได้รับผลกระทบ"
        confirmLabel="เปลี่ยนรหัส"
        tone="primary"
        onCancel={() => setConfirmChange(false)}
        onConfirm={handleChangeCode}
      />

      <ConfirmDialog
        open={!!removingMember}
        title={`นำ ${removingMember?.name ?? ''} ออกจากบ้าน?`}
        message={`${removingMember?.name ?? 'สมาชิกคนนี้'} จะเปิดดูข้อมูลของบ้านนี้ไม่ได้อีก ถ้าต้องการให้กลับมา ต้องชวนด้วยรหัสอีกครั้ง`}
        confirmLabel="นำออก"
        onCancel={() => setRemovingMember(null)}
        onConfirm={confirmRemoveMember}
      />

      <ConfirmDialog
        open={!!roleChange}
        title={`มอบบทบาทผู้ดูแลหลักให้ ${roleChange?.member.name ?? ''}?`}
        message={`บทบาทผู้ดูแลหลักของบ้านมีได้แค่คนเดียว เมื่อมอบให้ ${roleChange?.member.name ?? 'สมาชิกคนนี้'} คุณจะกลายเป็น “สมาชิกในบ้าน” ทันที และจะเข้าหน้าตั้งค่าบ้านหรือมอบบทบาทไม่ได้อีก การเปลี่ยนกลับต้องให้ผู้ดูแลหลักคนใหม่เป็นคนมอบให้`}
        confirmLabel="มอบบทบาท"
        onCancel={() => setRoleChange(null)}
        onConfirm={() => roleChange && transferOwnership(roleChange.member.id)}
      />

      <ConfirmDialog
        open={deactivateOpen}
        title="ปิดใช้งานบ้านชั่วคราว?"
        message="บ้านนี้จะถูกพักการใช้งาน ข้อมูลทั้งหมดยังอยู่ครบ และเปิดใช้งานอีกครั้งได้ทุกเมื่อจากหน้านี้"
        confirmLabel="ปิดใช้งาน"
        tone="primary"
        onCancel={() => setDeactivateOpen(false)}
        onConfirm={() => setActive(false)}
      />

      <Modal
        open={transferOpen}
        onClose={() => {
          setTransferOpen(false);
          setTransferTo('');
        }}
        title="โอนความเป็นเจ้าของบ้าน"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="neutral"
              fullWidth
              onClick={() => {
                setTransferOpen(false);
                setTransferTo('');
              }}
            >
              ยกเลิก
            </Button>
            <Button fullWidth disabled={!transferTo} onClick={() => transferOwnership(transferTo)}>
              โอนบ้าน
            </Button>
          </div>
        }
      >
        <div className="py-6 space-y-4">
          <p className="text-base text-slate-700">
            เลือกสมาชิกที่จะเป็นผู้ดูแลหลักคนใหม่ หลังโอนแล้วคุณจะไม่สามารถจัดการสมาชิก รหัสชวน หรือตัวบ้านได้อีก
          </p>
          {otherMembers.length === 0 ? (
            <p className="text-base font-semibold text-slate-600">ยังไม่มีสมาชิกคนอื่นให้โอน ชวนญาติเข้าบ้านก่อนนะ</p>
          ) : (
            <ul className="space-y-1">
              {otherMembers.map((member) => (
                <li key={member.id}>
                  <label className="flex items-center gap-3 min-h-[56px] px-3 rounded-2xl cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="transfer-to"
                      checked={transferTo === member.id}
                      onChange={() => setTransferTo(member.id)}
                      className="w-5 h-5 text-purple-700 focus:ring-purple-600"
                    />
                    <Avatar src={member.id === CURRENT_MEMBER_ID ? settings.profile.photo : member.photo} name={member.name} className="w-10 h-10 text-lg" />
                    <span className="text-base text-slate-900">
                      {member.name} <span className="text-sm text-slate-500">· {member.relation}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={closeDelete}
        title="ลบบ้านนี้ถาวร?"
        initialFocusSelector="#home-delete-confirm"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button variant="neutral" fullWidth onClick={closeDelete}>
              ยกเลิก
            </Button>
            <button
              type="button"
              className={dangerButton}
              disabled={deleteConfirmText.trim() !== settings.homeName}
              onClick={handleDeleteHome}
            >
              ลบบ้าน
            </button>
          </div>
        }
      >
        <div className="py-6 space-y-4">
          <p className="text-base text-slate-700">
            กิจกรรมในปฏิทิน บันทึกอาการ และไฟล์แนบของบ้านนี้จะถูกลบทั้งหมด ย้อนกลับไม่ได้ ข้อมูลส่วนตัวของคุณ (ตู้ยา ข้อมูลสุขภาพ และโปรไฟล์) จะยังอยู่
          </p>
          <TextField
            id="home-delete-confirm"
            label={`พิมพ์ชื่อบ้าน “${settings.homeName}” เพื่อยืนยัน`}
            autoComplete="off"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
