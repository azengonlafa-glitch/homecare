import { useMemo, useRef, useState } from 'react';
import { OptionPickerModal } from '../ui/OptionPickerModal';
import { ConfirmDialog } from '../settings/ConfirmDialog';
import { MoodPickerModal } from './MoodPickerModal';
import { PostComposerModal, type PostDraft } from './PostComposerModal';
import { VitalsStepModal } from '../health/VitalsStepModal';
import { useToast } from '../ui/Toast';
import { SYMPTOMS, type MoodKey } from '../../data/journalOptions';
import { SYMPTOM_DESCRIPTIONS } from '../../data/symptomDescriptions';
import { deleteFiles } from '../../lib/fileStore';
import { loadHomeData } from '../../lib/storage';
import { CURRENT_MEMBER_ID, loadSettings } from '../../lib/settings';
import { canEditMember } from '../../lib/access';
import { loadMemberRecord } from '../../lib/members';
import { SELF_LABEL, currentJournalUser, loadPosts, newId, savePosts, type JournalPost } from '../../lib/journal';
import {
  draftFromVitals,
  emptyVitalDraft,
  memberIdForAbout,
  removePostVitals,
  syncPostVitals,
  type VitalValues,
} from '../../lib/dailyRecord';

type Step = 'symptoms' | 'vitals' | 'mood' | 'details' | null;

export const emptyDraft = (about = SELF_LABEL): PostDraft => ({
  about,
  title: '',
  content: '',
  symptoms: [],
  moodMain: null,
  moodDetails: [],
  photo: null,
  vitals: emptyVitalDraft(),
});

export interface StartOptions {
  /** เริ่มที่ขั้นไหน: เลือกอาการ / อารมณ์ / หน้ารายละเอียด */
  first?: Exclude<Step, null>;
  /** ไล่ทีละขั้น อาการ -> ค่าสุขภาพ -> อารมณ์ -> รายละเอียด */
  guided?: boolean;
  /** บันทึกของใคร (ชื่อสมาชิก หรือ "ตัวฉันเอง") */
  about?: string;
}

/** ชื่อที่เลือกได้ในช่อง "บันทึกของใคร" */
function aboutChoices(): string[] {
  const members = loadSettings()
    .members.filter((m) => m.id !== CURRENT_MEMBER_ID)
    .map((m) => m.name);
  const patients = loadHomeData().patients.map((p) => p.name);
  return [SELF_LABEL, ...new Set([...members, ...patients])];
}

/**
 * บันทึกประจำวันแบบเดียวกันทั้งแอป: อาการ อารมณ์ รูป และค่าสุขภาพในโพสต์เดียว
 * ใช้ได้ทั้งหน้าบันทึกอาการและหน้าสมาชิก (ค่าสุขภาพถูกส่งไปเป็นประวัติของสมาชิกคนนั้นด้วย)
 */
export function useDailyRecordComposer() {
  const toast = useToast();
  const user = useMemo(currentJournalUser, []);

  const [step, setStep] = useState<Step>(null);
  const [guided, setGuided] = useState(false);
  const [detailsVisited, setDetailsVisited] = useState(false);
  const [editing, setEditing] = useState<JournalPost | null>(null);
  const [draft, setDraft] = useState<PostDraft>(emptyDraft);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [options, setOptions] = useState<string[]>(aboutChoices);

  // รูปที่อัปโหลดระหว่างเขียน ใช้ล้างทิ้งเมื่อยกเลิกหรือเปลี่ยนรูป
  const uploadedIds = useRef(new Set<string>());
  const initialSnapshot = useRef('');

  const updateDraft = (patch: Partial<PostDraft>) => {
    if (patch.photo) uploadedIds.current.add(patch.photo.id);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const start = ({ first = 'details', guided: guidedFlow = false, about }: StartOptions = {}) => {
    const choices = aboutChoices();
    const fresh = emptyDraft(about && choices.includes(about) ? about : SELF_LABEL);
    setOptions(choices);
    setEditing(null);
    setDraft(fresh);
    initialSnapshot.current = JSON.stringify(fresh);
    uploadedIds.current.clear();
    setGuided(guidedFlow);
    setDetailsVisited(first === 'details');
    setStep(first);
  };

  const startEdit = (post: JournalPost) => {
    const fromPost: PostDraft = {
      about: post.about,
      title: post.title,
      content: post.content,
      symptoms: post.symptoms,
      moodMain: post.moodMain,
      moodDetails: post.moodDetails,
      photo: post.photo,
      vitals: draftFromVitals(post.vitals),
    };
    setOptions(aboutChoices());
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
    if (guided) setStep('vitals');
    else {
      setDetailsVisited(true);
      setStep('details');
    }
  };
  const goAfterVitals = () => {
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

  /** บันทึกค่าสุขภาพให้คนนี้ได้ไหม (ต้องเป็นสมาชิกในบ้าน และมีสิทธิ์แก้ไขข้อมูลของเขา) */
  const vitalsBlockedFor = (about: string): string | null => {
    const id = memberIdForAbout(about, loadSettings().members, SELF_LABEL);
    if (!id) return `${about} ยังไม่ได้เป็นสมาชิกในบ้าน จึงยังบันทึกค่าสุขภาพให้ไม่ได้ (บันทึกอาการได้ตามปกติ)`;
    if (!canEditMember(loadMemberRecord(id), CURRENT_MEMBER_ID)) {
      return `ยังไม่มีสิทธิ์บันทึกค่าสุขภาพของ ${about} ขออนุญาตแก้ไขข้อมูลได้ที่หน้าสมาชิก`;
    }
    return null;
  };

  const submit = (vitals: VitalValues | null) => {
    const now = new Date().toISOString();
    const finalPhotoId = draft.photo?.id;
    const posts = loadPosts();
    const fields = {
      about: draft.about,
      symptoms: draft.symptoms,
      moodMain: draft.moodMain,
      moodDetails: draft.moodDetails,
      photo: draft.photo,
    };
    const members = loadSettings().members;
    const memberId = memberIdForAbout(draft.about, members, SELF_LABEL);

    let saved: JournalPost;
    if (editing) {
      if (editing.photo && editing.photo.id !== finalPhotoId) void deleteFiles([editing.photo]);
      saved = {
        ...editing,
        ...fields,
        vitals,
        title: draft.title.trim(),
        content: draft.content.trim(),
        editedAt: now,
      };
      savePosts(posts.map((p) => (p.id === editing.id ? saved : p)));
      // เปลี่ยนเจ้าของบันทึก: ย้ายค่าสุขภาพออกจากคนเดิม
      const oldId = memberIdForAbout(editing.about, members, SELF_LABEL);
      if (oldId && oldId !== memberId) removePostVitals(editing.id, [oldId]);
    } else {
      saved = {
        id: newId(),
        authorId: user.id,
        authorName: user.name,
        ...fields,
        vitals,
        title: draft.title.trim(),
        content: draft.content.trim(),
        createdAt: now,
        editedAt: null,
        likes: [],
        comments: [],
      };
      savePosts([saved, ...posts]);
    }
    if (memberId) syncPostVitals(memberId, saved, vitals);

    toast.show(vitals ? 'บันทึกแล้ว ค่าสุขภาพขึ้นกราฟพัฒนาการแล้ว' : 'บันทึกแล้ว');
    finishFlow(finalPhotoId);
  };

  const element = (
    <>
      {/* ขั้นที่ 1: เลือกอาการ */}
      <OptionPickerModal
        open={step === 'symptoms'}
        onClose={closePicker}
        title="เลือกอาการที่พบ"
        options={SYMPTOMS}
        descriptions={SYMPTOM_DESCRIPTIONS}
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

      {/* ขั้นที่ 2: ค่าสุขภาพ (เลือกหมวด แล้วกรอกเฉพาะที่วัดได้) */}
      <VitalsStepModal
        open={step === 'vitals'}
        forName={draft.about === SELF_LABEL ? undefined : draft.about}
        value={draft.vitals}
        onClose={closePicker}
        onSkip={guided ? goAfterVitals : undefined}
        saveLabel={guided ? 'ถัดไป' : 'บันทึกค่า'}
        onSave={(vitals) => {
          updateDraft({ vitals });
          goAfterVitals();
        }}
      />

      {/* ขั้นที่ 3: เลือกอารมณ์ */}
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

      {/* ขั้นที่ 4: รายละเอียด */}
      <PostComposerModal
        open={step === 'details'}
        mode={editing ? 'edit' : 'new'}
        draft={draft}
        aboutOptions={options}
        onChange={updateDraft}
        onOpenSymptoms={() => setStep('symptoms')}
        onOpenMood={() => setStep('mood')}
        onOpenVitals={() => setStep('vitals')}
        onSubmit={submit}
        onClose={requestCloseDetails}
        vitalsBlockedFor={vitalsBlockedFor}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="ทิ้งบันทึกที่ยังไม่ได้บันทึก?"
        message="สิ่งที่คุณเขียนหรือเลือกไว้จะหายไป"
        confirmLabel="ทิ้งบันทึก"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => finishFlow()}
      />
    </>
  );

  return { start, startEdit, element };
}

/** ลบบันทึก: รูป และค่าสุขภาพที่ส่งไปเป็นประวัติของสมาชิก */
export function deleteDailyRecord(post: JournalPost): void {
  if (post.photo) void deleteFiles([post.photo]);
  savePosts(loadPosts().filter((p) => p.id !== post.id));
  const id = memberIdForAbout(post.about, loadSettings().members, SELF_LABEL);
  if (id) removePostVitals(post.id, [id]);
}
