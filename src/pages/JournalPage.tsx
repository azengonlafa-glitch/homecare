import { celebrate } from '../lib/celebrate';
import React, { useEffect, useMemo, useState } from 'react';
import { Gauge, HeartPulse, Image as ImageIcon, PenLine, Smile } from 'lucide-react';
import { Dino } from '../components/ui/Dino';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { PostCard } from '../components/journal/PostCard';
import { deleteDailyRecord, useDailyRecordComposer } from '../components/journal/DailyRecordComposer';
import { ReminderPanel } from '../components/journal/ReminderPanel';
import { EmergencyNote } from '../components/ui/EmergencyNote';
import { useToast } from '../components/ui/Toast';
import { useMedAlerts, type MedAlert } from '../lib/medAlerts';
import { applyDoseStatus, doseWords, loadMeds, saveMeds } from '../lib/meds';
import { CURRENT_MEMBER_ID, SETTINGS_CHANGED_EVENT, loadSettings } from '../lib/settings';
import { CLOUD_UPDATED_EVENT } from '../cloud/queue';
import {
  JOURNAL_CHANGED_EVENT,
  currentJournalUser,
  dayLabel,
  loadPosts,
  newId,
  savePosts,
  type JournalPost,
} from '../lib/journal';

const quickButton =
  'inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full text-base font-bold border transition-colors cursor-pointer';

/**
 * บันทึกอาการ: โพสต์อาการและอารมณ์ให้คนในบ้านตามดู ย้อนดูได้ตามวัน กดถูกใจและแสดงความเห็นได้
 * ลำดับตอนกด "โพสต์": เลือกอาการ -> เลือกอารมณ์ -> กรอกรายละเอียด
 */
export const JournalPage: React.FC = () => {
  const user = useMemo(currentJournalUser, []);
  const [photo, setPhoto] = useState(() => loadSettings().profile.photo);

  useEffect(() => {
    const sync = () => setPhoto(loadSettings().profile.photo);
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
  }, []);
  const [posts, setPosts] = useState<JournalPost[]>(loadPosts);
  const alerts = useMedAlerts();
  const toast = useToast();

  /** บันทึกว่ากินยามื้อที่เตือนอยู่แล้ว (หยุดการเตือนมื้อนั้นทันที) */
  const handleTakeDose = (alert: MedAlert) => {
    if (!alert.period) return;
    const state = loadMeds();
    const med = state.meds.find((m) => m.id === alert.medId);
    if (!med) return;
    const settings = loadSettings();
    saveMeds(
      applyDoseStatus(state, med, alert.period, 'taken', {
        id: CURRENT_MEMBER_ID,
        name: settings.nickname || 'ฉัน',
      })
    );
    toast.show(`บันทึกว่า${med.name} ${doseWords(med.form).done}`);
    celebrate();
  };

  const [deleting, setDeleting] = useState<JournalPost | null>(null);
  const composer = useDailyRecordComposer();

  // เมื่อคนอื่นในบ้านเพิ่ม/แก้โพสต์ หรือบันทึกจากหน้าต่างบันทึกประจำวัน ให้โหลดรายการใหม่
  useEffect(() => {
    const reload = () => setPosts(loadPosts());
    window.addEventListener(CLOUD_UPDATED_EVENT, reload);
    window.addEventListener(JOURNAL_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(CLOUD_UPDATED_EVENT, reload);
      window.removeEventListener(JOURNAL_CHANGED_EVENT, reload);
    };
  }, []);

  const commit = (next: JournalPost[]) => {
    setPosts(next);
    savePosts(next);
  };

  // ----- ถูกใจ / ความเห็น / ลบ -----
  const toggleLike = (postId: string) =>
    commit(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              likes: p.likes.includes(user.id)
                ? p.likes.filter((id) => id !== user.id)
                : [...p.likes, user.id],
            }
          : p
      )
    );

  const addComment = (postId: string, text: string) =>
    commit(
      posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                {
                  id: newId(),
                  authorId: user.id,
                  authorName: user.name,
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : p
      )
    );

  const deleteComment = (postId: string, commentId: string) =>
    commit(
      posts.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p
      )
    );

  const confirmDelete = () => {
    if (!deleting) return;
    deleteDailyRecord(deleting);
    setDeleting(null);
  };

  // จัดกลุ่มโพสต์ตามวัน (โพสต์เรียงใหม่สุดก่อนอยู่แล้ว)
  const groups = useMemo(() => {
    const map = new Map<string, JournalPost[]>();
    for (const post of posts) {
      const label = dayLabel(post.createdAt);
      map.set(label, [...(map.get(label) ?? []), post]);
    }
    return [...map.entries()];
  }, [posts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="บันทึกอาการ"
        description="บันทึกประจำวัน: อาการ อารมณ์ รูป และค่าสุขภาพ ในโพสต์เดียว คนในบ้านตามดูได้ และดูพัฒนาการได้ที่หน้าสมาชิก"
      />

      {/* การแจ้งเตือนเรื่องยาที่ค้างอยู่ (ถ้ามี) */}
      <ReminderPanel alerts={alerts} onTake={handleTakeDose} />

      {/* กล่องเริ่มโพสต์ */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Avatar src={photo} name={user.name} className="w-12 h-12 text-lg shadow-xs" />
          <button
            type="button"
            onClick={() => composer.start()}
            className="flex-1 min-h-[52px] px-5 rounded-full border border-slate-300 bg-slate-50 text-left text-base sm:text-lg text-slate-600 hover:bg-slate-100 cursor-text truncate"
          >
            <span className="sm:hidden">วันนี้เป็นอย่างไรบ้าง?</span>
            <span className="hidden sm:inline">วันนี้เป็นอย่างไรบ้าง? เล่าให้คนในบ้านฟัง</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => composer.start({ first: 'symptoms' })}
            className={`${quickButton} bg-red-50 text-red-800 border-red-200 hover:bg-red-100`}
          >
            <HeartPulse className="w-5 h-5" aria-hidden="true" />
            <span>อาการ</span>
          </button>
          <button
            type="button"
            onClick={() => composer.start({ first: 'mood' })}
            className={`${quickButton} bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100`}
          >
            <Smile className="w-5 h-5" aria-hidden="true" />
            <span>อารมณ์</span>
          </button>
          <button
            type="button"
            onClick={() => composer.start({ first: 'vitals' })}
            className={`${quickButton} bg-sky-soft text-sky-900 border-sky-200 hover:bg-sky-100`}
          >
            <Gauge className="w-5 h-5" aria-hidden="true" />
            <span>ค่าสุขภาพ</span>
          </button>
          <button
            type="button"
            onClick={() => composer.start()}
            className={`${quickButton} bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100`}
          >
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
            <span>รูปภาพ</span>
          </button>

          <Button type="button" onClick={() => composer.start({ first: 'symptoms', guided: true })} className="ml-auto w-full sm:w-auto">
            <PenLine className="w-5 h-5" aria-hidden="true" />
            <span>บันทึกวันนี้</span>
          </Button>
        </div>
      </Card>

      <EmergencyNote />

      {/* รายการโพสต์ */}
      {posts.length === 0 ? (
        <Card className="py-14 text-center">
          <Dino pose="cheer" bob className="mx-auto mb-4 h-28 w-32" />
          <h2 className="text-xl font-bold text-slate-900">ยังไม่มีบันทึกอาการ</h2>
          <p className="text-base text-slate-600 mt-1 max-w-md mx-auto">
            เริ่มโพสต์อาการแรก เพื่อให้คนในบ้านเห็นและช่วยตามดูอาการได้
          </p>
          <Button type="button" className="mt-6" onClick={() => composer.start({ first: 'symptoms', guided: true })}>
            เริ่มบันทึกอาการ
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([label, items]) => (
            <section key={label} aria-labelledby={`day-${label}`}>
              <h2 id={`day-${label}`} className="bg-label mb-3 text-lg font-bold text-slate-900">
                {label}
              </h2>
              <div className="stagger space-y-4">
                {items.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    user={user}
                    onToggleLike={toggleLike}
                    onAddComment={addComment}
                    onDeleteComment={deleteComment}
                    onEdit={composer.startEdit}
                    onDelete={setDeleting}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {composer.element}

      <ConfirmDialog
        open={deleting !== null}
        title="ลบโพสต์นี้?"
        message="บันทึก รูป ความเห็น และค่าสุขภาพของบันทึกนี้จะถูกลบ ย้อนกลับไม่ได้"
        confirmLabel="ลบโพสต์"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
