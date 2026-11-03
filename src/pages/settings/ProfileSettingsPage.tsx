import React, { useRef, useState } from 'react';
import { Camera, Mail, Trash2 } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { resizeToAvatar } from '../../lib/photo';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { CheckboxField } from '../../components/ui/CheckboxField';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { PageLayout } from '../../components/settings/PageLayout';
import { COUNTRIES, DEFAULT_COUNTRY, THAI_PROVINCES } from '../../data/addressOptions';
import { TIME_ZONE_OPTIONS } from '../../data/timeZones';
import { CURRENT_MEMBER_ID, loadSettings, saveSettings, type UserProfile } from '../../lib/settings';

const MAX_NICKNAME = 20;

const COUNTRY_OPTIONS = COUNTRIES.map((name) => ({ value: name, label: name }));
const PROVINCE_OPTIONS = [
  { value: '', label: 'เลือกจังหวัด' },
  ...THAI_PROVINCES.map((name) => ({ value: name, label: name })),
];

const phonePattern = /^0\d{8,9}$/;
import { cloudEnabled } from '../../cloud/client';
import { changeLoginEmail, explainError } from '../../cloud/engine';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState extends UserProfile {
  nickname: string;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-lg font-bold text-slate-900 mb-4">{children}</h2>
);

/** หน้าต่างเปลี่ยนอีเมล */
const EmailDialog: React.FC<{ current: string; onClose: () => void; onUse: (email: string) => void | Promise<void> }> = ({
  current,
  onClose,
  onUse,
}) => {
  const [value, setValue] = useState(current);
  const [error, setError] = useState('');

  const submit = () => {
    const email = value.trim();
    if (!emailPattern.test(email)) {
      setError('กรอกอีเมลให้ถูกต้อง เช่น name@example.com');
      document.getElementById('profile-new-email')?.focus();
      return;
    }
    onUse(email);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="เปลี่ยนอีเมล"
      initialFocusSelector="#profile-new-email"
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="neutral" fullWidth onClick={onClose}>
            ยกเลิก
          </Button>
          <Button fullWidth onClick={submit}>
            ใช้อีเมลนี้
          </Button>
        </div>
      }
    >
      <form
        className="py-6 space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField
          id="profile-new-email"
          name="email"
          type="email"
          label="อีเมลใหม่"
          hint={cloudEnabled ? 'เราจะส่งลิงก์ยืนยันไปที่อีเมลใหม่ อีเมลเข้าสู่ระบบจะเปลี่ยนเมื่อกดลิงก์' : 'อีเมลจะถูกบันทึกเมื่อกด “บันทึก” ในหน้าโปรไฟล์'}
          autoComplete="email"
          value={value}
          error={error}
          onChange={(e) => {
            setValue(e.target.value);
            setError('');
          }}
        />
      </form>
    </Modal>
  );
};

/** ตั้งค่า > โปรไฟล์ของฉัน: ชื่อ ติดต่อ และที่อยู่ */
export const ProfileSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState(loadSettings);
  const toFormState = (s: typeof settings): FormState => ({ nickname: s.nickname, ...s.profile });
  const [form, setForm] = useState<FormState>(() => toFormState(settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailOpen, setEmailOpen] = useState(false);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState('');

  const saved = toFormState(settings);
  // ปุ่มบันทึก/ยกเลิกใช้ได้เมื่อมีการแก้จากค่าที่บันทึกไว้
  const dirty = JSON.stringify({ ...form, nickname: form.nickname.trim() }) !== JSON.stringify(saved);
  const isThailand = form.country === DEFAULT_COUNTRY;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      set('photo', await resizeToAvatar(file));
    } catch {
      setPhotoError('ใช้ไฟล์นี้ไม่ได้ เลือกรูปภาพ (JPG, PNG) อีกครั้ง');
    }
  };

  const handleCancel = () => {
    setForm(saved);
    setErrors({});
  };

  const validate = () => {
    const found: Record<string, string> = {};
    if (!form.nickname.trim()) found['settings-nickname'] = 'กรอกชื่อเล่นก่อนนะ';
    if (!form.firstName.trim()) found['profile-first'] = 'กรอกชื่อก่อนนะ';
    const phone = form.phone.replace(/\D/g, '');
    if (form.phone.trim() && !phonePattern.test(phone)) {
      found['profile-phone'] = 'กรอกเบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0';
    }
    if (isThailand && form.zip.trim() && !/^\d{5}$/.test(form.zip.trim())) {
      found['profile-zip'] = 'รหัสไปรษณีย์ไทยมี 5 หลัก';
    }
    return found;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    if (!dirty) return;

    const { nickname, ...profile } = form;
    const clean = nickname.trim();
    const trimmed = Object.fromEntries(
      Object.entries(profile).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    ) as unknown as UserProfile;

    const next = saveSettings({
      ...settings,
      nickname: clean,
      profile: trimmed,
      // ให้ชื่อในรายชื่อสมาชิกตรงกับชื่อเล่นที่เพิ่งแก้
      members: settings.members.map((member) =>
        member.id === CURRENT_MEMBER_ID ? { ...member, name: clean } : member
      ),
    });
    setSettings(next);
    setForm(toFormState(next));
    toast.show('บันทึกแล้ว');
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PageLayout
        wide
        title="โปรไฟล์ของฉัน"
        description="ข้อมูลส่วนตัวของคุณ แก้ไขได้ทุกช่อง"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="neutral" fullWidth disabled={!dirty} onClick={handleCancel}>
              ยกเลิก
            </Button>
            <Button type="submit" fullWidth disabled={!dirty}>
              บันทึก
            </Button>
          </div>
        }
      >
        {/* ชื่อ */}
        <Card>
          <SectionTitle>ชื่อ</SectionTitle>
          <div className="mb-6 flex items-center gap-4">
            <Avatar src={form.photo} name={form.nickname || form.firstName} className="w-24 h-24 text-4xl" />
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-slate-900">รูปโปรไฟล์</p>
              <input
                ref={fileRef}
                id="profile-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={handlePhoto}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="soft" size="sm" onClick={() => fileRef.current?.click()}>
                  <Camera className="w-5 h-5" aria-hidden="true" />
                  <span>{form.photo ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}</span>
                </Button>
                {form.photo && (
                  <Button type="button" variant="neutral" size="sm" onClick={() => set('photo', '')}>
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                    <span>ลบรูป</span>
                  </Button>
                )}
              </div>
              {photoError && (
                <p role="alert" className="mt-2 text-base font-semibold text-red-700">
                  {photoError}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <TextField
                id="settings-nickname"
                name="nickname"
                label="ชื่อเล่น"
                hint="ชื่อที่คนในบ้านจะเห็น"
                value={form.nickname}
                maxLength={MAX_NICKNAME}
                autoComplete="nickname"
                error={errors['settings-nickname']}
                onChange={(e) => set('nickname', e.target.value)}
              />
              <p
                className="mt-2 text-right text-base font-semibold text-slate-600"
                aria-label={`พิมพ์แล้ว ${form.nickname.length} จาก ${MAX_NICKNAME} ตัวอักษร`}
              >
                {form.nickname.length}/{MAX_NICKNAME}
              </p>
            </div>
            <TextField
              id="profile-first"
              name="given-name"
              label="ชื่อ"
              autoComplete="given-name"
              value={form.firstName}
              error={errors['profile-first']}
              onChange={(e) => set('firstName', e.target.value)}
            />
            <TextField
              id="profile-last"
              name="family-name"
              label="นามสกุล"
              labelSuffix="(ไม่บังคับ)"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
            />
          </div>
        </Card>

        {/* ติดต่อ */}
        <Card>
          <SectionTitle>ติดต่อ</SectionTitle>
          <div className="space-y-5">
            <div>
              <p className="text-base sm:text-lg font-bold text-slate-900">อีเมล</p>
              <p className="mt-1 text-base text-slate-700 break-all">{form.email || 'ยังไม่ได้ระบุอีเมล'}</p>
              <Button
                type="button"
                variant="soft"
                size="sm"
                fullWidth
                className="mt-3"
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="w-5 h-5" aria-hidden="true" />
                <span>เปลี่ยนอีเมล</span>
              </Button>
            </div>

            <CheckboxField
              id="profile-hide-email"
              checked={form.hideEmail}
              onChange={(v) => set('hideEmail', v)}
            >
              ซ่อนอีเมลของฉันจากสมาชิกคนอื่นในบ้าน
            </CheckboxField>

            <NativeSelect
              id="profile-timezone"
              label="เขตเวลา"
              labelSuffix="(ไม่บังคับ)"
              options={TIME_ZONE_OPTIONS}
              value={form.timeZone}
              onChange={(v) => set('timeZone', v)}
            />

            <TextField
              id="profile-phone"
              name="tel"
              type="tel"
              inputMode="tel"
              label="เบอร์โทรศัพท์"
              labelSuffix="(ไม่บังคับ)"
              placeholder="08x-xxx-xxxx"
              autoComplete="tel"
              value={form.phone}
              error={errors['profile-phone']}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
        </Card>

        {/* ที่อยู่ */}
        <Card className="lg:col-span-2">
          <SectionTitle>ที่อยู่</SectionTitle>
          <div className="space-y-5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-x-5 sm:gap-y-5">
            <TextField
              id="profile-address1"
              name="address-line1"
              label="ที่อยู่ (บรรทัดที่ 1)"
              labelSuffix="(ไม่บังคับ)"
              autoComplete="address-line1"
              value={form.address1}
              onChange={(e) => set('address1', e.target.value)}
            />
            <TextField
              id="profile-address2"
              name="address-line2"
              label="ที่อยู่ (บรรทัดที่ 2)"
              labelSuffix="(ไม่บังคับ)"
              autoComplete="address-line2"
              value={form.address2}
              onChange={(e) => set('address2', e.target.value)}
            />
            <NativeSelect
              id="profile-country"
              label="ประเทศ"
              labelSuffix="(ไม่บังคับ)"
              options={COUNTRY_OPTIONS}
              value={form.country}
              onChange={(v) => setForm((prev) => ({ ...prev, country: v, state: '' }))}
            />
            {isThailand ? (
              <NativeSelect
                id="profile-state"
                label="จังหวัด"
                labelSuffix="(ไม่บังคับ)"
                options={PROVINCE_OPTIONS}
                value={form.state}
                onChange={(v) => set('state', v)}
              />
            ) : (
              <TextField
                id="profile-state"
                name="address-level1"
                label="รัฐ / แคว้น / จังหวัด"
                labelSuffix="(ไม่บังคับ)"
                autoComplete="address-level1"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
              />
            )}
            <TextField
              id="profile-city"
              name="address-level2"
              label={isThailand ? 'อำเภอ / เขต' : 'เมือง'}
              labelSuffix="(ไม่บังคับ)"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <TextField
              id="profile-zip"
              name="postal-code"
              inputMode="numeric"
              label="รหัสไปรษณีย์"
              labelSuffix="(ไม่บังคับ)"
              autoComplete="postal-code"
              value={form.zip}
              error={errors['profile-zip']}
              onChange={(e) => set('zip', e.target.value)}
            />
          </div>
        </Card>
      </PageLayout>

      {emailOpen && (
        <EmailDialog
          current={form.email}
          onClose={() => setEmailOpen(false)}
          onUse={async (email) => {
            if (cloudEnabled) {
              try {
                await changeLoginEmail(email);
                toast.show('ส่งลิงก์ยืนยันไปที่อีเมลใหม่แล้ว');
              } catch (err) {
                toast.show(explainError(err), { tone: 'error' });
                return;
              }
            }
            set('email', email);
            setEmailOpen(false);
          }}
        />
      )}
    </form>
  );
};
