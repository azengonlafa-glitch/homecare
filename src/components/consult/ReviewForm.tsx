import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { consultErrorText, getBackend } from '../../consult/backend';
import type { Review } from '../../consult/types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { TextAreaField } from '../ui/TextAreaField';
import { useToast } from '../ui/Toast';
import { StarInput, StarsDisplay } from './Stars';

const MAX = 500;

/** ให้คะแนนและเขียนความคิดเห็นหลังปรึกษาจบ แสดงแบบไม่ระบุตัวตน แก้ไขภายหลังได้ */
export const ReviewForm: React.FC<{ sessionId: string; providerName: string; existing: Review | null; onSaved: () => void }> = ({ sessionId, providerName, existing, onSaved }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (stars < 1) {
      setError('กรุณาเลือกจำนวนดาวก่อนส่ง');
      return;
    }
    setBusy(true);
    try {
      const backend = await getBackend();
      await backend.submitReview(sessionId, stars, comment);
      toast.show(existing ? 'แก้ไขรีวิวแล้ว' : 'ขอบคุณสำหรับรีวิว');
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.show(consultErrorText(err), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (existing && !editing) {
    return (
      <Card className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">รีวิวของคุณ</h2>
          <Button variant="neutral" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4" aria-hidden="true" />
            แก้ไข
          </Button>
        </div>
        <StarsDisplay value={existing.stars} />
        {existing.comment && <p className="text-base text-slate-800 whitespace-pre-wrap break-words">{existing.comment}</p>}
        <p className="text-sm text-slate-600">ร้านและผู้ใช้อื่นเห็นรีวิวนี้แบบไม่ระบุชื่อ</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">ให้คะแนน {providerName}</h2>
        <p className="text-sm sm:text-base text-slate-600">รีวิวของคุณช่วยให้คนอื่นเลือกผู้ให้บริการได้ง่ายขึ้น แสดงแบบไม่ระบุชื่อ และไม่เปิดเผยข้อมูลสุขภาพของคุณ</p>
      </div>
      <StarInput
        value={stars}
        onChange={(v) => {
          setStars(v);
          setError('');
        }}
      />
      <TextAreaField id={`review-${sessionId}`} label="ความคิดเห็น" labelSuffix="(ไม่บังคับ)" hint="เล่าประสบการณ์ เช่น ตอบเร็ว อธิบายเข้าใจง่าย อย่าใส่ชื่อ เบอร์โทร หรืออาการของคุณ" rows={3} maxLength={MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && (
        <p role="alert" className="text-base font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {existing && (
          <Button variant="neutral" size="sm" onClick={() => setEditing(false)}>
            ยกเลิก
          </Button>
        )}
        <Button size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? 'กำลังส่ง...' : existing ? 'บันทึกการแก้ไข' : 'ส่งรีวิว'}
        </Button>
      </div>
    </Card>
  );
};
