import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ConsentArticle } from '../components/onboarding/ConsentArticle';
import { CONSENT_VERSION } from '../data/consentDocument';

/**
 * นโยบายความเป็นส่วนตัว: เปิดอ่านได้โดยไม่ต้องล็อกอิน (ลิงก์จากหน้าสมัครสมาชิกและหน้าตั้งค่า)
 * ใช้เนื้อหาชุดเดียวกับเอกสารให้ความยินยอม จึงไม่มีสองฉบับที่ไม่ตรงกัน
 */
export const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const previous = document.title;
    document.title = 'นโยบายความเป็นส่วนตัว · Growa Homecare';
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
          <h1 className="sr-only">นโยบายความเป็นส่วนตัว</h1>
          <p className="text-sm font-semibold text-slate-600">นโยบายความเป็นส่วนตัว · เวอร์ชัน {CONSENT_VERSION}</p>
          <ConsentArticle showClosing={false} />
          <p className="mb-2 text-base text-slate-700">
            กติกาการใช้แอปอยู่ที่{' '}
            <Link to="/terms" className="font-bold text-purple-800 underline underline-offset-2">
              ข้อกำหนดการใช้งาน
            </Link>
          </p>
          <p className="text-base text-slate-700">
            ต้องการใช้สิทธิของคุณ?{' '}
            <Link to="/settings/data" className="font-bold text-purple-800 underline underline-offset-2">
              ไปที่ ตั้งค่า › ข้อมูลและความยินยอมของฉัน
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
};
