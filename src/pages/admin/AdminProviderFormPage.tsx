import React, { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, Trash2 } from 'lucide-react';
import { ErrorCard, LoadingCard } from '../../components/consult/ConsultUI';
import { Avatar } from '../../components/ui/Avatar';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CheckboxField } from '../../components/ui/CheckboxField';
import { Chip, FieldGroup } from '../../components/ui/ChoiceChips';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { useToast } from '../../components/ui/Toast';
import { consultErrorText, getBackend } from '../../consult/backend';
import { isChannelAvailable } from '../../consult/calls';
import { EMAIL_PATTERN, PHONE_PATTERN, digitsOnly, isHttpsUrl, isSafePhoto } from '../../consult/format';
import { useConsultData } from '../../consult/hooks';
import { CHANNEL_LABEL } from '../../consult/options';
import type { Category, Channel, Provider, ProviderInput } from '../../consult/types';
import { THAI_PROVINCES } from '../../data/addressOptions';
import { resizeToAvatar } from '../../lib/photo';

const EXTRA_CHANNELS = (['voice', 'video', 'appointment'] as Channel[]).filter(isChannelAvailable);
const PROVINCE_OPTIONS = [{ value: '', label: 'เลือกจังหวัด' }, ...THAI_PROVINCES.map((name) => ({ value: name, label: name }))];
const ABOUT_MAX = 2000;
const MAX_PHOTO_CHARS = 150_000;

const emptyInput = (kind: string): ProviderInput => ({
  kind,
  displayName: '',
  photoUrl: '',
  specialties: [],
  orgName: '',
  licenseNo: '',
  about: '',
  address: '',
  province: '',
  mapUrl: '',
  phone: '',
  lineId: '',
  contactEmail: '',
  website: '',
  hours: '',
  channels: ['chat'],
});

const toInput = (p: Provider): ProviderInput => ({
  id: p.id,
  kind: p.kind,
  displayName: p.displayName,
  photoUrl: p.photoUrl,
  specialties: p.specialties,
  orgName: p.orgName,
  licenseNo: p.licenseNo,
  about: p.about,
  address: p.address,
  province: p.province,
  mapUrl: p.mapUrl,
  phone: p.phone,
  lineId: p.lineId,
  contactEmail: p.contactEmail,
  website: p.website,
  hours: p.hours,
  channels: p.channels,
});

const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="mb-4">
    <h2 className="text-lg font-bold text-slate-900">{children}</h2>
    {hint && <p className="mt-0.5 text-sm sm:text-base text-slate-600">{hint}</p>}
  </div>
);

const ProviderForm: React.FC<{ initial: ProviderInput | null; categories: Category[] }> = ({ initial, categories }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProviderInput>(initial ?? emptyInput(categories[0]?.id ?? 'pharmacist'));
  /** เลือก "อื่นๆ" แล้วพิมพ์ชื่อหมวดใหม่ ระบบสร้างหมวดให้ตอนบันทึก */
  const [otherKind, setOtherKind] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [specialties, setSpecialties] = useState((initial?.specialties ?? []).join(', '));
  const [verified, setVerified] = useState(!!initial?.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const editing = !!initial?.id;
  const backTo = editing ? `/admin/providers/${initial!.id}` : '/admin';

  const set = (patch: Partial<ProviderInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    try {
      const photo = await resizeToAvatar(file);
      if (photo.length > MAX_PHOTO_CHARS) throw new Error('too-large');
      set({ photoUrl: photo });
    } catch {
      setPhotoError('ใช้ไฟล์นี้ไม่ได้ กรุณาเลือกรูปภาพ (JPG, PNG) อีกครั้ง');
    }
  };

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (otherKind && (newCategory.trim().length < 2 || newCategory.trim().length > 40)) found['pv-category-new'] = 'ชื่อหมวดหมู่ต้องยาว 2-40 ตัวอักษร';
    if (!form.displayName.trim()) found['pv-name'] = 'กรุณากรอกชื่อที่แสดง';
    if (!form.orgName.trim()) found['pv-org'] = 'กรุณากรอกชื่อร้านยาหรือสถานพยาบาล';
    if (!form.licenseNo.trim()) found['pv-license'] = 'กรุณากรอกเลขใบอนุญาต';
    if (!form.phone.trim()) found['pv-phone'] = 'กรุณากรอกเบอร์โทรของร้าน';
    else if (!PHONE_PATTERN.test(digitsOnly(form.phone))) found['pv-phone'] = 'เบอร์ต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0';
    if (form.contactEmail.trim() && !EMAIL_PATTERN.test(form.contactEmail.trim())) found['pv-email'] = 'กรุณากรอกอีเมลให้ถูกต้อง';
    if (form.website.trim() && !isHttpsUrl(form.website)) found['pv-website'] = 'เว็บไซต์ต้องขึ้นต้นด้วย https://';
    if (form.mapUrl.trim() && !isHttpsUrl(form.mapUrl)) found['pv-map'] = 'ลิงก์แผนที่ต้องขึ้นต้นด้วย https://';
    if (!isSafePhoto(form.photoUrl)) found['pv-photo'] = 'รูปไม่ถูกต้อง กรุณาเลือกรูปใหม่';
    if (!verified) found['pv-verified'] = 'กรุณายืนยันว่าตรวจใบอนุญาตแล้ว';
    return found;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    try {
      const backend = await getBackend();
      const kind = otherKind ? await backend.addCategory(newCategory.trim()) : form.kind;
      const id = await backend.saveProvider({
        ...form,
        kind,
        displayName: form.displayName.trim(),
        orgName: form.orgName.trim(),
        licenseNo: form.licenseNo.trim(),
        about: form.about.trim(),
        address: form.address.trim(),
        mapUrl: form.mapUrl.trim(),
        phone: digitsOnly(form.phone),
        lineId: form.lineId.trim(),
        contactEmail: form.contactEmail.trim(),
        website: form.website.trim(),
        hours: form.hours.trim(),
        specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean),
        channels: ['chat', ...form.channels.filter((c) => c !== 'chat')],
      });
      toast.show(editing ? 'บันทึกแล้ว' : 'เพิ่มผู้ให้บริการแล้ว');
      navigate(`/admin/providers/${id}`, { replace: true });
    } catch (err) {
      console.error('Save provider failed', err);
      toast.show(consultErrorText(err), { tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={(e) => void save(e)} className="space-y-5">
      <Link to={backTo} className="inline-flex min-h-[48px] items-center gap-1.5 text-base font-bold text-purple-800 hover:underline">
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        {editing ? 'กลับไปรายละเอียดร้าน' : 'ผู้ให้บริการทั้งหมด'}
      </Link>
      <PageHeader title={editing ? `แก้ไข ${initial!.displayName}` : 'เพิ่มผู้ให้บริการ'} description="ข้อมูลนี้ผู้ใช้จะเห็นในการ์ดของร้าน กรอกให้ครบเพื่อให้ผู้ใช้ไว้ใจและติดต่อได้ง่าย" />

      <Card className="p-5 sm:p-6">
        <SectionTitle>รูปโปรไฟล์</SectionTitle>
        <div className="flex items-center gap-4">
          <Avatar src={form.photoUrl} name={form.displayName || 'ร'} className="h-24 w-24 text-4xl shadow-xs ring-2 ring-white" />
          <div className="min-w-0">
            <input ref={fileRef} id="pv-photo-input" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="เลือกไฟล์รูปโปรไฟล์" onChange={(e) => void pickPhoto(e)} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="soft" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="w-5 h-5" aria-hidden="true" />
                {form.photoUrl ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
              </Button>
              {form.photoUrl && (
                <Button type="button" variant="neutral" size="sm" onClick={() => set({ photoUrl: '' })}>
                  <Trash2 className="w-5 h-5" aria-hidden="true" />
                  ลบรูป
                </Button>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600">รูปหน้าตรงหรือโลโก้ร้าน ระบบจะตัดเป็นสี่เหลี่ยมให้อัตโนมัติ</p>
            {(photoError || errors['pv-photo']) && (
              <p id="pv-photo" tabIndex={-1} role="alert" className="mt-2 text-base font-semibold text-red-700">
                {photoError || errors['pv-photo']}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionTitle>ข้อมูลทั่วไป</SectionTitle>
        <FieldGroup id="pv-category" label="หมวดหมู่" required hint="ผู้ใช้เห็นร้านแยกตามหมวดหมู่ ถ้าไม่มีหมวดที่ต้องการ เลือก “อื่นๆ” แล้วพิมพ์ชื่อหมวดใหม่ได้">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.id}
                selected={!otherKind && form.kind === c.id}
                onClick={() => {
                  setOtherKind(false);
                  set({ kind: c.id });
                }}
              >
                {c.label}
              </Chip>
            ))}
            <Chip
              selected={otherKind}
              onClick={() => {
                setOtherKind(true);
                setErrors({});
              }}
            >
              อื่นๆ
            </Chip>
          </div>
        </FieldGroup>
        {otherKind && (
          <TextField id="pv-category-new" label="ชื่อหมวดหมู่ใหม่" labelSuffix="(จำเป็น)" hint="เช่น ทันตกรรม กายภาพบำบัด แพทย์แผนไทย หมวดนี้จะเลือกใช้กับร้านอื่นได้ด้วย" maxLength={40} value={newCategory} error={errors['pv-category-new']} onChange={(e) => { setNewCategory(e.target.value); setErrors({}); }} />
        )}
        <TextField id="pv-name" label="ชื่อที่แสดง" labelSuffix="(จำเป็น)" hint="เช่น ภก. สมชาย ใจดี หรือชื่อคลินิก" value={form.displayName} error={errors['pv-name']} onChange={(e) => set({ displayName: e.target.value })} />
        <TextField id="pv-org" label="ชื่อร้านยาหรือสถานพยาบาล" labelSuffix="(จำเป็น)" value={form.orgName} error={errors['pv-org']} onChange={(e) => set({ orgName: e.target.value })} />
        <TextField id="pv-license" label="เลขใบอนุญาต" labelSuffix="(จำเป็น)" hint="ใบอนุญาตประกอบวิชาชีพหรือใบอนุญาตสถานพยาบาล" value={form.licenseNo} error={errors['pv-license']} onChange={(e) => set({ licenseNo: e.target.value })} />
        <TextField id="pv-specialties" label="ความเชี่ยวชาญ" labelSuffix="(ไม่บังคับ)" hint="คั่นด้วยจุลภาค เช่น โรคเรื้อรัง, ผู้สูงอายุ, ยาเด็ก" value={specialties} onChange={(e) => setSpecialties(e.target.value)} />
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle hint="เล่าสั้น ๆ ว่าร้านให้บริการอะไร ประสบการณ์ และจุดเด่น">แนะนำตัว</SectionTitle>
        <TextAreaField id="pv-about" label="คำอธิบายผู้ให้บริการ" labelSuffix="(ไม่บังคับ)" rows={6} maxLength={ABOUT_MAX} value={form.about} onChange={(e) => set({ about: e.target.value })} />
        <p className="mt-2 text-right text-base font-semibold text-slate-600" aria-label={`พิมพ์แล้ว ${form.about.length} จาก ${ABOUT_MAX} ตัวอักษร`}>
          {form.about.length}/{ABOUT_MAX}
        </p>
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionTitle>ที่ตั้ง</SectionTitle>
        <TextAreaField id="pv-address" label="ที่อยู่" labelSuffix="(ไม่บังคับ)" hint="เลขที่ ถนน ตำบล อำเภอ" rows={3} maxLength={500} value={form.address} onChange={(e) => set({ address: e.target.value })} />
        <NativeSelect id="pv-province" label="จังหวัด" labelSuffix="(ไม่บังคับ)" options={PROVINCE_OPTIONS} value={form.province} onChange={(v) => set({ province: v })} />
        <TextField id="pv-map" type="url" inputMode="url" label="ลิงก์แผนที่" labelSuffix="(ไม่บังคับ)" hint="เปิด Google Maps กดแชร์แล้วคัดลอกลิงก์มาวาง" placeholder="https://maps.google.com/..." value={form.mapUrl} error={errors['pv-map']} onChange={(e) => set({ mapUrl: e.target.value })} />
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionTitle hint="ผู้ใช้เห็นช่องทางเหล่านี้ในการ์ดของร้าน ส่วนการคุยและวิดีโอคอลทำในแอปได้เลย">ช่องทางติดต่อ</SectionTitle>
        <TextField id="pv-phone" type="tel" inputMode="tel" label="เบอร์โทรของร้าน" labelSuffix="(จำเป็น)" placeholder="02-xxx-xxxx หรือ 08x-xxx-xxxx" value={form.phone} error={errors['pv-phone']} onChange={(e) => set({ phone: e.target.value })} />
        <TextField id="pv-line" label="LINE ID" labelSuffix="(ไม่บังคับ)" placeholder="@ชื่อร้าน" value={form.lineId} maxLength={60} onChange={(e) => set({ lineId: e.target.value })} />
        <TextField id="pv-email" type="email" label="อีเมลติดต่อ" labelSuffix="(ไม่บังคับ)" value={form.contactEmail} error={errors['pv-email']} onChange={(e) => set({ contactEmail: e.target.value })} />
        <TextField id="pv-website" type="url" inputMode="url" label="เว็บไซต์" labelSuffix="(ไม่บังคับ)" placeholder="https://" value={form.website} error={errors['pv-website']} onChange={(e) => set({ website: e.target.value })} />
      </Card>

      <Card className="space-y-5 p-5 sm:p-6">
        <SectionTitle>เวลาทำการและช่องทางในแอป</SectionTitle>
        <TextField id="pv-hours" label="เวลาทำการ" labelSuffix="(ไม่บังคับ)" placeholder="เช่น ทุกวัน 09:00-20:00" value={form.hours} onChange={(e) => set({ hours: e.target.value })} />
        {EXTRA_CHANNELS.length > 0 && (
          <FieldGroup id="pv-channels" label="ช่องทางในแอปที่รับเพิ่ม" hint="รับข้อความได้เสมอ ผู้ใช้สลับระหว่างช่องทางได้เองในห้องสนทนา">
            <div className="flex flex-wrap gap-2">
              {EXTRA_CHANNELS.map((c) => (
                <Chip key={c} selected={form.channels.includes(c)} onClick={() => set({ channels: form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c] })}>
                  {CHANNEL_LABEL[c]}
                </Chip>
              ))}
            </div>
          </FieldGroup>
        )}
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <CheckboxField id="pv-verified" boxed checked={verified} error={errors['pv-verified']} onChange={(v) => { setVerified(v); setErrors({}); }}>
          ตรวจใบอนุญาตประกอบวิชาชีพของผู้ให้บริการรายนี้แล้ว
        </CheckboxField>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link to={backTo} className={buttonClass('neutral', 'md', true, 'sm:flex-1')}>
            ยกเลิก
          </Link>
          <Button type="submit" className="sm:flex-1" fullWidth disabled={busy}>
            {busy && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </Card>
    </form>
  );
};

/** เพิ่มหรือแก้ไขผู้ให้บริการ (มี id ในเส้นทาง = แก้ไข) */
export const AdminProviderFormPage: React.FC = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useConsultData(
    async (b) => {
      const [providers, categories] = await Promise.all([id ? b.listAllProviders() : Promise.resolve<Provider[]>([]), b.listCategories()]);
      return { providers, categories };
    },
    [id]
  );
  if (loading && !data) return <LoadingCard />;
  if (error && !data) return <ErrorCard message={error} onRetry={reload} />;
  if (!data) return <LoadingCard />;
  if (!id) return <ProviderForm initial={null} categories={data.categories} />;
  const provider = data.providers.find((p) => p.id === id);
  if (!provider) return <ErrorCard message="ไม่พบผู้ให้บริการนี้ อาจถูกลบไปแล้ว" />;
  return <ProviderForm key={provider.id} initial={toInput(provider)} categories={data.categories} />;
};
