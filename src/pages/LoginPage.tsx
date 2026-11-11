import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell, type AuthTab } from '../components/auth/AuthShell';
import { SocialButtons } from '../components/auth/SocialButtons';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { TextField } from '../components/ui/TextField';
import { pathAfterLogin } from '../lib/homeSetup';
import { cloudEnabled } from '../cloud/client';
import { readAuthUser } from '../cloud/identity';
import {
  explainError,
  sendPasswordReset,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
} from '../cloud/engine';

interface LoginPageProps {
  defaultTab?: AuthTab;
}

export const LoginPage: React.FC<LoginPageProps> = ({ defaultTab }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // กำหนดแท็บเริ่มต้น (ค่าเริ่มต้นคือ 'login')
  const tabParam = params.get('tab') as AuthTab | null;
  const [tab, setTab] = useState<AuthTab>(
    defaultTab || (tabParam === 'signup' ? 'signup' : 'login')
  );

  const handleTabChange = (newTab: AuthTab) => {
    setTab(newTab);
    setError('');
    setNotice('');
  };

  const next = params.get('next');
  const nextPath =
    next && /^\/(pharmacist|admin(\/providers\/(new|[A-Za-z0-9-]+(\/edit)?))?)$/.test(next)
      ? next
      : null;

  // ฟอร์มเข้าสู่ระบบ
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ฟอร์มสมัครสมาชิก
  const [fullName, setFullName] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ถ้าเข้าสู่ระบบอยู่แล้ว: ไปต่อได้เลย
  useEffect(() => {
    if (cloudEnabled && readAuthUser()?.id) {
      navigate(nextPath ?? pathAfterLogin(), { replace: true });
    }
  }, [navigate, nextPath]);

  // จัดการล็อกอินด้วยอีเมล
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEnabled) {
      localStorage.setItem(
        'growa_auth_user',
        JSON.stringify({ email: email || 'user@example.com' })
      );
      navigate(pathAfterLogin());
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      window.location.assign(nextPath ?? '/');
    } catch (err) {
      setError(explainError(err));
      setBusy(false);
    }
  };

  // จัดการสมัครสมาชิกด้วยอีเมล
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!agreeTerms) {
      setError('กรุณายอมรับข้อกำหนดการใช้งานเพื่อดำเนินการต่อ');
      return;
    }
    if (!cloudEnabled) {
      localStorage.setItem(
        'growa_auth_user',
        JSON.stringify({ name: fullName || 'ผู้ใช้ใหม่', email: email || 'user@example.com' })
      );
      navigate(pathAfterLogin());
      return;
    }
    if (password.length < 6) {
      setError('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    setBusy(true);
    try {
      const { needsConfirm } = await signUpWithEmail(email, password, fullName);
      if (needsConfirm) {
        setNotice('ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องข้อความ');
        setBusy(false);
        return;
      }
      window.location.assign('/');
    } catch (err) {
      setError(explainError(err));
      setBusy(false);
    }
  };

  const handleProvider = async (provider: 'google' | 'apple') => {
    if (!cloudEnabled) {
      navigate(pathAfterLogin());
      return;
    }
    setError('');
    try {
      await signInWithProvider(provider);
    } catch (err) {
      setError(explainError(err));
    }
  };

  const handleForgot = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!cloudEnabled) return;
    if (!email.trim()) {
      setError('กรอกอีเมลก่อน แล้วกด “ลืมรหัสผ่าน” อีกครั้ง');
      return;
    }
    setError('');
    try {
      await sendPasswordReset(email);
      setNotice('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว');
    } catch (err) {
      setError(explainError(err));
    }
  };

  return (
    <AuthShell
      currentTab={tab}
      onTabChange={handleTabChange}
      onBack={() => navigate('/')}
    >
      {tab === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-4 sm:space-y-4.5">
          <TextField
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            label="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="กรอกอีเมลของคุณ"
            className="bg-white border-2 border-[#E7D8C9] rounded-2xl focus:border-[#16A34A] focus:ring-[#16A34A] min-h-[50px] sm:min-h-[52px] text-slate-900 shadow-2xs"
            required
          />

          <TextField
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            label="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่าน"
            className="bg-white border-2 border-[#E7D8C9] rounded-2xl focus:border-[#16A34A] focus:ring-[#16A34A] min-h-[50px] sm:min-h-[52px] text-slate-900 shadow-2xs"
            required
            trailing={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
            }
          />

          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={handleForgot}
              className="text-xs sm:text-sm font-bold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              ลืมรหัสผ่าน?
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs sm:text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-xs sm:text-sm font-bold text-emerald-600">
              {notice}
            </p>
          )}

          {/* ปุ่มเข้าสู่ระบบสีเขียวสดใส มีมิติแบบ 3D ตามรูปต้นแบบเป๊ะๆ */}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[52px] sm:min-h-[56px] rounded-2xl bg-[#16A34A] hover:bg-[#15803D] active:translate-y-0.5 border-b-4 border-[#14532D] active:border-b-2 text-white text-base sm:text-lg lg:text-xl font-black shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
          </button>

          <SocialButtons
            labelPrefix="เข้าสู่ระบบด้วย"
            onSelect={handleProvider}
            providers={cloudEnabled ? ['google'] : ['google', 'apple']}
          />

          <p className="text-center text-xs sm:text-sm lg:text-base text-slate-600 pt-1">
            ยังไม่มีบัญชี?{' '}
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className="font-black text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
            >
              สมัครสมาชิกฟรี
            </button>
          </p>
        </form>
      )}

      {tab === 'signup' && (
        <form onSubmit={handleSignUpSubmit} className="space-y-4 sm:space-y-4.5">
          <TextField
            id="fullName"
            name="fullName"
            type="text"
            label="ชื่อ-นามสกุล"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="กรอกชื่อ-นามสกุลของคุณ"
            className="bg-white border-2 border-[#E7D8C9] rounded-2xl focus:border-[#16A34A] focus:ring-[#16A34A] min-h-[50px] sm:min-h-[52px] text-slate-900 shadow-2xs"
            required
          />

          <TextField
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            label="อีเมล"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="กรอกอีเมลของคุณ"
            className="bg-white border-2 border-[#E7D8C9] rounded-2xl focus:border-[#16A34A] focus:ring-[#16A34A] min-h-[50px] sm:min-h-[52px] text-slate-900 shadow-2xs"
            required
          />

          <TextField
            id="signup-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            label="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ตั้งรหัสผ่าน"
            className="bg-white border-2 border-[#E7D8C9] rounded-2xl focus:border-[#16A34A] focus:ring-[#16A34A] min-h-[50px] sm:min-h-[52px] text-slate-900 shadow-2xs"
            required
            trailing={
              <PasswordToggle
                visible={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
            }
          />

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              ยอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว
            </span>
          </label>

          {error && (
            <p role="alert" className="text-xs sm:text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-xs sm:text-sm font-bold text-emerald-600">
              {notice}
            </p>
          )}

          {/* ปุ่มสมัครสมาชิกสีเขียวสดใส มีมิติแบบ 3D */}
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[52px] sm:min-h-[56px] rounded-2xl bg-[#16A34A] hover:bg-[#15803D] active:translate-y-0.5 border-b-4 border-[#14532D] active:border-b-2 text-white text-base sm:text-lg lg:text-xl font-black shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {busy ? 'กำลังสร้างบัญชี…' : 'สมัครสมาชิก'}
          </button>

          <SocialButtons
            labelPrefix="สมัครสมาชิกด้วย"
            onSelect={handleProvider}
            providers={cloudEnabled ? ['google'] : ['google', 'apple']}
          />

          <p className="text-center text-xs sm:text-sm lg:text-base text-slate-600 pt-1">
            มีบัญชีอยู่แล้ว?{' '}
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className="font-black text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
            >
              เข้าสู่ระบบ
            </button>
          </p>
        </form>
      )}
    </AuthShell>
  );
};
