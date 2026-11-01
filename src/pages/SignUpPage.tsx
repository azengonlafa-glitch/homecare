import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { SocialButtons } from '../components/auth/SocialButtons';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      alert('กรุณากดยอมรับข้อกำหนดการใช้งานเพื่อดำเนินการต่อ');
      return;
    }
    // บันทึกสถานะผู้ใช้จำลองลงใน localStorage
    localStorage.setItem(
      'growa_auth_user',
      JSON.stringify({ name: fullName || 'ผู้ใช้ใหม่', email: email || 'user@example.com' })
    );
    navigate('/');
  };

  return (
    <AuthShell
      onBack={() => navigate('/login')}
      backLabel="ย้อนกลับไปหน้าเข้าสู่ระบบ"
      title="Create your account"
      subtitle="เริ่มต้นดูแลสุขภาพและยาของคนในครอบครัว"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="fullname"
          name="name"
          type="text"
          autoComplete="name"
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Enter your name"
          required
        />

        <TextField
          id="signup-email"
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
          id="signup-password"
          name="new-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          required
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        <label className="flex items-start gap-2.5 cursor-pointer select-none text-sm">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-slate-600 leading-snug">
            I agree to the <span className="text-purple-700 font-medium">Terms of Service</span> &{' '}
            <span className="text-purple-700 font-medium">Privacy Policy</span>
          </span>
        </label>

        <Button type="submit" fullWidth>
          Sign up for free
        </Button>
      </form>

      <SocialButtons labelPrefix="Sign up with" onClick={handleSubmit} />

      <p className="text-center text-sm text-slate-600 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-purple-700 font-semibold hover:text-purple-800 transition-colors">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
};
