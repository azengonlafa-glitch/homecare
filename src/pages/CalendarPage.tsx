import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Flag, Plus, Search, X } from 'lucide-react';
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
  parseKey,
  saveEvents,
  getEventColorMeta,
  type EventColor,
  type CalendarEvent,
  type Occurrence,
} from '../lib/calendar';
import { cn } from '../lib/cn';
import { CLOUD_UPDATED_EVENT } from '../cloud/queue';

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

type EventFilter = 'all' | 'important' | 'repeat' | 'volunteer';

const FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'important', label: 'สำคัญ' },
  { value: 'repeat', label: 'ทำซ้ำ' },
  { value: 'volunteer', label: 'ต้องการอาสาสมัคร' },
];

/** ค้นหาจากชื่อ คำอธิบาย แท็ก สถานที่ และชื่อผู้สร้าง */
const matchesQuery = (ev: CalendarEvent, query: string) => {
  const q = query.trim().toLocaleLowerCase('th');
  if (!q) return true;
  const haystack = [
    ev.title,
    ev.description,
    ev.createdByName,
    ...ev.tags,
    ev.location?.name ?? '',
    ev.location?.address1 ?? '',
    ev.location?.city ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase('th');
  return haystack.includes(q);
};

const matchesFilter = (ev: CalendarEvent, filter: EventFilter) => {
  switch (filter) {
    case 'important':
      return ev.important;
    case 'repeat':
      return !!ev.repeat;
    case 'volunteer':
      return ev.needVolunteer;
    default:
      return true;
  }
};

/** ปฏิทินรายเดือน + แผงรายละเอียดของวัน + สร้าง/แก้ไขกิจกรรม */
export const CalendarPage: React.FC = () => {
  const today = new Date();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(loadEvents);

  // เมื่อคนอื่นในบ้านเพิ่ม/แก้กิจกรรม ให้โหลดรายการใหม่
  useEffect(() => {
    const reload = () => setEvents(loadEvents());
    window.addEventListener(CLOUD_UPDATED_EVENT, reload);
    return () => window.removeEventListener(CLOUD_UPDATED_EVENT, reload);
  }, []);
  const [form, setForm] = useState<FormState>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<EventFilter>('all');
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const settings = useMemo(loadSettings, []);
  const currentMember = getCurrentMember(settings);
  const currentName = currentMember?.name ?? 'ฉัน';
  // ทุกบทบาทในบ้านใช้ปฏิทินได้เต็มที่
  const canEdit = true;

  const searching = query.trim() !== '' || filter !== 'all';
  const visibleEvents = useMemo(
    () => events.filter((ev) => matchesQuery(ev, query) && matchesFilter(ev, filter)),
    [events, query, filter]
  );
  const results = useMemo(
    () => [...visibleEvents].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [visibleEvents]
  );

  const weeks = useMemo(() => buildMonthGrid(month), [month]);
  const byDay = useMemo(
    () => eventsByDay(visibleEvents, weeks[0][0].date, weeks[weeks.length - 1][6].date),
    [visibleEvents, weeks]
  );
  const selectedOccurrences = useMemo(
    () => eventsByDay(visibleEvents, selected, selected).get(dateKey(selected)) ?? [],
    [visibleEvents, selected]
  );

  const jumpTo = (ev: CalendarEvent) => {
    const start = parseKey(ev.startDate);
    setSelected(start);
    setMonth(startOfMonth(start));
  };

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

  const changeColor = (id: string, color: EventColor) =>
    patchEvent(id, (ev) => ({ ...ev, color, updatedAt: new Date().toISOString() }));

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
                      occ.event.important ? 'bg-red-100 text-red-900' : `${getEventColorMeta(occ.event.color, occ.event.important).chipBg} ${getEventColorMeta(occ.event.color, occ.event.important).chipText}`
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
                      getEventColorMeta(occ.event.color, occ.event.important).dotBg
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

          {/* ค้นหา + ตัวกรอง */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-0">
              <Search
                className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="ค้นหากิจกรรม"
                placeholder="ค้นหากิจกรรม แท็ก หรือสถานที่"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full min-h-[48px] pl-12 pr-11 rounded-full border border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  aria-label="ล้างคำค้นหา"
                  onClick={() => setQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-auto shrink-0">
              <select
                aria-label="กรองกิจกรรม"
                value={filter}
                onChange={(e) => setFilter(e.target.value as EventFilter)}
                className="appearance-none w-full sm:w-auto min-h-[48px] pl-5 pr-11 rounded-full bg-purple-50 border border-purple-100 text-base font-bold text-purple-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
              >
                {FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="w-4 h-4 text-purple-800 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>

          {searching && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p role="status" className="px-2 pb-2 text-base font-semibold text-slate-700">
                {results.length > 0 ? `พบ ${results.length} กิจกรรม` : 'ไม่พบกิจกรรมที่ค้นหา'}
              </p>
              {results.length > 0 && (
                <ul className="max-h-56 overflow-y-auto space-y-1">
                  {results.map((ev) => (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => jumpTo(ev)}
                        className="flex w-full items-center gap-3 min-h-[48px] px-3 py-2 rounded-xl text-left hover:bg-white cursor-pointer"
                      >
                        {ev.important ? (
                          <Flag className="w-4 h-4 shrink-0 text-red-600 fill-red-600" aria-label="สำคัญ" />
                        ) : (
                          <span className="w-3 h-3 shrink-0 rounded-sm bg-amber-300" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 text-base font-semibold text-slate-900 truncate">
                          {ev.title}
                        </span>
                        <span className="shrink-0 text-sm text-slate-600">
                          {parseKey(ev.startDate).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
          onChangeColor={changeColor}
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
