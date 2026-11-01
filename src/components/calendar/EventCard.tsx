import React from 'react';
import {
  Bell,
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
import { locationLines, repeatLabel, reminderText, timeLabel, type Occurrence } from '../../lib/calendar';
import { cn } from '../../lib/cn';

interface EventCardProps {
  occurrence: Occurrence;
  members: HouseholdMember[];
  currentMemberId: string;
  canEdit: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
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
}) => {
  const { event } = occurrence;
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
        event.important ? 'border-l-red-500' : 'border-l-amber-400'
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
          <div className="flex shrink-0 -mr-2 -mt-1">
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
