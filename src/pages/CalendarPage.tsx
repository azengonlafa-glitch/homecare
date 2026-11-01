import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag, Plus } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { DayPanel } from '../components/calendar/DayPanel';
import { EventFormModal, type EventFormData } from '../components/calendar/EventFormModal';
import { deleteFiles } from '../lib/fileStore';
import { newId } from '../lib/journal';
import { CURRENT_MEMBER_ID, getCurrentMember, loadSettings } from '../lib/settings';
import {
  addDays,
  addMonths,
  dateKey,
  eventsByDay,
  isSameDay,
  loadEvents,
  saveEvents,
  type CalendarEvent,
  type Occurrence,
} from '../lib/calendar';
import { cn } from '../lib/cn';

/** ชื่อวัน (เริ่มที่วันอาทิตย์) ตัวเต็มสำหรับ screen reader ตัวย่อสำหรับแสดงผล */
const WEEKDAYS = [
  { short: 'อา.', full: 'วันอาทิตย์' },
  { short: 'จ.', full: 'วันจันทร์' },
  { short: 'อ.', full: 'วันอังคาร' },
  { short: 'พ.', full: 'วันพุธ' },
  { short: 'พฤ.', full: 'วันพฤหัสบดี' },
  { short: 'ศ.', full: 'วันศุกร์' },
  { short: 'ส.', full: 'วันเสาร์' },
];

interface DayCell {
  date: Date;
  inMonth: boolean;
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** สร้างตารางของเดือน: เริ่มวันอาทิตย์ จำนวนแถวพอดีกับเดือน (5 หรือ 6 แถว) */
const buildMonthGrid = (month: Date): DayCell[][] => {
  const first = startOfMonth(month);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(gridStart, week * 7 + day);
      return { date, inMonth: date.getMonth() === first.getMonth() };
    })
  );
};

const navButtonClass =
  'inline-flex items-center justify-center min-h-[48px] min-w-[48px] rounded-full bg-purple-50 text-purple-900 hover:bg-purple-100 active:bg-purple-200 border border-purple-200 transition-colors cursor-pointer';

type FormState = { mode: 'new' } | { mode: 'edit'; id: string } | null;

/** ปฏิทินรายเดือน + แผงรายละเอียดของวัน + สร้าง/แก้ไขกิจกรรม */
export const CalendarPage: React.FC = () => {
  const today = new Date();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const settings = useMemo(loadSettings, []);
  const currentMember = getCurrentMember(settings);
  const currentName = currentMember?.name ?? 'ฉัน';
  const canEdit = currentMember ? currentMember.permission === 'edit' : true;

  const weeks = useMemo(() => buildMonthGrid(month), [month]);
  const byDay = useMemo(
    () => eventsByDay(events, weeks[0][0].date, weeks[weeks.length - 1][6].date),
    [events, weeks]
  );
  const selectedOccurrences = useMemo(
    () => eventsByDay(events, selected, selected).get(dateKey(selected)) ?? [],
    [events, selected]
  );

  const monthLabel = month.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  const isCurrentMonth = dateKey(month) === dateKey(startOfMonth(today));

  const commit = (next: CalendarEvent[]) => {
    setEvents(next);
    saveEvents(next);
  };

  const patchEvent = (id: string, change: (ev: CalendarEvent) => CalendarEvent) =>
    commit(events.map((ev) => (ev.id === id ? change(ev) : ev)));

  // ----- เลื่อนเดือน / เลือกวัน -----
  const goTo = (offset: number) => {
    setMonth(addMonths(month, offset));
    setSelected(addMonths(selected, offset));
  };

  const goToday = () => {
    const now = new Date();
    setMonth(startOfMonth(now));
    setSelected(now);
  };

  const selectDay = (date: Date, inMonth: boolean) => {
    setSelected(date);
    if (!inMonth) setMonth(startOfMonth(date));
    // บนมือถือแผงอยู่ใต้ตาราง เลื่อนลงไปให้เห็นรายละเอียดของวันที่เลือก
    if (!window.matchMedia('(min-width: 1100px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      );
    }
  };

  // ----- สร้าง / แก้ไข / ลบ -----
  const save = (data: EventFormData) => {
    const now = new Date().toISOString();
    if (form?.mode === 'edit') {
      patchEvent(form.id, (ev) => ({ ...ev, ...data, updatedAt: now }));
    } else {
      commit([
        ...events,
        {
          ...data,
          id: newId(),
          comments: [],
          createdById: CURRENT_MEMBER_ID,
          createdByName: currentName,
          createdAt: now,
          updatedAt: null,
        },
      ]);
    }
    // ไปที่วันเริ่มของกิจกรรมเพื่อให้เห็นผลทันที
    const start = new Date(`${data.startDate}T00:00:00`);
    setSelected(start);
    setMonth(startOfMonth(start));
    setForm(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    void deleteFiles(deleting.attachments);
    commit(events.filter((ev) => ev.id !== deleting.id));
    setDeleting(null);
  };

  const toggleVolunteer = (id: string) =>
    patchEvent(id, (ev) => ({
      ...ev,
      assignees: ev.assignees.includes(CURRENT_MEMBER_ID)
        ? ev.assignees.filter((a) => a !== CURRENT_MEMBER_ID)
        : [...ev.assignees, CURRENT_MEMBER_ID],
    }));

  const addComment = (id: string, text: string) =>
    patchEvent(id, (ev) => ({
      ...ev,
      comments: [
        ...ev.comments,
        {
          id: newId(),
          authorId: CURRENT_MEMBER_ID,
          authorName: currentName,
          text,
          createdAt: new Date().toISOString(),
        },
      ],
    }));

  const deleteComment = (id: string, commentId: string) =>
    patchEvent(id, (ev) => ({ ...ev, comments: ev.comments.filter((c) => c.id !== commentId) }));

  const editingEvent = form?.mode === 'edit' ? (events.find((ev) => ev.id === form.id) ?? null) : null;

  const renderCell = ({ date, inMonth }: DayCell) => {
    const key = dateKey(date);
    const isToday = isSameDay(date, today);
    const isSelected = isSameDay(date, selected);
    const list: Occurrence[] = byDay.get(key) ?? [];
    const label = `${date.toLocaleDateString('th-TH', { dateStyle: 'long' })}${list.length ? ` มี ${list.length} กิจกรรม` : ''}`;

    return (
      <td
        key={key}
        aria-current={isToday ? 'date' : undefined}
        className="h-[4.5rem] sm:h-28 align-top p-0 border-t border-l border-slate-100 first:border-l-0"
      >
        <button
          type="button"
          aria-label={label}
          aria-pressed={isSelected}
          onClick={() => selectDay(date, inMonth)}
          className={cn(
            'block w-full h-full text-left p-1.5 sm:p-2 cursor-pointer transition-colors overflow-hidden',
            isSelected ? 'bg-purple-50 ring-2 ring-inset ring-purple-600' : 'hover:bg-slate-50'
          )}
        >
          <time
            dateTime={key}
            className={cn(
              'inline-flex items-center justify-center min-w-8 h-8 px-1 rounded-full text-sm sm:text-base font-semibold',
              isToday ? 'bg-purple-700 text-white' : inMonth ? 'text-slate-800' : 'text-slate-400 font-medium'
            )}
          >
            {date.getDate()}
          </time>

          {list.length > 0 && (
            <>
              {/* ป้ายชื่อกิจกรรม: เมื่อช่องกว้างพอ */}
              <span
                className="hidden sm:flex min-[1100px]:max-[1279px]:hidden flex-col gap-1 mt-1"
                aria-hidden="true"
              >
                {list.slice(0, 2).map((occ) => (
                  <span
                    key={`${occ.event.id}-${occ.dayIndex}`}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold truncate',
                      occ.event.important ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-950'
                    )}
                  >
                    {occ.event.important && <Flag className="w-3 h-3 shrink-0 fill-current" />}
                    <span className="truncate">{occ.event.title}</span>
                  </span>
                ))}
                {list.length > 2 && (
                  <span className="px-1 text-xs font-semibold text-slate-600">+{list.length - 2}</span>
                )}
              </span>

              {/* จุดสี: จอแคบ หรือช่องตารางแคบ */}
              <span
                className="flex sm:hidden min-[1100px]:max-[1279px]:flex flex-wrap gap-1 mt-1 px-1"
                aria-hidden="true"
              >
                {list.slice(0, 3).map((occ) => (
                  <span
                    key={`${occ.event.id}-${occ.dayIndex}`}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      occ.event.important ? 'bg-red-500' : 'bg-amber-400'
                    )}
                  />
                ))}
              </span>
            </>
          )}
        </button>
      </td>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ปฏิทิน"
        description="กิจกรรม นัดหมาย และงานที่ต้องทำของคนในบ้าน"
        action={
          canEdit ? (
            <Button type="button" onClick={() => setForm({ mode: 'new' })} className="w-full sm:w-auto">
              <Plus className="w-5 h-5" aria-hidden="true" />
              <span>สร้างกิจกรรม</span>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6 min-[1100px]:space-y-0 min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_24rem] min-[1100px]:gap-6 min-[1100px]:items-start">
        <Card className="p-4 sm:p-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900" aria-live="polite">
              {monthLabel}
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goTo(-1)}
                aria-label="เดือนก่อนหน้า"
                className={navButtonClass}
              >
                <ChevronLeft className="w-6 h-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goToday}
                disabled={isCurrentMonth && isSameDay(selected, today)}
                className={cn(
                  navButtonClass,
                  'px-5 text-base font-bold disabled:opacity-50 disabled:cursor-default'
                )}
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => goTo(1)}
                aria-label="เดือนถัดไป"
                className={navButtonClass}
              >
                <ChevronRight className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul
            className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-4 text-sm text-slate-600"
            aria-label="สัญลักษณ์"
          >
            <li className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-300" aria-hidden="true" />
              กิจกรรม
            </li>
            <li className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-red-600 fill-red-600" aria-hidden="true" />
              สำคัญ
            </li>
          </ul>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full table-fixed border-collapse" aria-label={`ปฏิทินเดือน${monthLabel}`}>
              <thead>
                <tr className="bg-purple-50">
                  {WEEKDAYS.map((day) => (
                    <th
                      key={day.full}
                      scope="col"
                      abbr={day.full}
                      className="py-3 text-sm sm:text-base font-bold text-slate-800 border-b border-slate-200"
                    >
                      {day.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={dateKey(week[0].date)}>{week.map(renderCell)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <DayPanel
          date={selected}
          occurrences={selectedOccurrences}
          members={settings.members}
          currentMemberId={CURRENT_MEMBER_ID}
          canEdit={canEdit}
          panelRef={panelRef}
          onCreate={() => setForm({ mode: 'new' })}
          onEdit={(id) => setForm({ mode: 'edit', id })}
          onDelete={(id) => setDeleting(events.find((ev) => ev.id === id) ?? null)}
          onToggleVolunteer={toggleVolunteer}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
        />
      </div>

      <EventFormModal
        open={form !== null}
        initial={editingEvent}
        defaultDate={dateKey(selected)}
        members={settings.members}
        onSave={save}
        onClose={() => setForm(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="ลบกิจกรรมนี้?"
        message={
          deleting?.repeat
            ? `“${deleting.title}” เป็นกิจกรรมที่ทำซ้ำ จะถูกลบทุกครั้ง พร้อมไฟล์แนบและความเห็น ย้อนกลับไม่ได้`
            : `“${deleting?.title ?? ''}” พร้อมไฟล์แนบและความเห็นจะถูกลบ ย้อนกลับไม่ได้`
        }
        confirmLabel="ลบกิจกรรม"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
