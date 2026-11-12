import React from 'react';
import { Dino } from '../ui/Dino';
import { Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { EventCard } from './EventCard';
import type { HouseholdMember } from '../../lib/settings';
import type { Occurrence } from '../../lib/calendar';

interface DayPanelProps {
  date: Date;
  occurrences: Occurrence[];
  members: HouseholdMember[];
  currentMemberId: string;
  canEdit: boolean;
  panelRef: React.RefObject<HTMLElement>;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeColor?: (id: string, color: import('../../lib/calendar').EventColor) => void;
  onToggleVolunteer: (id: string) => void;
  onAddComment: (id: string, text: string) => void;
  onDeleteComment: (id: string, commentId: string) => void;
}

/** แผงบอกว่าวันที่เลือกมีอะไรต้องทำ: ขวามือบนจอใหญ่ ใต้ตารางบนมือถือ */
export const DayPanel: React.FC<DayPanelProps> = ({
  date,
  occurrences,
  members,
  currentMemberId,
  canEdit,
  panelRef,
  onCreate,
  ...handlers
}) => {
  const title = date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section
      ref={panelRef}
      aria-label={`กิจกรรมของ${title}`}
      className="scroll-mt-24 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 min-[1100px]:sticky min-[1100px]:top-24 min-[1100px]:max-h-[calc(100dvh-7rem)] min-[1100px]:overflow-y-auto overscroll-contain shadow-xs"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 break-words" aria-live="polite">
            {title}
          </h2>
          <p className="text-base text-slate-600 mt-0.5">
            {occurrences.length > 0 ? `${occurrences.length} กิจกรรม` : 'ยังไม่มีกิจกรรม'}
          </p>
        </div>
        {canEdit && (
          <Button type="button" variant="soft" size="sm" onClick={onCreate} className="shrink-0 px-4">
            <Plus className="w-5 h-5" aria-hidden="true" />
            <span>เพิ่ม</span>
          </Button>
        )}
      </div>

      {occurrences.length === 0 ? (
        <div className="py-10 text-center">
          <Dino pose="sleep" bob className="mx-auto mb-3 h-24 w-28" />
          <p className="text-base text-slate-600">วันนี้ไม่มีกิจกรรมที่ต้องทำ</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {occurrences.map((occurrence) => (
            <li key={`${occurrence.event.id}-${occurrence.dayIndex}`}>
              <EventCard
                occurrence={occurrence}
                members={members}
                currentMemberId={currentMemberId}
                canEdit={canEdit}
                {...handlers}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
