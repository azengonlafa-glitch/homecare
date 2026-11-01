import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface AuthShellProps {
  onBack: () => void;
  backLabel: string;
  /** องค์ประกอบเพิ่มเติมข้างป้ายชื่อแอป เช่น ปุ่ม Demo */
  headerExtra?: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/** กรอบการ์ดกลางจอสำหรับหน้าเข้าสู่ระบบและสมัครสมาชิก */
export const AuthShell: React.FC<AuthShellProps> = ({
  onBack,
  backLabel,
  headerExtra,
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-dvh w-full bg-[#FAF5FF]/30 sm:bg-slate-50/80 flex items-center justify-center p-3 sm:p-6">
    <div className="w-full max-w-[440px] bg-white rounded-2xl p-6 sm:p-8 sm:border sm:border-slate-200">
      <div className="flex items-center justify-between gap-2 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center w-11 h-11 -ml-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label={backLabel}
        >
          <ArrowLeft className="w-6 h-6" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2">
          {headerExtra}
          <span className="text-sm font-medium text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
            Growa Homecare
          </span>
        </div>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>

      {children}
    </div>
  </div>
);
