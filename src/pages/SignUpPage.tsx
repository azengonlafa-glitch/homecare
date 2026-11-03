import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { SocialButtons } from '../components/auth/SocialButtons';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { pathAfterLogin } from '../lib/homeSetup';
import { cloudEnabled } from '../cloud/client';
import { explainError, signInWithProvider, signUpWithEmail } from '../cloud/engine';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
        setConfirmSent(true);
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
    try {
      await signInWithProvider(provider);
    } catch (err) {
      setError(explainError(err));
    }
  };

  if (confirmSent) {
    return (
      <AuthShell
        onBack={() => navigate('/login')}
        backLabel="ย้อนกลับไปหน้าเข้าสู่ระบบ"
        title="ตรวจอีเมลของคุณ"
        subtitle={`เราส่งลิงก์ยืนยันไปที่ ${email} แล้ว กดลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี`}
      >
        <Link to="/login" className="block text-center text-purple-700 font-bold underline underline-offset-4">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      onBack={() => navigate('/login')}
      backLabel="ย้อนกลับไปหน้าเข้าสู่ระบบ"
      title="สร้างบัญชี"
      subtitle="เริ่มต้นดูแลสุขภาพและยาของคนในครอบครัว"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          id="fullname"
          name="name"
          type="text"
          autoComplete="name"
          label="ชื่อ"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="ชื่อที่ให้คนในบ้านเห็น"
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
          required
        />

        <TextField
          id="signup-password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          label="รหัสผ่าน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="อย่างน้อย 6 ตัวอักษร"
          required
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        <div className="pt-1">
          <label className="flex items-start gap-3 cursor-pointer select-none text-base sm:text-lg min-h-[48px]">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer shrink-0"
            />
            <span className="text-slate-700 leading-snug">
              ฉันยอมรับ <span className="text-purple-700 font-bold">ข้อกำหนดการใช้งาน</span> และ{' '}
              <span className="text-purple-700 font-bold">นโยบายความเป็นส่วนตัว</span>
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="text-base font-semibold text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="md" disabled={busy}>
          {busy ? 'กำลังสร้างบัญชี…' : 'สมัครสมาชิกฟรี'}
        </Button>
      </form>

      <SocialButtons
        labelPrefix="สมัครด้วย"
        onSelect={handleProvider}
        providers={cloudEnabled ? ['google'] : ['google', 'apple']}
      />

      <p className="text-center text-base sm:text-lg text-slate-700 mt-8">
        มีบัญชีอยู่แล้ว?{' '}
        <Link to="/login" className="text-purple-700 font-bold hover:text-purple-800 underline underline-offset-4 transition-colors">
          เข้าสู่ระบบ
        </Link>
      </p>
    </AuthShell>
  );
};
