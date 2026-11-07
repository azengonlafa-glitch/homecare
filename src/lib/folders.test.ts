import { describe, expect, it } from 'vitest';
import {
  MAX_DOCS_PER_FOLDER,
  MAX_FOLDERS,
  addDocsIn,
  createFolderIn,
  deleteFolderIn,
  emptyFolders,
  filterDocs,
  removeDocIn,
  sanitizeFolders,
  sortDocs,
  totalDocs,
  updateDocIn,
  updateFolderIn,
  validateDoc,
  validateFolderName,
  type DocInput,
  type FolderDoc,
} from './folders';

const NOW = new Date('2026-11-07T10:00:00');
const file = (id: string, name = `${id}.pdf`) => ({ id, name, type: 'application/pdf', size: 1000 });
const doc = (over: Partial<DocInput> = {}): DocInput => ({ title: 'ผลเลือด', kind: 'result', docDate: '2026-10-01', note: '', ...over });

describe('โฟลเดอร์', () => {
  it('สร้างโฟลเดอร์ใหม่ไว้บนสุด ตัดช่องว่างหัวท้ายชื่อ', () => {
    let { state } = createFolderIn(emptyFolders(), { name: '  ผลตรวจเลือด ', color: 'coral' }, NOW);
    ({ state } = createFolderIn(state, { name: 'ใบสั่งยา', about: 'คุณแม่', color: 'butter' }, NOW));
    expect(state.folders.map((f) => f.name)).toEqual(['ใบสั่งยา', 'ผลตรวจเลือด']);
    expect(state.folders[0].about).toBe('คุณแม่');
  });

  it('ชื่อว่าง ยาวเกิน หรือซ้ำ (ไม่สนตัวพิมพ์) ใช้ไม่ได้ แต่ชื่อเดิมของตัวเองตอนแก้ไขได้', () => {
    const { state, folder } = createFolderIn(emptyFolders(), { name: 'Lab', color: 'sky' }, NOW);
    expect(validateFolderName('   ', state)).toMatch(/ตั้งชื่อ/);
    expect(validateFolderName('ก'.repeat(41), state)).toMatch(/ไม่เกิน 40/);
    expect(validateFolderName('lab', state)).toMatch(/มีโฟลเดอร์ชื่อนี้/);
    expect(validateFolderName('lab', state, folder.id)).toBeNull();
    expect(() => createFolderIn(state, { name: 'LAB', color: 'sky' }, NOW)).toThrow(/มีโฟลเดอร์ชื่อนี้/);
  });

  it('จำกัดจำนวนโฟลเดอร์', () => {
    let state = emptyFolders();
    for (let i = 0; i < MAX_FOLDERS; i++) ({ state } = createFolderIn(state, { name: `โฟลเดอร์ ${i}`, color: 'mint' }, NOW));
    expect(() => createFolderIn(state, { name: 'เกิน', color: 'mint' }, NOW)).toThrow(/ไม่เกิน 30/);
  });

  it('แก้ชื่อ สี และเกี่ยวกับใคร พร้อมอัปเดตเวลาแก้ไข', () => {
    const { state, folder } = createFolderIn(emptyFolders(), { name: 'เก่า', color: 'sky' }, NOW);
    const later = new Date('2026-11-08T08:00:00');
    const next = updateFolderIn(state, folder.id, { name: 'ใหม่', about: 'พ่อ', color: 'pink' }, later);
    expect(next.folders[0]).toMatchObject({ name: 'ใหม่', about: 'พ่อ', color: 'pink', updatedAt: later.toISOString() });
  });

  it('ลบโฟลเดอร์แล้วคืนรายการไฟล์ทั้งหมดให้ไปลบจากที่เก็บ', () => {
    let { state, folder } = createFolderIn(emptyFolders(), { name: 'A', color: 'sky' }, NOW);
    state = addDocsIn(state, folder.id, [{ attachment: file('f1'), input: doc() }, { attachment: file('f2'), input: doc({ title: 'ใบสั่งยา', kind: 'prescription' }) }], NOW);
    const out = deleteFolderIn(state, folder.id);
    expect(out.state.folders).toEqual([]);
    expect(out.files.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    expect(deleteFolderIn(state, 'ไม่มี').files).toEqual([]);
  });
});

describe('เอกสารในโฟลเดอร์', () => {
  const setup = () => {
    const { state, folder } = createFolderIn(emptyFolders(), { name: 'A', color: 'sky' }, NOW);
    return { state, id: folder.id };
  };

  it('เพิ่มหลายไฟล์พร้อมกัน ใหม่ขึ้นก่อน และไม่ทำให้โฟลเดอร์อื่นเปลี่ยน', () => {
    const base = createFolderIn(setup().state, { name: 'B', color: 'pink' }, NOW);
    const target = base.state.folders.find((f) => f.name === 'A')!;
    const state = addDocsIn(base.state, target.id, [{ attachment: file('f1'), input: doc({ title: 'หนึ่ง' }) }, { attachment: file('f2'), input: doc({ title: 'สอง' }) }], NOW);
    expect(state.folders.find((f) => f.name === 'A')!.docs.map((d) => d.title)).toEqual(['หนึ่ง', 'สอง']);
    expect(state.folders.find((f) => f.name === 'B')!.docs).toEqual([]);
    expect(totalDocs(state)).toBe(2);
  });

  it('ข้อมูลเอกสารไม่ถูกต้องไม่ถูกบันทึกเลย (ทั้งชุด)', () => {
    const { state, id } = setup();
    expect(() => addDocsIn(state, id, [{ attachment: file('ok'), input: doc() }, { attachment: file('bad'), input: doc({ title: '  ' }) }], NOW)).toThrow(/ตั้งชื่อเอกสาร/);
    expect(state.folders[0].docs).toHaveLength(0);
  });

  it('ตรวจชื่อ ชนิด วันที่ในอนาคต วันที่ผิดรูปแบบ และโน้ตยาวเกิน', () => {
    expect(validateDoc(doc(), NOW)).toEqual({});
    expect(validateDoc(doc({ title: '' }), NOW).title).toBeTruthy();
    expect(validateDoc(doc({ title: 'ก'.repeat(81) }), NOW).title).toMatch(/ไม่เกิน 80/);
    expect(validateDoc(doc({ docDate: '2026-11-08' }), NOW).docDate).toMatch(/อนาคต/);
    expect(validateDoc(doc({ docDate: '2026-11-07' }), NOW).docDate).toBeUndefined();
    expect(validateDoc(doc({ docDate: '07/11/2026' }), NOW).docDate).toMatch(/ไม่ถูกต้อง/);
    expect(validateDoc(doc({ docDate: '' }), NOW)).toEqual({});
    expect(validateDoc(doc({ note: 'ก'.repeat(301) }), NOW).note).toMatch(/ไม่เกิน 300/);
    expect(validateDoc({ ...doc(), kind: 'x' as never }, NOW).kind).toBeTruthy();
  });

  it('จำกัดจำนวนเอกสารต่อโฟลเดอร์', () => {
    const { state, id } = setup();
    const many = Array.from({ length: MAX_DOCS_PER_FOLDER }, (_, i) => ({ attachment: file(`f${i}`), input: doc({ title: `เอกสาร ${i}` }) }));
    const full = addDocsIn(state, id, many, NOW);
    expect(() => addDocsIn(full, id, [{ attachment: file('extra'), input: doc() }], NOW)).toThrow(/ไม่เกิน 100/);
  });

  it('แก้รายละเอียดและลบเอกสาร ลบแล้วคืนไฟล์ให้ไปลบจากที่เก็บ', () => {
    const { state, id } = setup();
    let next = addDocsIn(state, id, [{ attachment: file('f1'), input: doc({ title: 'เดิม' }) }], NOW);
    const docId = next.folders[0].docs[0].id;
    next = updateDocIn(next, id, docId, doc({ title: 'ใหม่', kind: 'certificate', note: 'โน้ต' }), NOW);
    expect(next.folders[0].docs[0]).toMatchObject({ title: 'ใหม่', kind: 'certificate', note: 'โน้ต' });
    expect(() => updateDocIn(next, id, docId, doc({ title: '' }), NOW)).toThrow();
    const removed = removeDocIn(next, id, docId, NOW);
    expect(removed.state.folders[0].docs).toEqual([]);
    expect(removed.file?.id).toBe('f1');
    expect(removeDocIn(next, id, 'ไม่มี', NOW).file).toBeNull();
  });

  it('เรียงตามวันที่เอกสาร ไม่ระบุวันที่ใช้วันที่เพิ่ม และกรองตามชนิดกับคำค้น', () => {
    const mk = (id: string, title: string, kind: FolderDoc['kind'], docDate: string, addedAt: string, note = ''): FolderDoc => ({ id, attachment: file(id), title, kind, docDate, note, addedAt });
    const docs = [
      mk('a', 'ผลเลือดเก่า', 'result', '2026-01-05', '2026-11-01T00:00:00.000Z'),
      mk('b', 'ใบสั่งยาล่าสุด', 'prescription', '2026-10-20', '2026-10-21T00:00:00.000Z', 'เบาหวาน'),
      mk('c', 'รูปผื่น', 'image', '', '2026-11-05T00:00:00.000Z'),
    ];
    expect(sortDocs(docs).map((d) => d.id)).toEqual(['c', 'b', 'a']);
    expect(filterDocs(docs, 'result', '').map((d) => d.id)).toEqual(['a']);
    expect(filterDocs(docs, 'all', 'เบาหวาน').map((d) => d.id)).toEqual(['b']);
    expect(filterDocs(docs, 'all', 'ใบสั่งยา').map((d) => d.id)).toEqual(['b']);
    expect(filterDocs(docs, 'image', 'เลือด')).toEqual([]);
  });
});

describe('อ่านข้อมูลที่เสียหรือมาจากเครื่องอื่น', () => {
  it('ตัดรายการที่ไม่สมบูรณ์ทิ้ง เติมค่าที่ขาด และไม่พัง', () => {
    expect(sanitizeFolders(null).folders).toEqual([]);
    expect(sanitizeFolders({ folders: 'x' }).folders).toEqual([]);
    const out = sanitizeFolders({
      folders: [
        { id: 'ok', name: '  โฟลเดอร์ดี ', color: 'ไม่มีสีนี้', docs: [{ id: 'd1', attachment: { id: 'f', name: 'a.pdf' }, kind: 'ผิด', docDate: 'ผิดรูป' }, { id: 'd2' }, null] },
        { id: 'noname', name: '  ' },
        { name: 'ไม่มีรหัส' },
        null,
      ],
    });
    expect(out.folders).toHaveLength(1);
    expect(out.folders[0]).toMatchObject({ name: 'โฟลเดอร์ดี', color: 'lavender' });
    expect(out.folders[0].docs).toHaveLength(1);
    expect(out.folders[0].docs[0]).toMatchObject({ title: 'a.pdf', kind: 'other', docDate: '', attachment: { id: 'f', type: '', size: 0 } });
  });
});
