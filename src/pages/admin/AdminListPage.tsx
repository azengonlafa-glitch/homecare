import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Stethoscope } from 'lucide-react';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { ProviderCard } from '../../components/consult/ProviderCard';
import { buttonClass } from '../../components/ui/Button';
import { Chip } from '../../components/ui/ChoiceChips';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useConsultData } from '../../consult/hooks';
import { PROVIDER_STATUS_LABEL } from '../../consult/options';
import type { Provider, ProviderStatus } from '../../consult/types';

type Filter = 'all' | ProviderStatus;

/** หน้าแอดมิน: การ์ดของแต่ละร้านหน้าตาเหมือนที่ผู้ใช้เห็น กดเข้าไปดูรายละเอียดและแก้ไข */
export const AdminListPage: React.FC = () => {
  const { data, loading, error, reload } = useConsultData((b) => b.listAllProviders(), [], { sessionId: null });
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      all: list.length,
      open: list.filter((p) => p.status === 'open').length,
      paused: list.filter((p) => p.status === 'paused').length,
      banned: list.filter((p) => p.status === 'banned').length,
      online: list.filter((p) => p.online).length,
    };
  }, [data]);

  const shown: Provider[] = useMemo(() => (data ?? []).filter((p) => filter === 'all' || p.status === filter), [data, filter]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="ผู้ให้บริการ"
        description={data ? `ทั้งหมด ${counts.all} ร้าน · ออนไลน์อยู่ ${counts.online} ร้าน กดที่การ์ดเพื่อดูรายละเอียดและแก้ไข` : 'กดที่การ์ดเพื่อดูรายละเอียดและแก้ไข'}
        action={
          <Link to="/admin/providers/new" className={buttonClass('primary', 'sm')}>
            <Plus className="w-5 h-5" aria-hidden="true" />
            เพิ่มผู้ให้บริการ
          </Link>
        }
      />

      {loading && !data ? (
        <LoadingCard label="กำลังโหลดผู้ให้บริการ..." />
      ) : error && !data ? (
        <ErrorCard message={error} onRetry={reload} />
      ) : (
        <>
          {counts.all > 0 && (
            <div role="group" aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
              {(['all', 'open', 'paused', 'banned'] as Filter[]).map((f) => (
                <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'ทั้งหมด' : PROVIDER_STATUS_LABEL[f]} ({counts[f]})
                </Chip>
              ))}
            </div>
          )}
          {counts.all === 0 ? (
            <EmptyState pose="peek" icon={Stethoscope} message="ยังไม่มีผู้ให้บริการ ผู้ใช้จะยังเลือกปรึกษาใครไม่ได้ กด “เพิ่มผู้ให้บริการ” เพื่อเริ่ม" />
          ) : shown.length === 0 ? (
            <EmptyState icon={Stethoscope} message="ไม่มีร้านในสถานะนี้" />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/admin/providers/${p.id}`}
                    aria-label={`ดูรายละเอียด ${p.displayName}`}
                    className="block h-full rounded-3xl transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
                  >
                    <ProviderCard provider={p} interactive={false} admin />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
