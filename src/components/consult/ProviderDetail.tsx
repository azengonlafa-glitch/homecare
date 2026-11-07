import React from 'react';
import { Clock, ExternalLink, Globe, Mail, MapPin, MessageCircle, Phone, Trash2 } from 'lucide-react';
import { formatPhone } from '../../consult/format';
import { CHANNEL_LABEL } from '../../consult/options';
import type { Provider, Review } from '../../consult/types';
import { cn } from '../../lib/cn';
import { Avatar } from '../ui/Avatar';
import { buttonClass } from '../ui/Button';
import { Card } from '../ui/Card';
import { OnlineBadge } from './ProviderCard';
import { StarsDisplay } from './Stars';

export const DetailSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card className="space-y-3 p-5 sm:p-6">
    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    {children}
  </Card>
);

const Info: React.FC<{ icon: React.ElementType; label: string; value?: React.ReactNode }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <div className={cn('text-base break-words whitespace-pre-wrap', value ? 'text-slate-900' : 'text-slate-500')}>{value || 'ยังไม่ระบุ'}</div>
    </div>
  </div>
);

const linkClass = 'font-semibold text-purple-800 underline break-all';

const dateText = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'medium' });

/** รีวิวของร้าน: คะแนนเฉลี่ยจากรีวิวจริง และความคิดเห็นแบบไม่ระบุตัวตน */
export const ReviewsSection: React.FC<{ provider: Provider; reviews: Review[]; onDelete?: (review: Review) => void }> = ({ provider, reviews, onDelete }) => {
  const average = provider.rating !== null && provider.reviewCount > 0 ? provider.rating : null;
  return (
    <DetailSection title="รีวิวและคะแนน">
      {average === null ? (
        <p className="text-base text-slate-600">ยังไม่มีรีวิว คะแนนจะแสดงเมื่อมีผู้ใช้ให้คะแนนหลังปรึกษาจบ</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-4xl font-extrabold text-slate-900">{average.toFixed(1)}</p>
          <div>
            <StarsDisplay value={average} />
            <p className="text-sm font-semibold text-slate-600">จาก {provider.reviewCount} รีวิว</p>
          </div>
        </div>
      )}
      {reviews.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {reviews.map((r) => (
            <li key={r.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StarsDisplay value={r.stars} size="sm" />
                  <span className="text-sm font-semibold text-slate-600">ผู้ใช้ Growa · {dateText(r.createdAt)}</span>
                </div>
                {onDelete && (
                  <button type="button" onClick={() => onDelete(r)} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    ลบรีวิว
                  </button>
                )}
              </div>
              {r.comment ? <p className="text-base text-slate-800 whitespace-pre-wrap break-words">{r.comment}</p> : <p className="text-base text-slate-500">ให้คะแนนโดยไม่เขียนความคิดเห็น</p>}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
};

interface ProviderDetailProps {
  provider: Provider;
  reviews: Review[];
  /** ป้ายเพิ่มข้างชื่อ เช่น สถานะร้าน (แอดมิน) */
  badges?: React.ReactNode;
  /** ปุ่มมุมขวาของหัวข้อ เช่น แก้ไข */
  actions?: React.ReactNode;
  /** ข้อความแจ้งใต้หัวข้อ เช่น ร้านถูกแบน */
  banner?: React.ReactNode;
  /** คอลัมน์ขวา (แอดมิน: ทีมงาน สถานะ ลบ) ถ้าไม่ใส่จะแสดงคอลัมน์เดียว */
  aside?: React.ReactNode;
  onDeleteReview?: (review: Review) => void;
}

/** รายละเอียดร้านชุดเดียวกัน ใช้ทั้งหน้าผู้ใช้และหน้าแอดมิน เพื่อให้เห็นข้อมูลตรงกัน */
export const ProviderDetail: React.FC<ProviderDetailProps> = ({ provider, reviews, badges, actions, banner, aside, onDeleteReview }) => (
  <div className="space-y-5">
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar src={provider.photoUrl} name={provider.displayName} className="h-24 w-24 text-4xl shadow-xs ring-2 ring-white" />
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words">{provider.displayName}</h1>
          <p className="text-base sm:text-lg text-slate-700 break-words">{provider.orgName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{provider.kindLabel}</span>
            {badges}
            <OnlineBadge provider={provider} />
            {provider.rating !== null && provider.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <StarsDisplay value={provider.rating} size="sm" />
                {provider.rating.toFixed(1)} ({provider.reviewCount})
              </span>
            )}
          </div>
        </div>
        {actions}
      </div>
      {banner}
    </Card>

    <div className={cn('grid gap-5 lg:items-start', aside ? 'lg:grid-cols-2' : 'mx-auto max-w-3xl')}>
      <div className="space-y-5">
        <DetailSection title="แนะนำตัว">
          <p className={cn('text-base whitespace-pre-wrap break-words', provider.about ? 'text-slate-900' : 'text-slate-500')}>{provider.about || 'ยังไม่ได้เขียนแนะนำตัว'}</p>
        </DetailSection>

        <DetailSection title="ช่องทางติดต่อ">
          <Info icon={Phone} label="เบอร์โทร" value={provider.phone ? <a href={`tel:${provider.phone}`} className={linkClass}>{formatPhone(provider.phone)}</a> : undefined} />
          <Info icon={MessageCircle} label="LINE" value={provider.lineId} />
          <Info icon={Mail} label="อีเมล" value={provider.contactEmail ? <a href={`mailto:${provider.contactEmail}`} className={linkClass}>{provider.contactEmail}</a> : undefined} />
          <Info icon={Globe} label="เว็บไซต์" value={provider.website ? <a href={provider.website} target="_blank" rel="noopener noreferrer" className={linkClass}>{provider.website}</a> : undefined} />
        </DetailSection>

        <DetailSection title="ที่ตั้ง">
          <Info icon={MapPin} label="ที่อยู่" value={[provider.address, provider.province].filter(Boolean).join('\n')} />
          {provider.mapUrl && (
            <a href={provider.mapUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonClass('soft', 'sm'), 'w-full sm:w-auto')}>
              <ExternalLink className="w-5 h-5" aria-hidden="true" />
              เปิดแผนที่
            </a>
          )}
        </DetailSection>

        <DetailSection title="เวลาทำการและความเชี่ยวชาญ">
          <Info icon={Clock} label="เวลาทำการ" value={provider.hours} />
          {provider.specialties.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {provider.specialties.map((s) => (
                <li key={s} className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-900">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-slate-500">ยังไม่ระบุความเชี่ยวชาญ</p>
          )}
        </DetailSection>

        <DetailSection title="ใบอนุญาตและช่องทางในแอป">
          <p className="text-base text-slate-900 break-words">
            <span className="font-semibold text-slate-600">เลขใบอนุญาต: </span>
            {provider.licenseNo || 'ไม่ระบุ'}
          </p>
          <p className="text-base text-slate-900">
            <span className="font-semibold text-slate-600">ช่องทางในแอป: </span>
            {provider.channels.map((c) => CHANNEL_LABEL[c]).join(' · ')}
          </p>
        </DetailSection>

        {!aside && <ReviewsSection provider={provider} reviews={reviews} onDelete={onDeleteReview} />}
      </div>
      {aside && (
        <div className="space-y-5">
          {aside}
          <ReviewsSection provider={provider} reviews={reviews} onDelete={onDeleteReview} />
        </div>
      )}
    </div>
  </div>
);
