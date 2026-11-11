import React from 'react';
import { cn } from '../../lib/cn';

export type AuthTab = 'login' | 'signup';

interface AuthShellProps {
  currentTab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  onBack?: () => void;
  children?: React.ReactNode;
}

/**
 * กรอบหน้าจอเข้าสู่ระบบ / สมัครสมาชิก
 * สไตล์สมุดโน้ตสีครีม มีเส้นบรรทัดสมุด ขอบเย็บด้ายสีแดง เทปวาชิ และปุ่มสีเขียวสดใส
 * แถบสลับ 2 เมนู: เข้าสู่ระบบ | สมัครสมาชิก (นำบัญชีเดโมออกแล้ว)
 */
export const AuthShell: React.FC<AuthShellProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  return (
    <div className="relative isolate min-h-dvh w-full overflow-x-hidden bg-slate-900 flex items-center justify-center">
      {/* 1. ภาพพื้นหลังตามขนาดหน้าจอ (คอม = ไดโนเสาร์ขี่มอเตอร์ไซค์สดใส, มือถือ = โกรว่าส่งยา) */}
      <div
        aria-hidden="true"
        className={cn(
          'fixed inset-0 -z-10 bg-no-repeat transition-all duration-500',
          // บนมือถือ (< 1024px): ภาพแนวตั้ง โกรว่าส่งยาถึงบ้าน
          'bg-[url("/images/auth/auth-mobile-bg.png")] bg-cover bg-top sm:bg-center',
          // บนคอมพิวเตอร์ (>= 1024px): ภาพแนวนอน ไดโนเสาร์ขี่มอเตอร์ไซค์สดใส
          'lg:bg-[url("/images/auth/auth-desktop-bg.png")] lg:bg-cover lg:bg-center'
        )}
      />

      {/* 2. ฟิลเตอร์ปรับแสงนุ่มนวลเพื่อให้อ่านง่าย สบายตา */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-black/15 lg:bg-gradient-to-r lg:from-transparent lg:via-black/5 lg:to-black/20 pointer-events-none"
      />

      {/* 3. ผังหน้าจอ: จอคอมแบ่งสัดส่วนบาลานซ์ (ซ้ายโชว์ไดโนเสาร์ ขวาแสดงตัว UI การ์ดสมุดโน้ตสีครีม) */}
      <div className="min-h-dvh w-full flex flex-col justify-center lg:grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.05fr_0.95fr]">
        {/* ฝั่งซ้ายบนจอคอม: โล่งโปร่งให้เห็นตัวไดโนเสาร์ขี่มอเตอร์ไซค์อย่างชัดเจน */}
        <div className="hidden lg:flex flex-col justify-between p-8 xl:p-12 min-h-dvh pointer-events-none">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/85 backdrop-blur-md shadow-md border border-white/70 w-fit pointer-events-auto">
            <span className="font-display font-black text-base text-[#16A34A] tracking-wide">
              growa homecare
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div />
        </div>

        {/* ฝั่งขวา (บนจอคอม) / กึ่งกลางจอ (บนมือถือ): ตัว UI สมุดโน้ตสีครีม มีเส้นบรรทัด และขอบเย็บสีแดง */}
        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10 min-h-dvh">
          <div
            className="anim-spring relative w-full max-w-md sm:max-w-lg lg:max-w-[520px] xl:max-w-[560px] rounded-[2.25rem] sm:rounded-[2.75rem] p-6 sm:p-8 lg:p-9 xl:p-10 shadow-2xl shadow-slate-900/35 border border-[#EADBCC] my-auto"
            style={{
              backgroundColor: '#FFFDF7',
              backgroundImage:
                'repeating-linear-gradient(transparent, transparent 27px, rgba(220, 200, 180, 0.45) 28px)',
            }}
          >
            {/* ขอบเย็บด้ายสีแดงรอบสมุดโน้ต (Red Stitched Seam) */}
            <div
              aria-hidden="true"
              className="absolute inset-2 sm:inset-3 rounded-[1.85rem] sm:rounded-[2.35rem] border-2 border-dashed border-[#F87171] pointer-events-none z-10"
            />

            {/* เทปวาชิฝั่งซ้าย: ลายทางสีเขียวพาสเทลเอียงซ้าย */}
            <div
              aria-hidden="true"
              className="absolute -top-4 sm:-top-5 left-8 sm:left-12 w-20 sm:w-24 lg:w-28 h-8 sm:h-9 -rotate-3 z-20 pointer-events-none opacity-95 shadow-md"
              style={{
                background:
                  'repeating-linear-gradient(-45deg, #86EFAC 0px, #86EFAC 8px, #FFFFFF 8px, #FFFFFF 16px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                clipPath: 'polygon(3% 0%, 97% 0%, 100% 100%, 0% 100%)',
              }}
            />

            {/* เทปวาชิฝั่งขวา: ลายทางสีเหลืองพาสเทลเอียงขวา */}
            <div
              aria-hidden="true"
              className="absolute -top-4 sm:-top-5 right-8 sm:right-12 w-20 sm:w-24 lg:w-28 h-8 sm:h-9 rotate-3 z-20 pointer-events-none opacity-95 shadow-md"
              style={{
                background:
                  'repeating-linear-gradient(-45deg, #FDE047 0px, #FDE047 8px, #FFFFFF 8px, #FFFFFF 16px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                clipPath: 'polygon(0% 0%, 100% 0%, 97% 100%, 3% 100%)',
              }}
            />

            {/* โลโก้ growa สีเขียวเข้มสดใส และสโลแกน */}
            <div className="relative z-20 text-center pt-2 sm:pt-3 mb-6 sm:mb-7">
              <div className="inline-flex items-center justify-center gap-1.5">
                <span className="font-display font-black text-4xl sm:text-5xl lg:text-[3.25rem] text-[#15803D] tracking-tight">
                  growa
                </span>
                <span className="inline-block w-3.5 h-3.5 rounded-full bg-[#15803D] -mt-4 animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm lg:text-base font-bold text-slate-600 leading-relaxed max-w-[340px] sm:max-w-md mx-auto mt-1.5 sm:mt-2">
                ร้านยาใกล้บ้าน เภสัชกรช่วยดูแล และระบบดูแลยาของครอบครัว
              </p>
            </div>

            {/* แถบสลับ 2 เมนู (เข้าสู่ระบบ | สมัครสมาชิก) */}
            <div className="relative z-20 p-1.5 sm:p-2 bg-[#FCE7E7] rounded-full border border-red-200/80 mb-6 sm:mb-8 shadow-xs">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onTabChange('login')}
                  className={cn(
                    'flex items-center justify-center min-h-[44px] sm:min-h-[48px] lg:min-h-[52px] px-3 rounded-full text-sm sm:text-base lg:text-lg font-black transition-all cursor-pointer',
                    currentTab === 'login'
                      ? 'text-white shadow-sm ring-2 sm:ring-[2.5px] ring-[#15803D]'
                      : 'text-[#881337] hover:bg-white/40'
                  )}
                  style={
                    currentTab === 'login'
                      ? {
                          background:
                            'repeating-linear-gradient(90deg, #DC2626 0px, #DC2626 4px, #EF4444 4px, #EF4444 8px)',
                        }
                      : undefined
                  }
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange('signup')}
                  className={cn(
                    'flex items-center justify-center min-h-[44px] sm:min-h-[48px] lg:min-h-[52px] px-3 rounded-full text-sm sm:text-base lg:text-lg font-black transition-all cursor-pointer',
                    currentTab === 'signup'
                      ? 'text-white shadow-sm ring-2 sm:ring-[2.5px] ring-[#15803D]'
                      : 'text-[#881337] hover:bg-white/40'
                  )}
                  style={
                    currentTab === 'signup'
                      ? {
                          background:
                            'repeating-linear-gradient(90deg, #DC2626 0px, #DC2626 4px, #EF4444 4px, #EF4444 8px)',
                        }
                      : undefined
                  }
                >
                  สมัครสมาชิก
                </button>
              </div>
            </div>

            {/* เนื้อหาฟอร์ม เข้าสู่ระบบ หรือ สมัครสมาชิก */}
            <div className="relative z-20">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
