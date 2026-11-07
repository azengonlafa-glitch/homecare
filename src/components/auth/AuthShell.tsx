import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/cn';
import { MascotFamily } from '../ui/Mascot';

interface AuthShellProps {
  onBack: () => void;
  backLabel: string;
  /** องค์ประกอบเพิ่มเติมข้างป้ายชื่อแอป เช่น ปุ่มลัด */
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
  <div className="relative isolate min-h-dvh w-full overflow-hidden bg-peach lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <span aria-hidden="true" className="blob-morph absolute -right-24 -top-24 -z-10 h-80 w-80 bg-purple-700" />
    <span aria-hidden="true" className="blob-morph absolute -bottom-32 -left-24 -z-10 h-96 w-96 bg-purple-200" style={{ animationDelay: '-7s' }} />

    {/* ภาพเปิด: จอกว้างอยู่ซ้าย มือถืออยู่เหนือการ์ด */}
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center px-6 pb-2 pt-6 text-center text-slate-900 lg:max-w-none lg:px-14">
      <MascotFamily className="max-w-[17rem] sm:max-w-sm lg:max-w-xl" />
      <p className="hero-in mt-4 hidden font-display text-3xl font-medium leading-snug lg:block">ดูแลยาของคนในบ้าน<br />ไปด้วยกันทุกวัน</p>
    </div>

    <div className="flex items-center justify-center p-4 sm:p-8">
    <div className="anim-spring w-full max-w-xl md:max-w-[580px] bg-white rounded-[2.5rem] p-6 sm:p-10 md:p-12 shadow-2xl shadow-purple-900/20">
      {/* แถวบนสุด: ปุ่มย้อนกลับและชื่อแอป */}
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
          <span className="max-[419px]:hidden whitespace-nowrap font-display text-base text-purple-800 bg-purple-100 px-4 py-1.5 rounded-full">
            Growa Homecare
          </span>
        </div>
      </div>

      {/* แถบเลือกด้านบนระหว่าง Log in และ Sign up ตามคำขอ */}
      <div className="p-1.5 bg-purple-100 rounded-[1.5rem] mb-8">
        <div className="grid grid-cols-2 gap-1.5">
          <NavLink
            to="/login"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center min-h-[48px] px-4 rounded-xl text-base sm:text-lg font-bold transition cursor-pointer',
                isActive
                  ? 'bg-white text-purple-800 shadow-sm'
                  : 'text-purple-900 hover:bg-white/50'
              )
            }
          >
            เข้าสู่ระบบ
          </NavLink>

          <NavLink
            to="/signup"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center min-h-[48px] px-4 rounded-xl text-base sm:text-lg font-bold transition cursor-pointer',
                isActive
                  ? 'bg-white text-purple-800 shadow-sm'
                  : 'text-purple-900 hover:bg-white/50'
              )
            }
          >
            สมัครสมาชิก
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
  </div>
);
