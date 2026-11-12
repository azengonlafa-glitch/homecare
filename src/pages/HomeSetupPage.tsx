import React, { useState } from 'react';
import { CanvasDecor } from '../components/ui/Decor';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, KeyRound, UserPlus } from 'lucide-react';
import { BrandMark } from '../components/layout/BrandMark';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { HomeCreatedPanel } from '../components/home/HomeCreatedPanel';
import { loadHomeData, saveHomeData } from '../lib/storage';
import { saveHomeSetup } from '../lib/homeSetup';
import { loadSettings, saveSettings } from '../lib/settings';
import { cloudEnabled } from '../cloud/client';
import { createHome, explainError, joinHome, signOutAll } from '../cloud/engine';

const DEFAULT_TIMEZONE = 'Asia/Bangkok';

/** จัดรูปแบบรหัสเชิญเป็น "0000 0000" และรับเฉพาะตัวเลข */
const formatInviteCode = (raw: string) =>
  raw
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{4})(?=\d)/, '$1 ');

const readUserName = (): string | null => {
  try {
    const saved = localStorage.getItem('growa_auth_user');
    return saved ? ((JSON.parse(saved).name as string | undefined) ?? null) : null;
  } catch {
    return null;
  }
};

/** สร้างรหัสเชิญ 8 หลักแบบสุ่ม  */
const generateInviteCode = () => {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return String((values[0] % 9000) + 1000) + String((values[1] % 9000) + 1000);
};

const focusField = (id: string) => document.getElementById(id)?.focus();

/** หน้าหลังเข้าสู่ระบบ: เข้าร่วมบ้านด้วยรหัสเชิญ หรือสร้างบ้านใหม่ (สองกล่องเรียงแนวตั้ง) */
export const HomeSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const userName = readUserName();

  // ฟอร์มเข้าร่วมบ้าน
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  // ฟอร์มสร้างบ้าน
  const [homeName, setHomeName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // มีค่าเมื่อสร้างบ้านสำเร็จ: ใช้สลับไปแสดงรหัสเชิญและช่องทางแชร์
  const [created, setCreated] = useState<{ homeName: string; code: string } | null>(null);

  const clearError = (id: string) => {
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = inviteCode.replace(/\D/g, '');
    if (digits.length !== 8) {
      setJoinError('กรุณากรอกรหัสเชิญให้ครบ 8 หลัก');
      focusField('invite-code');
      return;
    }
    if (cloudEnabled) {
      setBusy(true);
      try {
        await joinHome(digits, '');
        navigate('/onboarding');
      } catch (err) {
        setJoinError(explainError(err));
        focusField('invite-code');
      } finally {
        setBusy(false);
      }
      return;
    }
    saveHomeSetup({ mode: 'join', inviteCode: digits });
    navigate('/onboarding');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!homeName.trim()) next['home-name'] = 'กรุณากรอกชื่อบ้าน';
    if (!firstName.trim()) next['recipient-first'] = 'กรุณากรอกชื่อผู้ที่เราจะดูแล';
    setErrors(next);

    const firstInvalid = ['home-name', 'recipient-first'].find((id) => next[id]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    if (cloudEnabled) {
      setBusy(true);
      setCreateError('');
      try {
        await createHome(homeName.trim(), '');
        const settings = loadSettings();
        saveSettings({
          ...settings,
          home: {
            ...settings.home,
            timeZone: DEFAULT_TIMEZONE,
            recipient: { firstName: firstName.trim(), lastName: lastName.trim() },
          },
        });
        setCreated({ homeName: homeName.trim(), code: loadSettings().inviteCode });
        window.scrollTo({ top: 0 });
      } catch (err) {
        setCreateError(explainError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    const code = generateInviteCode();
    saveHomeSetup({
      mode: 'create',
      inviteCode: code,
      homeName: homeName.trim(),
      recipientFirstName: firstName.trim(),
      recipientLastName: lastName.trim(),
      timeZone: DEFAULT_TIMEZONE,
    });
    // ใช้ชื่อบ้านที่ตั้งใหม่แทนชื่อตัวอย่างบนหน้าหลัก
    saveHomeData({ ...loadHomeData(), homeName: homeName.trim() });
    setCreated({ homeName: homeName.trim(), code });
    window.scrollTo({ top: 0 });
  };

  /** ออกจากระบบแล้วกลับหน้าเข้าสู่ระบบ เพื่อใช้อีเมลอื่น */
  const handleBackToLogin = () => {
    if (cloudEnabled) {
      void signOutAll();
      return;
    }
    localStorage.removeItem('growa_auth_user');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative isolate min-h-dvh text-slate-900">
      <CanvasDecor />
      <header className="h-16 border-b border-slate-200 bg-white">
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <BrandMark />
          <div className="flex items-center gap-1">
            {!cloudEnabled && (
              <Link
                to="/"
                className="inline-flex items-center shrink-0 whitespace-nowrap min-h-[44px] px-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                ข้ามไปก่อน
              </Link>
            )}
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[44px] px-3 rounded-full text-sm font-bold text-purple-800 hover:bg-purple-50 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              เปลี่ยนอีเมล
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        {created ? (
          <HomeCreatedPanel
            homeName={created.homeName}
            code={created.code}
            onContinue={() => navigate('/onboarding')}
          />
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {userName ? `ยินดีต้อนรับ คุณ${userName}` : 'ยินดีต้อนรับสู่ Growa Homecare'}
              </h1>
              <p className="text-slate-600 text-base mt-1">
                เลือกเข้าร่วมบ้านที่มีคนสร้างไว้แล้ว หรือสร้างบ้านใหม่ของครอบครัวคุณ
              </p>
            </div>

            <div className="space-y-6">
              {/* กล่องบน: เข้าร่วมบ้านด้วยรหัสเชิญ */}
              <Card className="p-6 sm:p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 shrink-0 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <KeyRound className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900">มีรหัสเชิญหรือไม่?</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      เข้าร่วมบ้านที่มีอยู่แล้วได้ฟรี ถ้าคุณมีรหัสเชิญ 8 หลักจากผู้ดูแลหลัก กรอกที่นี่ได้เลย
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
                  <Button type="submit" fullWidth disabled={busy}>
                    {busy ? 'กำลังเข้าร่วม…' : 'เข้าร่วมบ้าน'}
                  </Button>
                </form>
              </Card>

              {/* กล่องล่าง: สร้างบ้านใหม่ */}
              <Card className="p-6 sm:p-8">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

                  {createError && (
                    <p role="alert" className="text-base font-semibold text-red-700">
                      {createError}
                    </p>
                  )}
                  <Button type="submit" fullWidth className="mt-2" disabled={busy}>
                    {busy ? 'กำลังสร้างบ้าน…' : 'สร้างบ้าน'}
                  </Button>
                </form>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
