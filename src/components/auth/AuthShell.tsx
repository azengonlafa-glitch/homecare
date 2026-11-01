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

/** กรอบการ์ดกลางจอสำหรับหน้าเข้าสู่ระบบและสมัครสมาชิก ขนาดใหญ่เต็มตา อ่านง่าย สบายตา */
export const AuthShell: React.FC<AuthShellProps> = ({
  onBack,
  backLabel,
  headerExtra,
  title,
  subtitle,
  children,
}) => (
  <div className="min-h-dvh w-full bg-[#FAF5FF]/40 sm:bg-slate-100/70 flex items-center justify-center p-4 sm:p-8 md:p-12">
    <div className="w-full max-w-xl md:max-w-[580px] bg-white rounded-3xl p-8 sm:p-12 shadow-xl shadow-purple-900/5 sm:border sm:border-slate-200/80 transition-all">
      <div className="flex items-center justify-between gap-3 mb-8">
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
          <span className="text-base font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-4 py-1.5 rounded-full">
            Growa Homecare
          </span>
        </div>
      </div>

      <div className="text-center mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
          {title}
        </h1>
        <p className="text-base sm:text-lg text-slate-600 mt-2">
          {subtitle}
        </p>
      </div>

      {children}
    </div>
  </div>
);
