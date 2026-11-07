import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { ProviderDetail } from '../../components/consult/ProviderDetail';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { startDraft, useConsultData } from '../../consult/hooks';

/** รายละเอียดร้านสำหรับผู้ใช้ ข้อมูลชุดเดียวกับที่แอดมินเห็น พร้อมรีวิว และปุ่มเลือกปรึกษา */
export const ProviderPublicPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const provider = await b.getProvider(id);
      return { provider, reviews: provider ? await b.listReviews(id) : [] };
    },
    [id]
  );

  if (loading && !data) return <LoadingCard label="กำลังโหลดข้อมูลร้าน..." />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;
  const provider = data?.provider;
  const back = (
    <Link to="/consult" className="inline-flex min-h-[48px] items-center gap-1.5 text-base font-bold text-purple-800 hover:underline">
      <ArrowLeft className="w-5 h-5" aria-hidden="true" />
      ผู้ให้บริการทั้งหมด
    </Link>
  );
  if (!data || !provider) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorCard message="ไม่พบผู้ให้บริการนี้ หรือไม่เปิดให้บริการแล้ว" />
      </div>
    );
  }
  const available = provider.status === 'open';

  return (
    <div className="space-y-5">
      {back}
      <ProviderDetail provider={provider} reviews={data.reviews} />
      <Card className="mx-auto max-w-3xl space-y-2 p-5 sm:p-6">
        {!available && <p className="text-base font-semibold text-amber-900">ร้านนี้ปิดให้บริการอยู่ในขณะนี้ จึงเริ่มปรึกษาใหม่ไม่ได้</p>}
        {available && !provider.online && <p className="text-sm text-slate-600">ยังไม่ออนไลน์ ส่งคำขอไว้ได้ ผู้ให้บริการจะตอบเมื่อกลับมาออนไลน์</p>}
        <Button
          fullWidth
          disabled={!available}
          onClick={() => {
            startDraft(provider.id);
            navigate('/consult/checkin');
          }}
        >
          เลือกปรึกษาร้านนี้
        </Button>
      </Card>
    </div>
  );
};
