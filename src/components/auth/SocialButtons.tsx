import React from 'react';

interface SocialButtonsProps {
  /** คำนำหน้า aria-label เช่น "Sign in with" / "Sign up with" */
  labelPrefix: string;
  onSelect: (provider: 'google' | 'apple') => void;
  /** ผู้ให้บริการที่เปิดใช้ (ค่าเริ่มต้น: ทั้งสอง) */
  providers?: ('google' | 'apple')[];
}

const socialButtonClass =
  'w-18 h-14 sm:w-20 sm:h-15 px-4 flex items-center justify-center bg-white border border-slate-300 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer shadow-xs hover:border-slate-400';

/** ตัวคั่น "or do it via other accounts" และปุ่ม Google / Apple ขนาดใหญ่ขึ้น */
export const SocialButtons: React.FC<SocialButtonsProps> = ({ labelPrefix, onSelect, providers = ['google', 'apple'] }) => (
  <>
    <div className="relative my-7 sm:my-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-white px-4 text-slate-500 uppercase tracking-wider font-semibold text-xs sm:text-sm">
          or do it via other accounts
        </span>
      </div>
    </div>

    <div className="flex items-center justify-center gap-5">
      {providers.includes('google') && (
      <button type="button" onClick={() => onSelect('google')} className={socialButtonClass} aria-label={`${labelPrefix} Google`}>
        <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.27 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.58H1.26C.46 8.19 0 10.03 0 12s.46 3.81 1.26 5.42l4.02-3.13z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.64 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
          />
        </svg>
      </button>
      )}

      {providers.includes('apple') && (
      <button type="button" onClick={() => onSelect('apple')} className={socialButtonClass} aria-label={`${labelPrefix} Apple`}>
        <svg className="w-6 h-6 fill-slate-900" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.64-.78 1.08-1.87.96-2.96-.93.04-2.05.62-2.71 1.4-.58.67-1.09 1.77-.95 2.83 1.03.08 2.06-.5 2.7-1.27z" />
        </svg>
      </button>
      )}
    </div>
  </>
);
