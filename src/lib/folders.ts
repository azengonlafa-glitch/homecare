import { useEffect, useState } from 'react';
import { queueSync } from '../cloud/queue';
import type { Attachment } from './onboarding';

/**
 * โฟลเดอร์เอกสารทางการแพทย์ของผู้ใช้ เก็บรายละเอียด (ชื่อโฟลเดอร์ ชนิดเอกสาร วันที่ โน้ต) ใน localStorage แล้วซิงก์ผ่าน user_docs
 * ส่วนตัวไฟล์อยู่ในที่เก็บไฟล์เดิมของแอป (lib/fileStore) โฟลเดอร์เป็นของบัญชีนี้ ไม่แสดงให้คนในบ้านเห็นในแอป
 * ฟังก์ชันที่ลงท้าย In ไม่แตะที่เก็บข้อมูลเลย ทดสอบได้ตรง ๆ
 */

export const FOLDERS_KEY = 'growa_folders_v1';
export const FOLDERS_CHANGED_EVENT = 'growa-folders-changed';

export const MAX_FOLDERS = 30;
export const MAX_DOCS_PER_FOLDER = 100;
export const MAX_NAME = 40;
export const MAX_TITLE = 80;
export const MAX_NOTE = 300;

export type FolderColor = 'butter' | 'pink' | 'lavender' | 'mint' | 'sky' | 'coral';

export const FOLDER_COLORS: { id: FolderColor; label: string; back: string; front: string; ring: string }[] = [
  { id: 'butter', label: 'เหลือง', back: '#FFC93C', front: '#FFE08A', ring: '#FFC93C' },
  { id: 'pink', label: 'ชมพู', back: '#F98FB0', front: '#FFC2D4', ring: '#F98FB0' },
  { id: 'lavender', label: 'ม่วงอ่อน', back: '#918CF2', front: '#C4BFFF', ring: '#918CF2' },
  { id: 'mint', label: 'เขียวมิ้นต์', back: '#55D0B6', front: '#8FEBD6', ring: '#55D0B6' },
  { id: 'sky', label: 'ฟ้า', back: '#669FF5', front: '#A3CFFF', ring: '#669FF5' },
  { id: 'coral', label: 'ส้มอ่อน', back: '#F97C6E', front: '#FFA998', ring: '#F97C6E' },
];

export const colorOf = (id: string) => FOLDER_COLORS.find((c) => c.id === id) ?? FOLDER_COLORS[0];

export type DocKind = 'result' | 'prescription' | 'certificate' | 'image' | 'scan' | 'other';

export const DOC_KINDS: { id: DocKind; label: string }[] = [
  { id: 'result', label: 'ผลตรวจ' },
  { id: 'prescription', label: 'ใบสั่งยา' },
  { id: 'certificate', label: 'ใบรับรองแพทย์/ใบนัด' },
  { id: 'image', label: 'รูปอาการ' },
  { id: 'scan', label: 'ภาพสแกน/เอกซเรย์' },
  { id: 'other', label: 'อื่นๆ' },
];

export const kindLabel = (id: string) => DOC_KINDS.find((k) => k.id === id)?.label ?? 'อื่นๆ';

/** ชื่อโฟลเดอร์ที่แนะนำให้สร้างทันทีตอนยังไม่มีโฟลเดอร์ */
export const STARTER_FOLDERS: { name: string; color: FolderColor }[] = [
  { name: 'ผลตรวจเลือด', color: 'coral' },
  { name: 'ใบสั่งยา', color: 'butter' },
  { name: 'ใบรับรองแพทย์', color: 'sky' },
  { name: 'รูปอาการ', color: 'pink' },
];

export interface FolderDoc {
  id: string;
  /** ไฟล์จริงอยู่ที่ lib/fileStore ตามรหัสนี้ */
  attachment: Attachment;
  title: string;
  kind: DocKind;
  /** วันที่ของเอกสาร YYYY-MM-DD ว่างได้ */
  docDate: string;
  note: string;
  addedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  /** เกี่ยวกับใคร เช่น คุณแม่ ว่างได้ */
  about: string;
  color: FolderColor;
  createdAt: string;
  updatedAt: string;
  docs: FolderDoc[];
}

export interface FoldersState {
  folders: Folder[];
}

export const emptyFolders = (): FoldersState => ({ folders: [] });

const newId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------- ตรวจข้อมูล ----------

export function validateFolderName(name: string, state: FoldersState, ignoreId?: string): string | null {
  const clean = name.trim();
  if (!clean) return 'กรุณาตั้งชื่อโฟลเดอร์';
  if (clean.length > MAX_NAME) return `ชื่อโฟลเดอร์ยาวไม่เกิน ${MAX_NAME} ตัวอักษร`;
  if (state.folders.some((f) => f.id !== ignoreId && f.name.trim().toLowerCase() === clean.toLowerCase())) return 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว';
  return null;
}

export interface DocInput {
  title: string;
  kind: DocKind;
  docDate: string;
  note: string;
}

export function validateDoc(input: DocInput, today = new Date()): Partial<Record<keyof DocInput, string>> {
  const errors: Partial<Record<keyof DocInput, string>> = {};
  const title = input.title.trim();
  if (!title) errors.title = 'กรุณาตั้งชื่อเอกสาร';
  else if (title.length > MAX_TITLE) errors.title = `ชื่อเอกสารยาวไม่เกิน ${MAX_TITLE} ตัวอักษร`;
  if (!DOC_KINDS.some((k) => k.id === input.kind)) errors.kind = 'กรุณาเลือกชนิดเอกสาร';
  if (input.docDate) {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(input.docDate) ? new Date(`${input.docDate}T00:00:00`) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) errors.docDate = 'วันที่ไม่ถูกต้อง';
    else if (parsed.getTime() > today.getTime()) errors.docDate = 'วันที่เอกสารต้องไม่อยู่ในอนาคต';
  }
  if (input.note.length > MAX_NOTE) errors.note = `โน้ตยาวไม่เกิน ${MAX_NOTE} ตัวอักษร`;
  return errors;
}

// ---------- เปลี่ยนข้อมูลแบบไม่แตะที่เก็บ ----------

const touch = (folder: Folder, now = new Date()): Folder => ({ ...folder, updatedAt: now.toISOString() });

export function createFolderIn(state: FoldersState, input: { name: string; about?: string; color: FolderColor }, now = new Date()): { state: FoldersState; folder: Folder } {
  const error = validateFolderName(input.name, state);
  if (error) throw new Error(error);
  if (state.folders.length >= MAX_FOLDERS) throw new Error(`สร้างโฟลเดอร์ได้ไม่เกิน ${MAX_FOLDERS} โฟลเดอร์`);
  const folder: Folder = {
    id: newId(),
    name: input.name.trim(),
    about: (input.about ?? '').trim().slice(0, MAX_NAME),
    color: input.color,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    docs: [],
  };
  return { state: { folders: [folder, ...state.folders] }, folder };
}

export function updateFolderIn(state: FoldersState, id: string, input: { name: string; about: string; color: FolderColor }, now = new Date()): FoldersState {
  const error = validateFolderName(input.name, state, id);
  if (error) throw new Error(error);
  return {
    folders: state.folders.map((f) => (f.id === id ? touch({ ...f, name: input.name.trim(), about: input.about.trim().slice(0, MAX_NAME), color: input.color }, now) : f)),
  };
}

/** คืนสถานะใหม่ กับไฟล์ที่ต้องลบออกจากที่เก็บ */
export function deleteFolderIn(state: FoldersState, id: string): { state: FoldersState; files: Attachment[] } {
  const target = state.folders.find((f) => f.id === id);
  return { state: { folders: state.folders.filter((f) => f.id !== id) }, files: target ? target.docs.map((d) => d.attachment) : [] };
}

export function addDocsIn(state: FoldersState, folderId: string, items: { attachment: Attachment; input: DocInput }[], now = new Date()): FoldersState {
  const folder = state.folders.find((f) => f.id === folderId);
  if (!folder) throw new Error('ไม่พบโฟลเดอร์นี้');
  if (folder.docs.length + items.length > MAX_DOCS_PER_FOLDER) throw new Error(`โฟลเดอร์หนึ่งเก็บได้ไม่เกิน ${MAX_DOCS_PER_FOLDER} เอกสาร`);
  const docs: FolderDoc[] = items.map(({ attachment, input }) => {
    const errors = validateDoc(input, now);
    const first = Object.values(errors)[0];
    if (first) throw new Error(first);
    return { id: newId(), attachment, title: input.title.trim(), kind: input.kind, docDate: input.docDate, note: input.note.trim(), addedAt: now.toISOString() };
  });
  return { folders: state.folders.map((f) => (f.id === folderId ? touch({ ...f, docs: [...docs, ...f.docs] }, now) : f)) };
}

export function updateDocIn(state: FoldersState, folderId: string, docId: string, input: DocInput, now = new Date()): FoldersState {
  const first = Object.values(validateDoc(input, now))[0];
  if (first) throw new Error(first);
  return {
    folders: state.folders.map((f) =>
      f.id === folderId
        ? touch({ ...f, docs: f.docs.map((d) => (d.id === docId ? { ...d, title: input.title.trim(), kind: input.kind, docDate: input.docDate, note: input.note.trim() } : d)) }, now)
        : f
    ),
  };
}

export function removeDocIn(state: FoldersState, folderId: string, docId: string, now = new Date()): { state: FoldersState; file: Attachment | null } {
  const doc = state.folders.find((f) => f.id === folderId)?.docs.find((d) => d.id === docId);
  return {
    state: { folders: state.folders.map((f) => (f.id === folderId ? touch({ ...f, docs: f.docs.filter((d) => d.id !== docId) }, now) : f)) },
    file: doc?.attachment ?? null,
  };
}

/** ใหม่สุดก่อน: ตามวันที่เอกสาร ถ้าไม่ระบุใช้วันที่เพิ่ม */
export const sortDocs = (docs: FolderDoc[]): FolderDoc[] =>
  [...docs].sort((a, b) => (b.docDate || b.addedAt.slice(0, 10)).localeCompare(a.docDate || a.addedAt.slice(0, 10)) || b.addedAt.localeCompare(a.addedAt));

export function filterDocs(docs: FolderDoc[], kind: DocKind | 'all', query: string): FolderDoc[] {
  const term = query.trim().toLowerCase();
  return sortDocs(docs).filter((d) => (kind === 'all' || d.kind === kind) && (!term || `${d.title} ${d.note} ${kindLabel(d.kind)}`.toLowerCase().includes(term)));
}

export const totalDocs = (state: FoldersState): number => state.folders.reduce((n, f) => n + f.docs.length, 0);

// ---------- ที่เก็บ ----------

const isColor = (v: unknown): v is FolderColor => FOLDER_COLORS.some((c) => c.id === v);
const isKind = (v: unknown): v is DocKind => DOC_KINDS.some((k) => k.id === v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** อ่านข้อมูลที่อาจเสียหรือมาจากเครื่องอื่น ตัดรายการที่ไม่สมบูรณ์ทิ้งแทนที่จะทำให้หน้าพัง */
export function sanitizeFolders(raw: unknown): FoldersState {
  const list = (raw as { folders?: unknown } | null)?.folders;
  if (!Array.isArray(list)) return emptyFolders();
  const folders: Folder[] = [];
  for (const item of list.slice(0, MAX_FOLDERS)) {
    const f = item as Partial<Folder> | null;
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !f.name.trim()) continue;
    const docs: FolderDoc[] = [];
    for (const d of Array.isArray(f.docs) ? f.docs.slice(0, MAX_DOCS_PER_FOLDER) : []) {
      const a = (d as Partial<FolderDoc> | null)?.attachment;
      if (!d || typeof d.id !== 'string' || !a || typeof a.id !== 'string' || typeof a.name !== 'string') continue;
      docs.push({
        id: d.id,
        attachment: { id: a.id, name: a.name, type: typeof a.type === 'string' ? a.type : '', size: typeof a.size === 'number' ? a.size : 0 },
        title: str(d.title, MAX_TITLE) || a.name,
        kind: isKind(d.kind) ? d.kind : 'other',
        docDate: typeof d.docDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.docDate) ? d.docDate : '',
        note: str(d.note, MAX_NOTE),
        addedAt: typeof d.addedAt === 'string' ? d.addedAt : new Date(0).toISOString(),
      });
    }
    folders.push({
      id: f.id,
      name: f.name.trim().slice(0, MAX_NAME),
      about: str(f.about, MAX_NAME),
      color: isColor(f.color) ? f.color : 'lavender',
      createdAt: typeof f.createdAt === 'string' ? f.createdAt : new Date(0).toISOString(),
      updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : new Date(0).toISOString(),
      docs,
    });
  }
  return { folders };
}

export function loadFolders(): FoldersState {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? sanitizeFolders(JSON.parse(raw)) : emptyFolders();
  } catch {
    return emptyFolders();
  }
}

export function saveFolders(state: FoldersState): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));
  queueSync('folders');
}

export function clearFolders(): void {
  try {
    localStorage.removeItem(FOLDERS_KEY);
    window.dispatchEvent(new Event(FOLDERS_CHANGED_EVENT));
  } catch {
    // ล้างไม่ได้: ไม่กระทบการใช้งาน
  }
}

/** ข้อมูลโฟลเดอร์ล่าสุด อัปเดตเองเมื่อมีการแก้ไขหรือข้อมูลจากอุปกรณ์อื่นเข้ามา */
export function useFolders(): FoldersState {
  const [state, setState] = useState(loadFolders);
  useEffect(() => {
    const sync = () => setState(loadFolders());
    window.addEventListener(FOLDERS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, sync);
  }, []);
  return state;
}

/** วันที่เอกสารแบบไทย เช่น 12 มี.ค. 2569 */
export const formatDocDate = (iso: string): string => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
