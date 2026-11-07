import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { SocialButtons } from '../components/auth/SocialButtons';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { pathAfterLogin } from '../lib/homeSetup';
import { resetDemoState } from '../lib/demo';
import { cloudEnabled } from '../cloud/client';
import { readAuthUser } from '../cloud/identity';
import { explainError, sendPasswordReset, signInWithEmail, signInWithProvider } from '../cloud/engine';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // กลับไปหน้าเดิมหลังเข้าสู่ระบบ อนุญาตเฉพาะหน้าที่กำหนด เพื่อกันการส่งต่อไปเว็บอื่น
  const next = params.get('next');
  const nextPath = next && /^\/(pharmacist|admin(\/providers\/(new|[A-Za-z0-9-]+(\/edit)?))?)$/.test(next) ? next : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // เข้าสู่ระบบอยู่แล้ว (เช่น กลับมาจาก Google หรือจากลิงก์ยืนยันอีเมล): ไปต่อได้เลย
  useEffect(() => {
    if (cloudEnabled && readAuthUser()?.id) navigate(nextPath ?? pathAfterLogin(), { replace: true });
  }, [navigate, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEnabled) {
      localStorage.setItem('growa_auth_user', JSON.stringify({ email: email || 'user@example.com' }));
      navigate(pathAfterLogin());
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      // โหลดหน้าใหม่เพื่อดึงข้อมูลของบัญชีนี้ลงเครื่อง
      window.location.assign(nextPath ?? '/');
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

  const handleDemoLogin = () => {
    resetDemoState();
    localStorage.setItem(
      'growa_auth_user',
      JSON.stringify({ email: 'demo@growa-homecare.com', name: 'ผู้ใช้ทดสอบ (Demo)' })
    );
    navigate('/setup');
  };

  return (
    <AuthShell
      onBack={() => navigate('/')}
      backLabel="กลับหน้าหลัก"
      headerExtra={
        cloudEnabled ? undefined : (
          <button
            type="button"
            onClick={handleDemoLogin}
            className="min-h-[42px] text-sm sm:text-base font-bold bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-900 px-4 py-1.5 rounded-full border border-purple-300 transition-colors cursor-pointer"
          >
            Demo
          </button>
        )
      }
      title="เข้าสู่ระบบ"
      subtitle="เข้าสู่ระบบเพื่อดูแลยาของครอบครัว"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          label="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="กรอกอีเมลของคุณ"
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
          required
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        {cloudEnabled && (
          <div className="flex justify-end">
            <a
              href="#forgot-password"
              onClick={handleForgot}
              className="text-purple-700 hover:text-purple-800 font-bold transition-colors"
            >
              ลืมรหัสผ่าน?
            </a>
          </div>
        )}

        {error && (
          <p role="alert" className="text-base font-semibold text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-base font-semibold text-emerald-700">
            {notice}
          </p>
        )}

        <Button type="submit" fullWidth size="md" disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>

      <SocialButtons
        labelPrefix="เข้าสู่ระบบด้วย"
        onSelect={handleProvider}
        providers={cloudEnabled ? ['google'] : ['google', 'apple']}
      />

      <p className="text-center text-base sm:text-lg text-slate-700 mt-8">
        ยังไม่มีบัญชี?{' '}
        <Link to="/signup" className="text-purple-700 font-bold hover:text-purple-800 underline underline-offset-4 transition-colors">
          สมัครสมาชิกฟรี
        </Link>
      </p>
    </AuthShell>
  );
};
