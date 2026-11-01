import React, { useMemo, useRef, useState } from 'react';
import { HeartPulse, Image as ImageIcon, NotebookPen, PenLine, Smile } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { OptionPickerModal } from '../components/ui/OptionPickerModal';
import { ConfirmDialog } from '../components/settings/ConfirmDialog';
import { MoodPickerModal } from '../components/journal/MoodPickerModal';
import { PostComposerModal, type PostDraft } from '../components/journal/PostComposerModal';
import { PostCard } from '../components/journal/PostCard';
import { SYMPTOMS, type MoodKey } from '../data/journalOptions';
import { deleteFiles } from '../lib/fileStore';
import { loadHomeData } from '../lib/storage';
import {
  SELF_LABEL,
  currentJournalUser,
  dayLabel,
  loadPosts,
  newId,
  savePosts,
  type JournalPost,
} from '../lib/journal';

type Step = 'symptoms' | 'mood' | 'details' | null;

const emptyDraft = (): PostDraft => ({
  about: SELF_LABEL,
  title: '',
  content: '',
  symptoms: [],
  moodMain: null,
  moodDetails: [],
  photo: null,
});

const quickButton =
  'inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full text-base font-bold border transition-colors cursor-pointer';

/**
 * บันทึกอาการ: โพสต์อาการและอารมณ์ให้คนในบ้านตามดู ย้อนดูได้ตามวัน กดถูกใจและแสดงความเห็นได้
 * ลำดับตอนกด "โพสต์": เลือกอาการ -> เลือกอารมณ์ -> กรอกรายละเอียด
 */
export const JournalPage: React.FC = () => {
  const user = useMemo(currentJournalUser, []);
  const [posts, setPosts] = useState<JournalPost[]>(loadPosts);

  const [step, setStep] = useState<Step>(null);
  const [guided, setGuided] = useState(false);
  const [detailsVisited, setDetailsVisited] = useState(false);
  const [editing, setEditing] = useState<JournalPost | null>(null);
  const [draft, setDraft] = useState<PostDraft>(emptyDraft);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [deleting, setDeleting] = useState<JournalPost | null>(null);

  // รูปที่อัปโหลดระหว่างเขียนโพสต์ ใช้ล้างทิ้งเมื่อยกเลิกหรือเปลี่ยนรูป
  const uploadedIds = useRef(new Set<string>());
  const initialSnapshot = useRef('');

  const aboutOptions = useMemo(() => [SELF_LABEL, ...loadHomeData().patients.map((p) => p.name)], []);

  const commit = (next: JournalPost[]) => {
    setPosts(next);
    savePosts(next);
  };

  const updateDraft = (patch: Partial<PostDraft>) => {
    if (patch.photo) uploadedIds.current.add(patch.photo.id);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  // ----- เริ่ม/จบการเขียนโพสต์ -----
  const begin = (first: Exclude<Step, null>, guidedFlow = false) => {
    const fresh = emptyDraft();
    setEditing(null);
    setDraft(fresh);
    initialSnapshot.current = JSON.stringify(fresh);
    uploadedIds.current.clear();
    setGuided(guidedFlow);
    setDetailsVisited(first === 'details');
    setStep(first);
  };

  const beginEdit = (post: JournalPost) => {
    const fromPost: PostDraft = {
      about: post.about,
      title: post.title,
      content: post.content,
      symptoms: post.symptoms,
      moodMain: post.moodMain,
      moodDetails: post.moodDetails,
      photo: post.photo,
    };
    setEditing(post);
    setDraft(fromPost);
    initialSnapshot.current = JSON.stringify(fromPost);
    uploadedIds.current.clear();
    setGuided(false);
    setDetailsVisited(true);
    setStep('details');
  };

  /** ปิดทุกอย่างและลบรูปที่อัปโหลดไว้แต่ไม่ได้ใช้ (รูปเดิมของโพสต์ที่กำลังแก้ไขต้องเก็บไว้) */
  const finishFlow = (keepPhotoId?: string) => {
    const originalId = editing?.photo?.id;
    const toDelete = [...uploadedIds.current].filter((id) => id !== keepPhotoId && id !== originalId);
    void deleteFiles(toDelete.map((id) => ({ id, name: '', type: '', size: 0 })));
    uploadedIds.current.clear();
    setStep(null);
    setEditing(null);
    setConfirmDiscard(false);
  };

  const isDirty = JSON.stringify(draft) !== initialSnapshot.current;

  const requestCloseDetails = () => (isDirty ? setConfirmDiscard(true) : finishFlow());

  const closePicker = () => (detailsVisited ? setStep('details') : finishFlow());

  const goAfterSymptoms = () => {
    if (guided) setStep('mood');
    else {
      setDetailsVisited(true);
      setStep('details');
    }
  };

  const goToDetails = () => {
    setGuided(false);
    setDetailsVisited(true);
    setStep('details');
  };

  // ----- บันทึกโพสต์ -----
  const submit = () => {
    const now = new Date().toISOString();
    const finalPhotoId = draft.photo?.id;

    if (editing) {
      // รูปเดิมที่ถูกเปลี่ยนหรือลบออก ต้องลบจากที่เก็บด้วย
      if (editing.photo && editing.photo.id !== finalPhotoId) void deleteFiles([editing.photo]);
      commit(
        posts.map((p) =>
          p.id === editing.id
            ? { ...p, ...draft, title: draft.title.trim(), content: draft.content.trim(), editedAt: now }
            : p
        )
      );
    } else {
      commit([
        {
          id: newId(),
          authorId: user.id,
          authorName: user.name,
          ...draft,
          title: draft.title.trim(),
          content: draft.content.trim(),
          createdAt: now,
          editedAt: null,
          likes: [],
          comments: [],
        },
        ...posts,
      ]);
    }
    finishFlow(finalPhotoId);
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
    if (deleting.photo) void deleteFiles([deleting.photo]);
    commit(posts.filter((p) => p.id !== deleting.id));
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
        description="โพสต์อาการและความรู้สึกให้คนในบ้านตามดู และย้อนดูการเปลี่ยนแปลงได้ภายหลัง"
      />

      {/* กล่องเริ่มโพสต์ */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="w-12 h-12 shrink-0 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center text-lg font-bold"
          >
            {user.name.slice(0, 1)}
          </div>
          <button
            type="button"
            onClick={() => begin('details')}
            className="flex-1 min-h-[52px] px-5 rounded-full border border-slate-300 bg-slate-50 text-left text-base sm:text-lg text-slate-600 hover:bg-slate-100 cursor-text truncate"
          >
            วันนี้เป็นอย่างไรบ้าง? เล่าให้คนในบ้านฟัง
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => begin('symptoms')}
            className={`${quickButton} bg-red-50 text-red-800 border-red-200 hover:bg-red-100`}
          >
            <HeartPulse className="w-5 h-5" aria-hidden="true" />
            <span>อาการ</span>
          </button>
          <button
            type="button"
            onClick={() => begin('mood')}
            className={`${quickButton} bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100`}
          >
            <Smile className="w-5 h-5" aria-hidden="true" />
            <span>อารมณ์</span>
          </button>
          <button
            type="button"
            onClick={() => begin('details')}
            className={`${quickButton} bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100`}
          >
            <ImageIcon className="w-5 h-5" aria-hidden="true" />
            <span>รูปภาพ</span>
          </button>

          <Button type="button" onClick={() => begin('symptoms', true)} className="ml-auto w-full sm:w-auto">
            <PenLine className="w-5 h-5" aria-hidden="true" />
            <span>โพสต์</span>
          </Button>
        </div>
      </Card>

      {/* รายการโพสต์ */}
      {posts.length === 0 ? (
        <Card className="py-14 text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <NotebookPen className="w-10 h-10" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">ยังไม่มีบันทึกอาการ</h2>
          <p className="text-base text-slate-600 mt-1 max-w-md mx-auto">
            เริ่มโพสต์อาการแรก เพื่อให้คนในบ้านเห็นและช่วยตามดูอาการได้
          </p>
          <Button type="button" className="mt-6" onClick={() => begin('symptoms', true)}>
            เริ่มบันทึกอาการ
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([label, items]) => (
            <section key={label} aria-labelledby={`day-${label}`}>
              <h2 id={`day-${label}`} className="text-lg font-bold text-slate-700 mb-3">
                {label}
              </h2>
              <div className="space-y-4">
                {items.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    user={user}
                    onToggleLike={toggleLike}
                    onAddComment={addComment}
                    onDeleteComment={deleteComment}
                    onEdit={beginEdit}
                    onDelete={setDeleting}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ขั้นที่ 1: เลือกอาการ (ค้นหาด้านบน พิมพ์อาการอื่นท้ายรายการ) */}
      <OptionPickerModal
        open={step === 'symptoms'}
        onClose={closePicker}
        title="เลือกอาการที่พบ"
        options={SYMPTOMS}
        value={draft.symptoms}
        searchPlaceholder="ค้นหาอาการ เช่น ปวดหัว ไอ มีไข้"
        listHeading="อาการทั้งหมด"
        customHeading="ไม่มีอาการที่ต้องการ? พิมพ์เพิ่มเอง"
        customPlaceholder="พิมพ์อาการอื่น ๆ ที่ไม่มีในรายการ"
        saveLabel={guided ? 'ถัดไป' : 'บันทึก'}
        onSkip={guided ? goAfterSymptoms : undefined}
        skipLabel="ข้าม"
        onSave={(symptoms) => {
          updateDraft({ symptoms });
          goAfterSymptoms();
        }}
      />

      {/* ขั้นที่ 2: เลือกอารมณ์ (กลุ่มใหญ่ แล้วแตกเป็นความรู้สึกเฉพาะ) */}
      <MoodPickerModal
        open={step === 'mood'}
        onClose={closePicker}
        main={draft.moodMain}
        details={draft.moodDetails}
        onSkip={guided ? goToDetails : undefined}
        onSave={(main: MoodKey | null, details) => {
          updateDraft({ moodMain: main, moodDetails: details });
          goToDetails();
        }}
      />

      {/* ขั้นที่ 3: รายละเอียดโพสต์ */}
      <PostComposerModal
        open={step === 'details'}
        mode={editing ? 'edit' : 'new'}
        draft={draft}
        aboutOptions={aboutOptions}
        onChange={updateDraft}
        onOpenSymptoms={() => setStep('symptoms')}
        onOpenMood={() => setStep('mood')}
        onSubmit={submit}
        onClose={requestCloseDetails}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="ทิ้งโพสต์ที่ยังไม่ได้บันทึก?"
        message="สิ่งที่คุณเขียนหรือเลือกไว้จะหายไป"
        confirmLabel="ทิ้งโพสต์"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => finishFlow()}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="ลบโพสต์นี้?"
        message="โพสต์ รูป และความเห็นทั้งหมดจะถูกลบ ย้อนกลับไม่ได้"
        confirmLabel="ลบโพสต์"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
