import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, KeyRound, Mail, Share2, UserPlus } from 'lucide-react';
import { BrandMark } from '../components/layout/BrandMark';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { SelectField, type SelectOption } from '../components/ui/SelectField';
import { MultiSelectField } from '../components/ui/MultiSelectField';
import { loadHomeData, saveHomeData } from '../lib/storage';
import { saveHomeSetup } from '../lib/homeSetup';

const TIME_ZONES: SelectOption[] = [
  { value: 'Asia/Bangkok', label: 'ประเทศไทย (UTC+7)' },
  { value: 'Asia/Singapore', label: 'สิงคโปร์ / มาเลเซีย (UTC+8)' },
  { value: 'Asia/Tokyo', label: 'ญี่ปุ่น / เกาหลี (UTC+9)' },
  { value: 'Australia/Sydney', label: 'ออสเตรเลีย ซิดนีย์ (UTC+10/+11)' },
  { value: 'Europe/London', label: 'สหราชอาณาจักร (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'ยุโรปกลาง (UTC+1/+2)' },
  { value: 'America/New_York', label: 'สหรัฐฯ ฝั่งตะวันออก (UTC-5/-4)' },
  { value: 'America/Los_Angeles', label: 'สหรัฐฯ ฝั่งตะวันตก (UTC-8/-7)' },
];

const HEALTH_CONDITIONS: SelectOption[] = [
  { value: 'hypertension', label: 'ความดันโลหิตสูง' },
  { value: 'diabetes', label: 'เบาหวาน' },
  { value: 'cholesterol', label: 'ไขมันในเลือดสูง' },
  { value: 'heart', label: 'โรคหัวใจ' },
  { value: 'kidney', label: 'โรคไต' },
  { value: 'arthritis', label: 'ข้อเข่าเสื่อม / ข้ออักเสบ' },
  { value: 'dementia', label: 'ความจำเสื่อม / อัลไซเมอร์' },
  { value: 'other', label: 'อื่น ๆ' },
];

const HEARD_FROM: SelectOption[] = [
  { value: 'friend', label: 'เพื่อนหรือคนในครอบครัวแนะนำ' },
  { value: 'social', label: 'โซเชียลมีเดีย' },
  { value: 'hospital', label: 'โรงพยาบาลหรือคลินิก' },
  { value: 'search', label: 'ค้นหาจาก Google' },
  { value: 'other', label: 'อื่น ๆ' },
];

const INVITE_STEPS = [
  { icon: Share2, text: 'ให้เจ้าของบ้านเปิดเมนู "ชวนคนในครอบครัว"' },
  { icon: Mail, text: 'ขอรหัสเชิญ 8 หลักส่งมาทาง LINE หรือข้อความ' },
  { icon: KeyRound, text: 'กรอกรหัสในช่องด้านบนแล้วกด "เข้าร่วมบ้าน"' },
];

/** จัดรูปแบบรหัสเชิญเป็น "0000 0000" และรับเฉพาะตัวเลข */
const formatInviteCode = (raw: string) =>
  raw
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{4})(?=\d)/, '$1 ');

const readUserName = (): string | null => {
  try {
    const saved = localStorage.getItem('growa_auth_user');
    return saved ? (JSON.parse(saved).name as string | undefined) ?? null : null;
  } catch {
    return null;
  }
};

const focusField = (id: string) => document.getElementById(id)?.focus();

/** หน้าหลังเข้าสู่ระบบ: เข้าร่วมบ้านด้วยรหัสเชิญ หรือสร้างบ้านใหม่ */
export const HomeSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const userName = readUserName();

  // ฟอร์มเข้าร่วมบ้าน
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // ฟอร์มสร้างบ้าน
  const [homeName, setHomeName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Bangkok');
  const [conditions, setConditions] = useState<string[]>([]);
  const [heardFrom, setHeardFrom] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (id: string) => {
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = inviteCode.replace(/\D/g, '');
    if (digits.length !== 8) {
      setJoinError('กรุณากรอกรหัสเชิญให้ครบ 8 หลัก');
      focusField('invite-code');
      return;
    }
    // ต้นแบบ: ยังไม่มีเซิร์ฟเวอร์ตรวจรหัส จึงบันทึกรหัสไว้ในเครื่องแล้วไปต่อ
    saveHomeSetup({ mode: 'join', inviteCode: digits });
    navigate('/');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!homeName.trim()) next['home-name'] = 'กรุณากรอกชื่อบ้าน';
    if (!firstName.trim()) next['recipient-first'] = 'กรุณากรอกชื่อผู้ที่เราจะดูแล';
    if (!heardFrom) next['heard-from'] = 'กรุณาเลือกหนึ่งตัวเลือก';
    setErrors(next);

    const firstInvalid = ['home-name', 'recipient-first', 'heard-from'].find((id) => next[id]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    saveHomeSetup({
      mode: 'create',
      homeName: homeName.trim(),
      recipientFirstName: firstName.trim(),
      recipientLastName: lastName.trim(),
      timeZone,
      healthConditions: conditions,
      heardFrom,
    });
    // ใช้ชื่อบ้านที่ตั้งใหม่แทนชื่อตัวอย่างบนหน้าหลัก
    saveHomeData({ ...loadHomeData(), homeName: homeName.trim() });
    navigate('/');
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="h-16 border-b border-slate-200 bg-white">
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <BrandMark />
          <Link
            to="/"
            className="inline-flex items-center min-h-[44px] px-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ข้ามไปก่อน
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {userName ? `ยินดีต้อนรับ คุณ${userName}` : 'ยินดีต้อนรับสู่ Growa Homecare'}
          </h1>
          <p className="text-slate-600 text-base mt-1">
            เลือกเข้าร่วมบ้านที่มีคนสร้างไว้แล้ว หรือสร้างบ้านใหม่ของครอบครัวคุณ
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 items-stretch">
          {/* กล่องซ้าย: เข้าร่วมบ้านด้วยรหัสเชิญ */}
          <Card className="flex flex-col p-6 sm:p-8 min-w-0">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <KeyRound className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900">มีรหัสเชิญหรือไม่?</h2>
                <p className="text-sm text-slate-600 mt-1">
                  เข้าร่วมบ้านที่มีอยู่แล้วได้ฟรี ถ้าคุณมีรหัสเชิญ 8 หลักจากเจ้าของบ้าน กรอกที่นี่ได้เลย
                </p>
              </div>
            </div>

            <form onSubmit={handleJoin} noValidate className="space-y-5">
              <TextField
                id="invite-code"
                name="invite-code"
                label="รหัสเชิญ 8 หลัก"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder="0000 0000"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(formatInviteCode(e.target.value));
                  if (joinError) setJoinError('');
                }}
                error={joinError}
                className="text-lg tracking-[0.2em] font-semibold"
              />
              <Button type="submit" fullWidth>
                เข้าร่วมบ้าน
              </Button>
            </form>

            {/* วิธีขอรหัสเชิญ: เติมพื้นที่ให้กล่องสมดุลกับกล่องสร้างบ้านที่ยาวกว่า */}
            <div className="mt-6 flex-1 rounded-2xl bg-purple-50/70 p-5 sm:p-6 flex flex-col justify-center">
              <p className="text-base font-bold text-purple-800 mb-4">ขอรหัสเชิญได้อย่างไร</p>
              <ol className="space-y-5">
                {INVITE_STEPS.map(({ icon: Icon, text }, index) => (
                  <li key={text} className="flex items-start gap-4">
                    <span className="w-9 h-9 shrink-0 rounded-full bg-white text-purple-700 border border-purple-200 flex items-center justify-center text-base font-bold">
                      {index + 1}
                    </span>
                    <span className="flex items-start gap-2.5 text-base text-slate-700 pt-1">
                      <Icon className="w-5 h-5 mt-0.5 shrink-0 text-purple-600" aria-hidden="true" />
                      <span>{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          {/* กล่องขวา: สร้างบ้านใหม่ */}
          <Card className="flex flex-col p-6 sm:p-8 min-w-0">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-700 text-white flex items-center justify-center">
                <Home className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900">สร้างบ้านของครอบครัว</h2>
                <p className="text-sm text-slate-600 mt-1">
                  หรือเริ่มสร้างบ้านใหม่ฟรี เพื่อชวนญาติมาช่วยกันดูแลและจัดการยาของทุกคนในบ้าน
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} noValidate className="space-y-5">
              <TextField
                id="home-name"
                name="home-name"
                label="ชื่อบ้าน"
                autoComplete="off"
                placeholder="เช่น บ้านคุณย่าสมศรี"
                value={homeName}
                onChange={(e) => {
                  setHomeName(e.target.value);
                  clearError('home-name');
                }}
                error={errors['home-name']}
              />

              <h3 className="text-lg font-bold text-slate-900 pt-1 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-700" aria-hidden="true" />
                บ้านนี้ดูแลใคร?
              </h3>

              <div className="grid grid-cols-1 sm:max-md:grid-cols-2 lg:grid-cols-2 gap-5">
                <TextField
                  id="recipient-first"
                  name="recipient-first"
                  label="ชื่อ"
                  autoComplete="off"
                  placeholder="ชื่อผู้ที่เราดูแล"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    clearError('recipient-first');
                  }}
                  error={errors['recipient-first']}
                />
                <TextField
                  id="recipient-last"
                  name="recipient-last"
                  label="นามสกุล"
                  autoComplete="off"
                  placeholder="นามสกุลผู้ที่เราดูแล"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <SelectField
                id="time-zone"
                name="time-zone"
                label="เขตเวลาของผู้ที่เราดูแล"
                placeholder="ผู้ที่เราดูแลอยู่ในเขตเวลาไหน?"
                options={TIME_ZONES}
                value={timeZone}
                onChange={setTimeZone}
              />

              <MultiSelectField
                id="health-conditions"
                label="โรคประจำตัว"
                labelSuffix="(ไม่บังคับ)"
                hint="บอกโรคประจำตัวของคนที่คุณรัก เพื่อให้เราแนะนำเรื่องการดูแลและการกินยาได้ตรงกับครอบครัวคุณมากขึ้น"
                placeholder="เลือกโรคประจำตัว"
                options={HEALTH_CONDITIONS}
                value={conditions}
                onChange={setConditions}
              />

              <SelectField
                id="heard-from"
                name="heard-from"
                label="คุณรู้จัก Growa Homecare จากที่ไหน?"
                labelSuffix="(จำเป็น)"
                placeholder="เลือกหนึ่งตัวเลือก"
                options={HEARD_FROM}
                value={heardFrom}
                onChange={(v) => {
                  setHeardFrom(v);
                  clearError('heard-from');
                }}
                error={errors['heard-from']}
              />

              <Button type="submit" fullWidth className="mt-2">
                สร้างบ้าน
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};
