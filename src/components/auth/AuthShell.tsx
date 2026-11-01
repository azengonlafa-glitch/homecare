import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

interface AuthShellProps {
  onBack: () => void;
  backLabel: string;
  /** องค์ประกอบเพิ่มเติมข้างป้ายชื่อแอป เช่น ปุ่ม Demo */
  headerExtra?: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** กรอบการ์ดกลางจอสำหรับหน้าเข้าสู่ระบบและสมัครสมาชิก พร้อมแท็บสลับด้านบน */
export const AuthShell: React.FC<AuthShellProps> = ({
  onBack,
  backLabel,
  headerExtra,
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-dvh w-full bg-[#FAF5FF]/40 sm:bg-slate-100/70 flex items-center justify-center p-4 sm:p-8 md:p-12">
    <div className="w-full max-w-xl md:max-w-[580px] bg-white rounded-3xl p-6 sm:p-10 md:p-12 shadow-xl shadow-purple-900/5 sm:border sm:border-slate-200/80 transition-all">
      {/* แถวบนสุด: ปุ่มย้อนกลับ, ปุ่ม Demo และชื่อแอป */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center w-12 h-12 -ml-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label={backLabel}
        >
          <ArrowLeft className="w-7 h-7" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3">
          {headerExtra}
          <span className="max-[359px]:hidden text-base font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-4 py-1.5 rounded-full">
            Growa Homecare
          </span>
        </div>
      </div>

      {/* แถบเลือกด้านบนระหว่าง Log in และ Sign up ตามคำขอ */}
      <div className="p-1.5 bg-slate-100 rounded-2xl mb-8 border border-slate-200/80">
        <div className="grid grid-cols-2 gap-1.5">
          <NavLink
            to="/login"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center min-h-[48px] px-4 rounded-xl text-base sm:text-lg font-bold transition-all cursor-pointer',
                isActive
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              )
            }
          >
            Log in (เข้าสู่ระบบ)
          </NavLink>

          <NavLink
            to="/signup"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center min-h-[48px] px-4 rounded-xl text-base sm:text-lg font-bold transition-all cursor-pointer',
                isActive
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              )
            }
          >
            Sign up (สมัครสมาชิก)
          </NavLink>
        </div>
      </div>

      {/* หัวข้อหน้าจอ */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
          {title}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-2 font-medium">
          {subtitle}
        </p>
      </div>

      {children}
    </div>
  </div>
);
