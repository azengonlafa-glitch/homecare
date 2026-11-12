import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmergencyNote } from '../../components/ui/EmergencyNote';
import { Button, buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { ProviderCard } from '../../components/consult/ProviderCard';
import { clearDraft, loadDraft, startDraft, useConsultData } from '../../consult/hooks';
import type { Provider } from '../../consult/types';

/** Module 1: ศูนย์กลางเลือกร้านยาหรือคลินิก */
export const ConsultHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => loadDraft());
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [providers, categories] = await Promise.all([b.listProviders(), b.listCategories()]);
      return { providers, categories };
    },
    [],
    { sessionId: null }
  );
  const providers = data?.providers;
  const { data: access } = useConsultData(
    async (b) => {
      const [staff, admin] = await Promise.all([b.getStaffContext(), b.getAdminAccess()]);
      return { staff: !!staff && staff.role !== 'admin', admin };
    },
    []
  );

  // แยกกลุ่มตามหมวดหมู่ที่แอดมินตั้งไว้ หมวดที่ยังไม่มีร้านไม่แสดง ออนไลน์ขึ้นก่อน
  const groups = useMemo(
    () =>
      (data?.categories ?? [])
        .map((c) => ({
          kind: c.id,
          title: c.label,
          items: (providers ?? []).filter((p) => p.kind === c.id).sort((a, b) => Number(b.online) - Number(a.online)),
        }))
        .filter((g) => g.items.length > 0),
    [data, providers]
  );

  const choose = (provider: Provider) => {
    startDraft(provider.id);
    navigate('/consult/checkin');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="ปรึกษาเภสัชกร" description="เลือกคนที่อยากปรึกษา แล้วคุยได้ทั้งข้อความ โทร หรือวิดีโอคอลในห้องเดียวกัน ข้อมูลสุขภาพและอาการล่าสุดจะส่งให้เภสัชกรหรือคลินิก คุณตรวจสอบและยินยอมก่อนส่งเสมอ" />

      <EmergencyNote />

      {draft && (
        <Card className="fit-row justify-between p-5">
          <p className="flex-1 text-base font-semibold text-slate-900">คุณมีแบบสอบถามที่ยังทำไม่เสร็จ</p>
          <div className="flex gap-2">
            <Link to="/consult/checkin" className={buttonClass('soft', 'sm')}>
              ทำต่อ
            </Link>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => {
                clearDraft();
                setDraft(null);
              }}
            >
              ทิ้ง
            </Button>
          </div>
        </Card>
      )}

      <section aria-label="ร้านยาหรือคลินิก" className="space-y-6">
        {loading && !data ? (
          <LoadingCard label="กำลังโหลดร้านยาหรือคลินิก..." />
        ) : error ? (
          <ErrorCard message={error} onRetry={reload} />
        ) : groups.length === 0 ? (
          <EmptyState pose="confused" icon={Stethoscope} message="ยังไม่มีร้านยาหรือคลินิกในระบบ" />
        ) : (
          groups.map((group) => (
            <div key={group.kind} className="space-y-3">
              <h2 className="text-xl font-bold text-slate-900">{group.title}</h2>
              <div className="tile-cycle grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    footer={
                      <>
                        {!p.online && <p className="text-sm text-slate-600">ยังไม่ออนไลน์ ส่งคำขอไว้ได้ ร้านยาหรือคลินิกจะตอบเมื่อกลับมาออนไลน์</p>}
                        <Button size="sm" fullWidth onClick={() => choose(p)}>
                          เลือก
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {(access?.staff || access?.admin) && (
        <div className="flex flex-wrap gap-2">
          {access.staff && (
            <Link to="/pharmacist" className={buttonClass('neutral', 'sm')}>
              พื้นที่เภสัชกร
            </Link>
          )}
          {access.admin && (
            <Link to="/admin" className={buttonClass('neutral', 'sm')}>
              จัดการร้านยาหรือคลินิก
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
