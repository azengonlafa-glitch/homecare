import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { SocialButtons } from '../components/auth/SocialButtons';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { pathAfterLogin } from '../lib/homeSetup';
import { resetDemoState } from '../lib/demo';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // จำลองการเข้าสู่ระบบ บันทึกลง localStorage ตามแนวทาง Prototype
    localStorage.setItem('growa_auth_user', JSON.stringify({ email: email || 'user@example.com' }));
    navigate(pathAfterLogin());
  };

  const handleDemoLogin = () => {
    // เข้าสู่ระบบแบบ Demo: เริ่มใหม่ทุกครั้ง แล้วพาไปหน้าเข้าร่วม/สร้างบ้านก่อน จากนั้นกรอกข้อมูลพื้นฐาน
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
        <button
          type="button"
          onClick={handleDemoLogin}
          title="กดเพื่อเข้าใช้งานแบบ Demo ทันทีสำหรับทดสอบ"
          className="min-h-[42px] text-sm sm:text-base font-bold bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-900 px-4 py-1.5 rounded-full border border-purple-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
        >
          <span>⚡</span>
          <span>Demo</span>
        </button>
      }
      title="Sign in to your account"
      subtitle="เข้าสู่ระบบเพื่อดูแลยาของครอบครัว"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <TextField
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          label="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your e-mail"
          required
        />

        <TextField
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          required
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        <div className="flex items-center justify-between gap-4 text-base sm:text-lg pt-1">
          <label className="flex items-center gap-3 cursor-pointer select-none min-h-[48px]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-slate-700 font-medium">Remember me</span>
          </label>
          <a
            href="#forgot-password"
            onClick={(e) => {
              e.preventDefault();
              alert('ระบบต้นแบบ: ติดต่อผู้ดูแลครอบครัวเพื่อรีเซ็ตรหัสผ่าน');
            }}
            className="text-purple-700 hover:text-purple-800 font-bold transition-colors"
          >
            Forgot password?
          </a>
        </div>

        <Button type="submit" fullWidth size="md">
          Sign in
        </Button>
      </form>

      <SocialButtons labelPrefix="Sign in with" onClick={handleSubmit} />

      <p className="text-center text-base sm:text-lg text-slate-700 mt-8">
        Don’t have an account?{' '}
        <Link to="/signup" className="text-purple-700 font-bold hover:text-purple-800 underline underline-offset-4 transition-colors">
          Sign up for free
        </Link>
      </p>
    </AuthShell>
  );
};
