import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  Flag,
  Globe,
  HandHelping,
  MapPin,
  Pencil,
  Repeat,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { AttachmentList } from '../ui/AttachmentPicker';
import { CommentThread } from '../ui/CommentThread';
import { Button } from '../ui/Button';
import { DEFAULT_TIME_ZONE, timeZoneLabel } from '../../data/timeZones';
import type { HouseholdMember } from '../../lib/settings';
import {
  EVENT_COLORS,
  getEventColorMeta,
  type EventColor,
  locationLines,
  repeatLabel,
  reminderText,
  timeLabel,
  type Occurrence,
} from '../../lib/calendar';
import { cn } from '../../lib/cn';

interface EventCardProps {
  occurrence: Occurrence;
  members: HouseholdMember[];
  currentMemberId: string;
  canEdit: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeColor?: (id: string, color: EventColor) => void;
  onToggleVolunteer: (id: string) => void;
  onAddComment: (id: string, text: string) => void;
  onDeleteComment: (id: string, commentId: string) => void;
}

const iconButton =
  'inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-600 hover:bg-slate-100 cursor-pointer';

const MetaRow: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <li className="flex items-start gap-2.5 text-base text-slate-700">
    <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0 break-words">{children}</span>
  </li>
);

/** รายละเอียดกิจกรรมหนึ่งรายการในแผงของวัน */
export const EventCard: React.FC<EventCardProps> = ({
  occurrence,
  members,
  currentMemberId,
  canEdit,
  onEdit,
  onDelete,
  onToggleVolunteer,
  onAddComment,
  onDeleteComment,
  onChangeColor,
}) => {
  const { event } = occurrence;
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colorOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!colorRef.current?.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [colorOpen]);

  const colorMeta = getEventColorMeta(event.color, event.important);
  const assigned = members.filter((m) => event.assignees.includes(m.id));
  const iAmAssigned = event.assignees.includes(currentMemberId);
  const location = event.location;
  const hasMeta =
    event.reminderMinutes !== null ||
    !!event.repeat ||
    !!location ||
    event.timeZone !== DEFAULT_TIME_ZONE ||
    event.tags.length > 0;

  return (
    <article
      aria-label={event.title}
      className={cn(
        'rounded-2xl border border-slate-200 border-l-4 bg-white p-4 sm:p-5 space-y-4',
        colorMeta.borderLeft
      )}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-start gap-2 text-lg font-bold text-slate-900 break-words">
            {event.important && (
              <Flag className="w-5 h-5 mt-1 shrink-0 text-red-600 fill-red-600" aria-label="สำคัญ" />
            )}
            <span>{event.title}</span>
          </h3>
          <p className="flex items-center gap-1.5 text-base text-slate-600 mt-0.5">
            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{timeLabel(occurrence)}</span>
            {occurrence.totalDays > 1 && (
              <span className="text-sm text-slate-500">
                (วันที่ {occurrence.dayIndex + 1}/{occurrence.totalDays})
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center shrink-0 -mr-2 -mt-1">
            <div ref={colorRef} className="relative">
              <button
                type="button"
                onClick={() => setColorOpen((v) => !v)}
                aria-label="เปลี่ยนสีแถบกิจกรรม"
                title={`เปลี่ยนสีแถบกิจกรรม (ปัจจุบัน: ${colorMeta.label})`}
                className={iconButton}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded-full ring-2 ring-white shadow-xs transition-transform hover:scale-125',
                    colorMeta.swatchBg
                  )}
                  aria-hidden="true"
                />
              </button>
              {colorOpen && (
                <div
                  role="dialog"
                  aria-label="เลือกสีแถบกิจกรรม"
                  className="anim-pop absolute right-0 top-full z-40 mt-1 flex flex-wrap gap-1.5 p-2 bg-white rounded-2xl border border-slate-200 shadow-xl w-44"
                >
                  <p className="w-full text-xs font-bold text-slate-500 px-1 mb-0.5">เลือกสีแถบ</p>
                  {EVENT_COLORS.map((c) => {
                    const active = (event.color ?? (event.important ? 'rose' : 'amber')) === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => {
                          onChangeColor?.(event.id, c.key);
                          setColorOpen(false);
                        }}
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-115 active:scale-95 cursor-pointer',
                          c.swatchBg,
                          active ? 'ring-2 ring-purple-600 ring-offset-2 scale-110' : ''
                        )}
                      >
                        {active && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEdit(event.id)}
              aria-label={`แก้ไข ${event.title}`}
              className={iconButton}
            >
              <Pencil className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(event.id)}
              aria-label={`ลบ ${event.title}`}
              className={cn(iconButton, 'hover:bg-red-50 hover:text-red-700')}
            >
              <Trash2 className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {event.description && (
        <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
          {event.description}
        </p>
      )}

      {hasMeta && (
        <ul className="space-y-2">
          {event.reminderMinutes !== null && (
            <MetaRow icon={<Bell className="w-4 h-4" />}>{reminderText(event.reminderMinutes)}</MetaRow>
          )}
          {event.repeat && (
            <MetaRow icon={<Repeat className="w-4 h-4" />}>{repeatLabel(event.repeat)}</MetaRow>
          )}
          {location && (
            <MetaRow icon={<MapPin className="w-4 h-4" />}>
              {location.name && <strong className="font-semibold">{location.name}</strong>}
              {location.name && locationLines(location) && <br />}
              {locationLines(location)}
            </MetaRow>
          )}
          {event.timeZone !== DEFAULT_TIME_ZONE && (
            <MetaRow icon={<Globe className="w-4 h-4" />}>{timeZoneLabel(event.timeZone)}</MetaRow>
          )}
          {event.tags.length > 0 && (
            <MetaRow icon={<Tag className="w-4 h-4" />}>
              <span className="flex flex-wrap gap-1.5">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-sm font-semibold text-purple-900"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            </MetaRow>
          )}
        </ul>
      )}

      {(assigned.length > 0 || event.needVolunteer) && (
        <section aria-label="ผู้รับผิดชอบ" className="space-y-3">
          <p className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Users className="w-5 h-5 text-purple-700" aria-hidden="true" />
            ผู้รับผิดชอบ ({assigned.length})
          </p>
          {assigned.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {assigned.map((member) => (
                <li
                  key={member.id}
                  className="inline-flex items-center gap-2 pl-1 pr-3 min-h-[40px] rounded-full bg-purple-50 border border-purple-200 text-base font-semibold text-purple-900"
                >
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-purple-200 text-purple-900 flex items-center justify-center text-sm font-bold"
                  >
                    {member.name.slice(0, 1)}
                  </span>
                  {member.name}
                </li>
              ))}
            </ul>
          )}
          {event.needVolunteer && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 sm:p-4">
              <p className="text-base font-semibold text-emerald-900 min-w-0 break-words">
                {event.createdByName} ต้องการอาสาสมัครสำหรับกิจกรรมนี้
              </p>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant={iAmAssigned ? 'neutral' : 'primary'}
                  onClick={() => onToggleVolunteer(event.id)}
                >
                  <HandHelping className="w-5 h-5" aria-hidden="true" />
                  <span>{iAmAssigned ? 'ยกเลิกการรับงาน' : 'ฉันจะทำเอง'}</span>
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {event.attachments.length > 0 && (
        <section aria-label="ไฟล์แนบ" className="space-y-2">
          <p className="text-base font-bold text-slate-900">ไฟล์แนบ ({event.attachments.length})</p>
          <AttachmentList items={event.attachments} compact />
        </section>
      )}

      <CommentThread
        id={`${event.id}-${occurrence.day}`}
        comments={event.comments}
        currentUserId={currentMemberId}
        onAdd={(text) => onAddComment(event.id, text)}
        onDelete={(commentId) => onDeleteComment(event.id, commentId)}
      />
    </article>
  );
};
