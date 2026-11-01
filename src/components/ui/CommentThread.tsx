import React, { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { formatDateTime } from '../../lib/journal';
import { cn } from '../../lib/cn';

export interface ThreadComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface CommentThreadProps {
  /** ใช้ต่อท้าย id ของส่วนที่ย่อ/ขยาย ต้องไม่ซ้ำกันในหน้า */
  id: string;
  comments: ThreadComment[];
  currentUserId: string;
  onAdd: (text: string) => void;
  onDelete: (commentId: string) => void;
}

/** ความเห็นแบบพับเก็บได้: ปุ่มเปิด + รายการความเห็น + ช่องเขียนความเห็นใหม่ */
export const CommentThread: React.FC<CommentThreadProps> = ({
  id,
  comments,
  currentUserId,
  onAdd,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const panelId = `thread-${id}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 min-h-[48px] px-3 -ml-3 rounded-full text-base font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
      >
        <MessageCircle className="w-5 h-5" aria-hidden="true" />
        <span>ความเห็น</span>
        {comments.length > 0 && <span aria-label={`${comments.length} ความเห็น`}>({comments.length})</span>}
      </button>

      {open && (
        <div id={panelId} className="mt-2 space-y-3">
          {comments.length > 0 && (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="flex items-start gap-2">
                  <div
                    aria-hidden="true"
                    className="w-9 h-9 shrink-0 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold"
                  >
                    {comment.authorName.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-2.5">
                    <p className="text-sm font-bold text-slate-800">{comment.authorName}</p>
                    <p className="text-base text-slate-800 whitespace-pre-wrap break-words">{comment.text}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(comment.createdAt)}</p>
                  </div>
                  {comment.authorId === currentUserId && (
                    <button
                      type="button"
                      onClick={() => onDelete(comment.id)}
                      aria-label="ลบความเห็น"
                      className={cn(
                        'inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-slate-500',
                        'hover:bg-red-50 hover:text-red-700 cursor-pointer'
                      )}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              เขียนความเห็น
            </label>
            <input
              id={`${panelId}-input`}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="เขียนความเห็น…"
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
    </div>
  );
};
