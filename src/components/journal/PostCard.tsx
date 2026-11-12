import React, { useState } from 'react';
import { Gauge, HeartPulse, LineChart, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { loadSettings } from '../../lib/settings';
import { AttachmentImage } from '../ui/AttachmentImage';
import { MoodBadge } from './MoodPickerModal';
import { cn } from '../../lib/cn';
import { formatDateTime, SELF_LABEL, type JournalPost, type JournalUser } from '../../lib/journal';
import { SYMPTOM_DESCRIPTIONS } from '../../data/symptomDescriptions';
import { hasVitals, memberIdForAbout, vitalChips } from '../../lib/dailyRecord';

interface PostCardProps {
  post: JournalPost;
  user: JournalUser;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onEdit: (post: JournalPost) => void;
  onDelete: (post: JournalPost) => void;
}

const MOOD_ACCENT: Record<string, string> = {
  great: 'border-l-emerald-500',
  complicated: 'border-l-amber-500',
  down: 'border-l-red-500',
};

const iconButton =
  'inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-600 hover:bg-slate-100 cursor-pointer';

export const PostCard: React.FC<PostCardProps> = ({
  post,
  user,
  onToggleLike,
  onAddComment,
  onDeleteComment,
  onEdit,
  onDelete,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');

  const isMine = post.authorId === user.id;

  const authorPhoto = isMine
    ? loadSettings().profile.photo
    : loadSettings().members.find((m) => m.id === post.authorId || m.name === post.authorName)?.photo;
  const liked = post.likes.includes(user.id);
  const vitals = hasVitals(post.vitals) ? post.vitals : null;
  const progressMemberId = vitals ? memberIdForAbout(post.about, loadSettings().members, SELF_LABEL) : null;
  const commentsId = `comments-${post.id}`;

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAddComment(post.id, text);
    setDraft('');
  };

  return (
    <article
      aria-label={post.title || `โพสต์ของ ${post.authorName}`}
      className={cn(
        'bg-white border border-slate-200 border-l-4 rounded-2xl p-5 sm:p-6',
        post.moodMain ? MOOD_ACCENT[post.moodMain] : 'border-l-slate-300'
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar src={authorPhoto} name={post.authorName} className="w-11 h-11 text-base shadow-xs" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900 break-words">{post.authorName}</p>
          {post.about && post.about !== SELF_LABEL && post.about !== 'ตัวฉันเอง' && post.about !== post.authorName && (
            <p className="text-sm text-slate-600">
              บันทึกของ <strong className="font-semibold">{post.about}</strong>
            </p>
          )}
          <p className="text-sm text-slate-500">
            <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
            {post.editedAt && <span> · แก้ไขเมื่อ {formatDateTime(post.editedAt)}</span>}
          </p>
        </div>
        {isMine && (
          <div className="flex shrink-0 -mr-2 -mt-1">
            <button type="button" onClick={() => onEdit(post)} aria-label="แก้ไขโพสต์" className={iconButton}>
              <Pencil className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(post)}
              aria-label="ลบโพสต์"
              className={cn(iconButton, 'hover:bg-red-50 hover:text-red-700')}
            >
              <Trash2 className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      <div className="mt-4 space-y-4">
        {post.title && <h3 className="text-xl font-bold text-slate-900 break-words">{post.title}</h3>}

        {post.content && (
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
        )}

        {post.symptoms.length > 0 && (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-2">
              <HeartPulse className="w-4 h-4 text-red-600" aria-hidden="true" />
              อาการที่พบ
            </p>
            <ul className="flex flex-wrap gap-2">
              {post.symptoms.map((item) => (
                <li
                  key={item}
                  title={SYMPTOM_DESCRIPTIONS[item]}
                  className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-base font-semibold text-red-900 cursor-help"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {vitals && (
          <div className="rounded-2xl border border-sky-200 bg-sky-soft/60 p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <Gauge className="h-4 w-4 text-sky-700" aria-hidden="true" />
                ค่าสุขภาพที่วัดได้
                {vitals.at && vitals.at.slice(0, 16) !== post.createdAt.slice(0, 16) && (
                  <span className="font-normal text-slate-600">· วัดเมื่อ {formatDateTime(vitals.at)}</span>
                )}
              </p>
              {progressMemberId && (
                <Link
                  to={`/members/${progressMemberId}`}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full px-3 text-sm font-bold text-sky-800 hover:bg-white"
                >
                  <LineChart className="h-4 w-4" aria-hidden="true" />
                  ดูพัฒนาการ
                </Link>
              )}
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {vitalChips(vitals).map((c) => (
                <li key={c.key} className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-sky-100">
                  <span className="block text-xs font-semibold text-slate-600">{c.label}</span>
                  <span className="block text-base font-extrabold tabular-nums text-slate-900 break-words">{c.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {post.moodMain && <MoodBadge main={post.moodMain} details={post.moodDetails} />}

        {post.photo && (
          <AttachmentImage
            attachment={post.photo}
            alt={post.title || `รูปประกอบโพสต์ของ ${post.authorName}`}
          />
        )}
      </div>

      <footer className="mt-5 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={liked}
            onClick={() => onToggleLike(post.id)}
            className={cn(
              'inline-flex items-center gap-2 min-h-[48px] px-4 rounded-full text-base font-semibold transition-colors cursor-pointer',
              liked ? 'bg-red-50 text-red-700' : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            <Heart className={cn('w-5 h-5', liked && 'fill-current')} aria-hidden="true" />
            <span>{liked ? 'ถูกใจแล้ว' : 'ถูกใจ'}</span>
            {post.likes.length > 0 && <span aria-label={`${post.likes.length} คน`}>{post.likes.length}</span>}
          </button>

          <button
            type="button"
            aria-expanded={showComments}
            aria-controls={commentsId}
            onClick={() => setShowComments((v) => !v)}
            className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-full text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            <span>ความเห็น</span>
            {post.comments.length > 0 && (
              <span aria-label={`${post.comments.length} ความเห็น`}>{post.comments.length}</span>
            )}
          </button>
        </div>

        {showComments && (
          <div id={commentsId} className="mt-3 space-y-3">
            {post.comments.length > 0 && (
              <ul className="space-y-3">
                {post.comments.map((comment) => (
                  <li key={comment.id} className="flex items-start gap-3">
                    <Avatar src={comment.authorId === user.id ? loadSettings().profile.photo : loadSettings().members.find((m) => m.id === comment.authorId || m.name === comment.authorName)?.photo} name={comment.authorName} className="w-9 h-9 text-sm shadow-xs" />
                    <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-2.5">
                      <p className="text-sm font-bold text-slate-800">{comment.authorName}</p>
                      <p className="text-base text-slate-800 whitespace-pre-wrap break-words">
                        {comment.text}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(comment.createdAt)}</p>
                    </div>
                    {comment.authorId === user.id && (
                      <button
                        type="button"
                        onClick={() => onDeleteComment(post.id, comment.id)}
                        aria-label="ลบความเห็น"
                        className={cn(iconButton, 'w-10 h-10 hover:text-red-700')}
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={submitComment} className="flex items-center gap-2">
              <label htmlFor={`${commentsId}-input`} className="sr-only">
                เขียนความเห็น
              </label>
              <input
                id={`${commentsId}-input`}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="เขียนความเห็นให้กำลังใจหรือสอบถามอาการ…"
                autoComplete="off"
                className="w-full min-h-[48px] px-5 rounded-full border border-slate-300 bg-white text-base text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="ส่งความเห็น"
                className="inline-flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-5 h-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        )}
      </footer>
    </article>
  );
};
