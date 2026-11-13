import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { TERMS_INTRO, TERMS_IS_DRAFT, TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from '../data/termsDocument';

/** ข้อกำหนดการใช้งาน: เปิดอ่านได้โดยไม่ต้องล็อกอิน (ลิงก์จากช่องติ๊กตอนสมัครสมาชิก) */
export const TermsPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const previous = document.title;
    document.title = 'ข้อกำหนดการใช้งาน · Growa Homecare';
    return () => {
      document.title = previous;
    };
  }, []);

  const back = () => {
    // เปิดจากแท็บใหม่แล้วไม่มีหน้าก่อนหน้า: พากลับหน้าแรก
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <main id="main-content" className="app-backdrop min-h-dvh px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={back}
          className="mb-3 inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-[#FFFDF7]/90 pl-2 pr-4 text-lg font-bold text-slate-800 shadow-sm ring-1 ring-white hover:bg-white cursor-pointer"
        >
          <ChevronLeft className="h-6 w-6 shrink-0" aria-hidden="true" />
          <span>กลับ</span>
        </button>

        <Card className="p-5 sm:p-8">
          <h1 className="sr-only">{TERMS_TITLE}</h1>
          <p className="text-sm font-semibold text-slate-600">ข้อกำหนดการใช้งาน · เวอร์ชัน {TERMS_VERSION}</p>
          <article className="py-5 space-y-6">
            {TERMS_IS_DRAFT && (
              <p className="flex items-start gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>ฉบับร่างสำหรับทดสอบระบบ ยังไม่ผ่านการตรวจโดยฝ่ายกฎหมาย</span>
              </p>
            )}
            <header>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{TERMS_TITLE}</h2>
              <p className="mt-3 text-base sm:text-lg text-slate-700 leading-relaxed">{TERMS_INTRO}</p>
            </header>
            {TERMS_SECTIONS.map((section) => (
              <section key={section.title} className="space-y-2">
                <h3 className="text-lg font-bold text-purple-900">{section.title}</h3>
                {section.paragraphs?.map((p) => (
                  <p key={p} className="text-base sm:text-lg text-slate-700 leading-relaxed">
                    {p}
                  </p>
                ))}
                {section.items && (
                  <ul className="list-disc pl-6 space-y-1.5 text-base sm:text-lg text-slate-700 leading-relaxed">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>
          <p className="text-base text-slate-700">
            เรื่องข้อมูลส่วนบุคคลของคุณ อ่านได้ที่{' '}
            <Link to="/privacy-policy" className="font-bold text-purple-800 underline underline-offset-2">
              นโยบายความเป็นส่วนตัว
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
};
