import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ChevronRight, Clock, MapPin, MessageCircle, Phone, Star } from 'lucide-react';
import { PROVIDER_STATUS_LABEL } from '../../consult/options';
import { formatPhone } from '../../consult/format';
import type { Provider } from '../../consult/types';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { StarsDisplay } from './Stars';

/** สถานะออนไลน์ของร้าน ร้านที่ปิดหรือถูกแบนไม่นับว่าออนไลน์ */
export const OnlineBadge: React.FC<{ provider: Provider; className?: string }> = ({ provider, className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-sm font-bold', provider.online ? 'text-emerald-800' : 'text-slate-500', className)}>
    <span className={cn('h-2.5 w-2.5 rounded-full', provider.online ? 'bg-emerald-600' : 'bg-slate-400')} aria-hidden="true" />
    {provider.isSample ? 'ตัวอย่าง: ' : ''}
    {provider.online ? 'ออนไลน์' : 'ออฟไลน์'}
  </span>
);

const STATUS_TONE = {
  open: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  paused: 'border-amber-300 bg-amber-50 text-amber-950',
  banned: 'border-red-300 bg-red-50 text-red-900',
} as const;

export const StatusChip: React.FC<{ provider: Provider }> = ({ provider }) => (
  <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap', STATUS_TONE[provider.status])}>
    {PROVIDER_STATUS_LABEL[provider.status]}
  </span>
);

const Chip: React.FC<{ icon: React.ElementType; children: React.ReactNode; href?: string; label?: string }> = ({ icon: Icon, children, href, label }) => {
  const body = (
    <>
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-all">{children}</span>
    </>
  );
  const base = 'inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-800';
  return href ? (
    <a href={href} aria-label={label} className={cn(base, 'hover:bg-purple-50 hover:border-purple-300')}>
      {body}
    </a>
  ) : (
    <span className={cn(base, 'min-h-[36px]')}>{body}</span>
  );
};

interface ProviderCardProps {
  provider: Provider;
  /** ปุ่มด้านล่างการ์ด เช่น "เลือก" */
  footer?: React.ReactNode;
  /**
   * interactive = ผู้ใช้กดโทรและกด "ดูรายละเอียด" ไปหน้ารายละเอียดของร้านได้
   * false = ใช้เป็นการ์ดที่ห่อด้วยลิงก์ทั้งใบ (หน้าแอดมิน) จึงไม่มีปุ่มซ้อน
   */
  interactive?: boolean;
  /** แสดงสถานะร้านและเลขใบอนุญาต สำหรับแอดมิน */
  admin?: boolean;
}

/** การ์ดผู้ให้บริการ ใช้ร่วมกันทั้งหน้าเลือกปรึกษาและหน้าแอดมิน เพื่อให้แอดมินเห็นเหมือนที่ผู้ใช้เห็น */
export const ProviderCard: React.FC<ProviderCardProps> = ({ provider, footer, interactive = true, admin }) => {
  const location = [provider.province].filter(Boolean).join(' ');
  const shortAddress = provider.address.split('\n')[0];
  const phone = provider.phone ? formatPhone(provider.phone) : '';

  return (
    <Card className="flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start gap-4 min-w-0">
        <Avatar src={provider.photoUrl} name={provider.displayName} className="h-20 w-20 text-3xl shadow-xs ring-2 ring-white" />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-900 break-words">{provider.displayName}</h3>
          <p className="text-base text-slate-600 break-words">{provider.orgName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{provider.kindLabel}</span>
            {admin && <StatusChip provider={provider} />}
            <OnlineBadge provider={provider} />
          </div>
        </div>
      </div>

      {/* แถวดาวแสดงเสมอ มีรีวิวจริงจึงแสดงคะแนน ยังไม่มีก็แสดงดาวว่างกับข้อความ ไม่สร้างคะแนนปลอม */}
      {provider.rating !== null && provider.reviewCount > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-800">
          <StarsDisplay value={provider.rating} />
          {provider.rating.toFixed(1)}
          <span className="font-normal text-slate-600">({provider.reviewCount} รีวิว)</span>
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-base text-slate-600">
          <span aria-hidden="true" className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className="h-5 w-5 fill-slate-100 text-slate-300" />
            ))}
          </span>
          ยังไม่มีรีวิว
        </p>
      )}

      {provider.specialties.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {provider.specialties.map((s) => (
            <li key={s} className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-sm font-semibold text-purple-900">
              {s}
            </li>
          ))}
        </ul>
      )}

      {provider.about && <p className="line-clamp-3 text-base text-slate-700 whitespace-pre-wrap break-words">{provider.about}</p>}

      <div className="space-y-1.5 text-base text-slate-700">
        {(location || shortAddress) && (
          <p className="flex items-start gap-2">
            <MapPin className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0 break-words">{[shortAddress, location].filter(Boolean).join(' · ')}</span>
          </p>
        )}
        {provider.hours && (
          <p className="flex items-start gap-2">
            <Clock className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0 break-words">{provider.hours}</span>
          </p>
        )}
        {admin && (
          <p className="flex items-start gap-2">
            <BadgeCheck className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0 break-words">ใบอนุญาต {provider.licenseNo || 'ไม่ระบุ'}</span>
          </p>
        )}
      </div>

      {(phone || provider.lineId) && (
        <div className="flex flex-wrap gap-2">
          {phone && (
            <Chip icon={Phone} href={interactive ? `tel:${provider.phone}` : undefined} label={`โทร ${phone}`}>
              {phone}
            </Chip>
          )}
          {provider.lineId && <Chip icon={MessageCircle}>LINE {provider.lineId}</Chip>}
        </div>
      )}

      {(footer || interactive) && (
        <div className="mt-auto space-y-2">
          {interactive && (
            <Link
              to={`/consult/providers/${provider.id}`}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-purple-300 bg-white text-base font-bold text-purple-800 hover:bg-purple-50"
            >
              ดูรายละเอียด
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </Link>
          )}
          {footer}
        </div>
      )}
    </Card>
  );
};
