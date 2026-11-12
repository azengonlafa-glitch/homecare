import type { RealtimeChannel, User } from '@supabase/supabase-js';
import { cloudEnabled, requireClient, supabase } from './client';
import { AUTH_KEY, CURRENT_MEMBER_ID, readAuthUser } from './identity';
import { CLOUD_UPDATED_EVENT, setSyncHandler, type StoreName } from './queue';

/**
 * ชั้นซิงก์ข้อมูลกับ Supabase
 *
 * หลักการ: ไฟล์ใน lib/ ยังอ่าน/เขียน localStorage แบบเดิม (เป็นแคชในเครื่อง ใช้งานได้ตอนออฟไลน์)
 * เมื่อบันทึก lib/ จะเรียก queueSync() แล้วที่นี่จะส่งเฉพาะส่วนที่เปลี่ยนขึ้นเซิร์ฟเวอร์
 * และดึงข้อมูลที่คนอื่นแก้กลับมาลงแคช (realtime + ดึงซ้ำเป็นระยะ)
 */

const KEYS: Record<StoreName, string> = {
  settings: 'growa_settings_v1',
  records: 'growa_member_records_v1',
  meds: 'growa_meds_v1',
  calendar: 'growa_calendar_v1',
  journal: 'growa_journal_v1',
  access: 'growa_access_requests_v1',
  notices: 'growa_family_notices_v1',
  onboarding: 'growa_onboarding_v1',
  folders: 'growa_folders_v1',
};

/** เหตุการณ์ของแต่ละข้อมูล (ต้องตรงกับค่าที่ประกาศใน lib/) */
const EVENTS: Record<StoreName, string[]> = {
  settings: ['growa-settings-changed', 'growa-members-changed'],
  records: ['growa-members-changed'],
  meds: ['growa-meds-changed'],
  calendar: [],
  journal: [],
  access: ['growa-access-changed'],
  notices: ['growa-notices-changed'],
  onboarding: [],
  folders: ['growa-folders-changed'],
};

const OWNER_KEY = 'growa_cache_owner';
const FILES_DB = 'growa_files_v1';
const POLL_MS = 45_000;
const PUSH_DELAY_MS = 400;
const RETRY_MS = 8_000;

// ---------- สถานะ ----------

export type HomeRole = 'owner' | 'member' | 'external';

interface Ctx {
  userId: string;
  homeId: string | null;
  role: HomeRole | null;
}

let ctx: Ctx | null = null;

export const getCtx = (): Readonly<Ctx> | null => ctx;
export const hasHome = (): boolean => !!ctx?.homeId;

// ---------- ตัวช่วย ----------

type Json = unknown;

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const key of Object.keys(value as Record<string, Json>).sort()) {
      out[key] = sortKeys((value as Record<string, Json>)[key]);
    }
    return out;
  }
  return value;
}

/** แปลงเป็นข้อความแบบเรียงคีย์ เพื่อเทียบข้อมูลได้แม้ Postgres จะสลับลำดับคีย์ของ jsonb */
const stable = (value: Json): string => JSON.stringify(sortKeys(value)) ?? 'null';

function parse(raw: string | null): Json {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const emit = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

function announce(store: StoreName) {
  for (const name of EVENTS[store]) emit(name);
  emit(CLOUD_UPDATED_EVENT, { store });
}

/** เขียนข้อมูลลงแคชในเครื่อง (ไม่ผ่าน lib/ จึงไม่ถูกส่งกลับขึ้นเซิร์ฟเวอร์) แล้วแจ้งหน้าจอเมื่อมีการเปลี่ยนจริง */
function writeLocal(store: StoreName, value: Json) {
  const key = KEYS[store];
  const current = parse(localStorage.getItem(key));
  if (current !== null && stable(current) === stable(value)) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to write cache', key, err);
    return;
  }
  announce(store);
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

// ---------- นิยามข้อมูลแต่ละชุด ----------

interface Item {
  id: string;
  data: Json;
}

interface ItemStoreDef {
  collection: string;
  toItems(raw: string | null): Item[];
  fromItems(items: Item[]): Json;
}

const byId = (a: Item, b: Item) => a.id.localeCompare(b.id);

function arrayStore(collection: string, idOf: (row: Record<string, unknown>) => string): ItemStoreDef {
  return {
    collection,
    toItems(raw) {
      const list = parse(raw);
      if (!Array.isArray(list)) return [];
      return list
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map((row) => ({ id: String(idOf(row)), data: row }));
    },
    fromItems: (items) => [...items].sort(byId).map((i) => i.data),
  };
}

const ITEM_STORES: Partial<Record<StoreName, ItemStoreDef>> = {
  calendar: arrayStore('calendar', (r) => String(r.id)),
  journal: arrayStore('journal', (r) => String(r.id)),
  access: arrayStore('access', (r) => String(r.id)),
  notices: {
    ...arrayStore('family_notices', (r) => String(r.key)),
    fromItems: (items) =>
      items
        .map((i) => i.data as { sharedAt?: string })
        .sort((a, b) => String(b.sharedAt ?? '').localeCompare(String(a.sharedAt ?? '')))
        .slice(0, 50),
  },
  records: {
    collection: 'member_records',
    toItems(raw) {
      const map = parse(raw);
      if (!map || typeof map !== 'object') return [];
      return Object.entries(map as Record<string, Json>).map(([id, data]) => ({ id, data }));
    },
    fromItems(items) {
      const out: Record<string, Json> = {};
      for (const item of items) out[item.id] = item.data;
      return out;
    },
  },
};

/** ข้อมูลส่วนตัวที่เก็บเป็นเอกสารเดียวต่อผู้ใช้ (ตาราง user_docs) */
const DOC_STORES: Partial<Record<StoreName, string>> = { meds: 'meds', onboarding: 'onboarding', folders: 'folders' };

const COLLECTION_TO_STORE: Record<string, StoreName> = {
  calendar: 'calendar',
  journal: 'journal',
  access: 'access',
  family_notices: 'notices',
  member_records: 'records',
  home_info: 'settings',
};

/** ข้อมูลล่าสุดที่ตรงกับเซิร์ฟเวอร์ ใช้เทียบหาเฉพาะรายการที่เปลี่ยน */
const itemSnapshots = new Map<StoreName, Map<string, string>>();
const docSnapshots = new Map<string, string>();
const settingsSnap = { user: '', home: '', homeName: '', profileRow: '' };

// ---------- ส่งข้อมูลขึ้นเซิร์ฟเวอร์ ----------

const dirty = new Map<StoreName, Set<string> | 'all'>();
let pushTimer: number | undefined;
let retryTimer: number | undefined;
let chain: Promise<unknown> = Promise.resolve();

function onQueue(store: StoreName, ids?: string[]) {
  if (!ctx) return;
  if (ITEM_STORES[store] && !ctx.homeId) return;
  const existing = dirty.get(store);
  if (!ids || existing === 'all') dirty.set(store, 'all');
  else dirty.set(store, new Set([...(existing ?? []), ...ids]));
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void flush(), PUSH_DELAY_MS);
}

/** ส่งข้อมูลที่ค้างอยู่ขึ้นเซิร์ฟเวอร์ (เรียกซ้อนกันได้ จะรอคิวตามลำดับ) */
export function flush(): Promise<void> {
  const run = chain.then(async () => {
    if (!ctx || dirty.size === 0) return;
    const work = [...dirty.entries()];
    dirty.clear();
    let failed = false;
    for (const [store, ids] of work) {
      try {
        await pushStore(store, ids === 'all' ? undefined : [...ids]);
      } catch (err) {
        console.error('Sync push failed', store, err);
        failed = true;
        const existing = dirty.get(store);
        if (ids === 'all' || existing === 'all') dirty.set(store, 'all');
        else dirty.set(store, new Set([...(existing ?? []), ...ids]));
      }
    }
    if (failed) {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => void flush(), RETRY_MS);
    }
  });
  chain = run.catch(() => undefined);
  return run;
}

async function pushStore(store: StoreName, ids?: string[]) {
  const c = ctx;
  if (!c) return;
  const sb = requireClient();

  if (store === 'settings') return pushSettings();

  const docKey = DOC_STORES[store];
  if (docKey) {
    const data = parse(localStorage.getItem(KEYS[store]));
    if (data === null) return;
    const snap = stable(data);
    if (docSnapshots.get(docKey) === snap) return;
    const { error } = await sb
      .from('user_docs')
      .upsert({ user_id: c.userId, key: docKey, data, updated_at: new Date().toISOString() });
    if (error) throw error;
    docSnapshots.set(docKey, snap);
    return;
  }

  const def = ITEM_STORES[store];
  if (!def || !c.homeId) return;
  const snapshot = itemSnapshots.get(store) ?? new Map<string, string>();
  itemSnapshots.set(store, snapshot);

  const items = def.toItems(localStorage.getItem(KEYS[store]));
  const current = new Map(items.map((i) => [i.id, stable(i.data)]));

  const upserts = items.filter((i) => (!ids || ids.includes(i.id)) && snapshot.get(i.id) !== current.get(i.id));
  const removed = (ids ?? [...snapshot.keys()]).filter((id) => snapshot.has(id) && !current.has(id));

  for (let i = 0; i < upserts.length; i += 100) {
    const chunk = upserts.slice(i, i + 100);
    const { error } = await sb.from('home_items').upsert(
      chunk.map((item) => ({
        home_id: c.homeId,
        collection: def.collection,
        id: item.id,
        data: item.data,
        updated_by: c.userId,
        updated_at: new Date().toISOString(),
      }))
    );
    if (error) throw error;
    for (const item of chunk) snapshot.set(item.id, current.get(item.id)!);
  }

  if (removed.length > 0) {
    const { error } = await sb
      .from('home_items')
      .delete()
      .eq('home_id', c.homeId)
      .eq('collection', def.collection)
      .in('id', removed);
    if (error) throw error;
    for (const id of removed) snapshot.delete(id);
  }
}

interface StoredSettings {
  profile?: { photo?: string };
  nickname?: string;
  reminders?: unknown;
  fontScale?: unknown;
  home?: unknown;
  homeName?: string;
}

async function pushSettings() {
  const c = ctx;
  if (!c) return;
  const sb = requireClient();
  const s = parse(localStorage.getItem(KEYS.settings)) as StoredSettings | null;
  if (!s) return;

  const userPart = { profile: s.profile, nickname: s.nickname, reminders: s.reminders, fontScale: s.fontScale };
  const userSnap = stable(userPart);
  if (userSnap !== settingsSnap.user) {
    const { error } = await sb
      .from('user_docs')
      .upsert({ user_id: c.userId, key: 'settings', data: userPart, updated_at: new Date().toISOString() });
    if (error) throw error;
    settingsSnap.user = userSnap;
  }

  const profileRow = stable({ name: s.nickname ?? '', photo: s.profile?.photo ?? '' });
  if (profileRow !== settingsSnap.profileRow && s.nickname) {
    const { error } = await sb
      .from('profiles')
      .update({ display_name: s.nickname, photo: s.profile?.photo ?? '', updated_at: new Date().toISOString() })
      .eq('id', c.userId);
    if (error) throw error;
    settingsSnap.profileRow = profileRow;
  }

  if (!c.homeId) return;

  const homePart = { home: s.home };
  const homeSnap = stable(homePart);
  if (homeSnap !== settingsSnap.home) {
    const { error } = await sb.from('home_items').upsert({
      home_id: c.homeId,
      collection: 'home_info',
      id: 'main',
      data: homePart,
      updated_by: c.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    settingsSnap.home = homeSnap;
  }

  const name = (s.homeName ?? '').trim();
  if (c.role === 'owner' && name && name !== settingsSnap.homeName) {
    const { error } = await sb.from('homes').update({ name }).eq('id', c.homeId);
    if (error) throw error;
    settingsSnap.homeName = name;
  }
}

// ---------- ดึงข้อมูลจากเซิร์ฟเวอร์ ----------

async function loadMembership() {
  const c = ctx;
  if (!c) return;
  const { data, error } = await requireClient()
    .from('home_members')
    .select('home_id, role')
    .eq('user_id', c.userId)
    .maybeSingle();
  if (error) throw error;
  c.homeId = (data?.home_id as string | undefined) ?? null;
  c.role = (data?.role as HomeRole | undefined) ?? null;
}

async function refreshItems(store: StoreName) {
  const c = ctx;
  const def = ITEM_STORES[store];
  if (!c || !c.homeId || !def) return;
  const sb = requireClient();
  const rows = await fetchAll<{ id: string; data: Json }>((from, to) =>
    sb
      .from('home_items')
      .select('id, data')
      .eq('home_id', c.homeId!)
      .eq('collection', def.collection)
      .order('id')
      .range(from, to)
  );
  if (dirty.has(store)) return; // มีการแก้ไขในเครื่องที่ยังไม่ได้ส่ง: รอบหน้าค่อยรวม
  itemSnapshots.set(store, new Map(rows.map((r) => [r.id, stable(r.data)])));
  writeLocal(store, def.fromItems(rows.map((r) => ({ id: r.id, data: r.data }))));
}

async function refreshDoc(store: StoreName) {
  const c = ctx;
  const docKey = DOC_STORES[store];
  if (!c || !docKey) return;
  const { data, error } = await requireClient()
    .from('user_docs')
    .select('data')
    .eq('user_id', c.userId)
    .eq('key', docKey)
    .maybeSingle();
  if (error) throw error;
  if (dirty.has(store) || !data) return;
  docSnapshots.set(docKey, stable(data.data));
  writeLocal(store, data.data);
}

interface MemberRow {
  user_id: string;
  role: HomeRole;
  relation: string;
  joined_at: string;
}
interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string;
  photo: string;
}

async function refreshSettings() {
  const c = ctx;
  if (!c) return;
  const sb = requireClient();

  const [userDocRes, homeRes, membersRes, infoRes] = await Promise.all([
    sb.from('user_docs').select('data').eq('user_id', c.userId).eq('key', 'settings').maybeSingle(),
    c.homeId ? sb.from('homes').select('name, invite_code').eq('id', c.homeId).maybeSingle() : Promise.resolve(null),
    c.homeId
      ? sb.from('home_members').select('user_id, role, relation, joined_at').eq('home_id', c.homeId)
      : Promise.resolve(null),
    c.homeId
      ? sb.from('home_items').select('data').eq('home_id', c.homeId).eq('collection', 'home_info').eq('id', 'main').maybeSingle()
      : Promise.resolve(null),
  ]);
  if (userDocRes.error) throw userDocRes.error;
  if (homeRes?.error) throw homeRes.error;
  if (membersRes?.error) throw membersRes.error;
  if (infoRes?.error) throw infoRes.error;

  const memberRows = (membersRes?.data ?? []) as MemberRow[];
  if (c.homeId && memberRows.length > 0 && !memberRows.some((m) => m.user_id === c.userId)) {
    handleRemovedFromHome();
    return;
  }
  const me = memberRows.find((m) => m.user_id === c.userId);
  if (me) c.role = me.role;

  const ids = memberRows.map((m) => m.user_id);
  const profiles = ids.length
    ? await fetchAll<ProfileRow>((from, to) =>
        sb.from('profiles').select('id, email, display_name, photo').in('id', ids).range(from, to)
      )
    : [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  if (dirty.has('settings')) return;

  const local = (parse(localStorage.getItem(KEYS.settings)) as Record<string, Json> | null) ?? {};
  const next: Record<string, Json> = { ...local };

  const userDoc = userDocRes.data?.data as Record<string, Json> | undefined;
  if (userDoc) {
    for (const key of ['profile', 'nickname', 'reminders', 'fontScale']) {
      if (userDoc[key] !== undefined) next[key] = userDoc[key];
    }
    settingsSnap.user = stable({
      profile: userDoc.profile,
      nickname: userDoc.nickname,
      reminders: userDoc.reminders,
      fontScale: userDoc.fontScale,
    });
  }
  const myProfile = profileById.get(c.userId);
  if (myProfile) {
    if (!next.nickname && myProfile.display_name) next.nickname = myProfile.display_name;
    settingsSnap.profileRow = stable({ name: myProfile.display_name, photo: myProfile.photo });
  }

  if (c.homeId) {
    const info = infoRes?.data?.data as { home?: Json } | undefined;
    if (info?.home) {
      next.home = { ...((local.home as Record<string, Json>) ?? {}), ...(info.home as Record<string, Json>) };
      settingsSnap.home = stable({ home: info.home });
    }
    if (homeRes?.data) {
      next.homeName = homeRes.data.name;
      next.inviteCode = homeRes.data.invite_code;
      settingsSnap.homeName = homeRes.data.name as string;
    }
    const order: Record<HomeRole, number> = { owner: 0, member: 1, external: 2 };
    next.members = [...memberRows]
      .sort((a, b) => order[a.role] - order[b.role] || a.joined_at.localeCompare(b.joined_at))
      .map((m) => {
        const p = profileById.get(m.user_id);
        return {
          id: m.user_id,
          name: p?.display_name || p?.email?.split('@')[0] || 'สมาชิก',
          relation: m.relation || 'สมาชิก',
          role: m.role,
          photo: p?.photo ?? '',
        };
      });
  } else {
    delete next.members;
    delete next.homeName;
    delete next.inviteCode;
  }

  writeLocal('settings', next);
}

const REFRESHERS: Record<StoreName, () => Promise<void>> = {
  settings: refreshSettings,
  records: () => refreshItems('records'),
  meds: () => refreshDoc('meds'),
  calendar: () => refreshItems('calendar'),
  journal: () => refreshItems('journal'),
  access: () => refreshItems('access'),
  notices: () => refreshItems('notices'),
  onboarding: () => refreshDoc('onboarding'),
  folders: () => refreshDoc('folders'),
};

const ALL_STORES = Object.keys(REFRESHERS) as StoreName[];

/** ดึงข้อมูลทุกชุดจากเซิร์ฟเวอร์ลงแคช (ส่งข้อมูลที่ค้างก่อนเสมอ เพื่อไม่ให้ทับการแก้ไขในเครื่อง) */
export async function refreshAll(): Promise<void> {
  if (!ctx) return;
  await flush();
  await loadMembership();
  // settings ต้องมาก่อน เพราะมีรายชื่อสมาชิกที่หน้าอื่นใช้อ้างอิง
  await refreshSettings();
  if (!ctx) return;
  const results = await Promise.allSettled(ALL_STORES.filter((s) => s !== 'settings').map((s) => REFRESHERS[s]()));
  for (const r of results) if (r.status === 'rejected') console.error('Sync refresh failed', r.reason);
}

async function refreshOne(store: StoreName) {
  if (!ctx) return;
  await flush();
  try {
    await REFRESHERS[store]();
  } catch (err) {
    console.error('Sync refresh failed', store, err);
  }
}

// ---------- Realtime + ดึงซ้ำเป็นระยะ ----------

let channel: RealtimeChannel | null = null;
let pollTimer: number | undefined;
const refreshTimers = new Map<StoreName, number>();

function scheduleRefresh(store: StoreName) {
  window.clearTimeout(refreshTimers.get(store));
  refreshTimers.set(
    store,
    window.setTimeout(() => void refreshOne(store), 250)
  );
}

function startRealtime() {
  stopRealtime();
  const c = ctx;
  if (!c || !supabase) return;
  const ch = supabase.channel(`growa-${c.userId}`);

  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'user_docs', filter: `user_id=eq.${c.userId}` }, (payload) => {
    const row = (payload.new && 'key' in payload.new ? payload.new : payload.old) as { key?: string };
    const store = (Object.entries(DOC_STORES).find(([, key]) => key === row.key)?.[0] ?? (row.key === 'settings' ? 'settings' : null)) as StoreName | null;
    if (store) scheduleRefresh(store);
  });

  if (c.homeId) {
    const home = `home_id=eq.${c.homeId}`;
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'home_items', filter: home }, (payload) => {
      const row = (payload.new && 'collection' in payload.new ? payload.new : payload.old) as {
        collection?: string;
        updated_by?: string;
      };
      if (payload.eventType !== 'DELETE' && row.updated_by === c.userId) return; // ข้อมูลที่เราส่งเอง
      const store = row.collection ? COLLECTION_TO_STORE[row.collection] : undefined;
      if (store) scheduleRefresh(store);
    });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'home_members', filter: home }, () => scheduleRefresh('settings'));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'homes', filter: `id=eq.${c.homeId}` }, () => scheduleRefresh('settings'));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => scheduleRefresh('settings'));
  }

  ch.subscribe();
  channel = ch;
}

function stopRealtime() {
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
}

const onVisible = () => {
  if (document.visibilityState === 'visible') void refreshAll().catch((e) => console.error(e));
};
const onOnline = () => {
  void flush();
  void refreshAll().catch((e) => console.error(e));
};

function startPolling() {
  stopPolling();
  // การลบข้อมูลของคนอื่นไม่ส่งผ่าน realtime แบบกรองได้ จึงดึงซ้ำเป็นระยะเมื่อเปิดหน้านี้อยู่
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshAll().catch((e) => console.error(e));
  }, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
}

function stopPolling() {
  window.clearInterval(pollTimer);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
}

// ---------- เริ่มต้น / ออกจากระบบ ----------

/** ล้างแคชข้อมูลทั้งหมดในเครื่อง (เก็บเฉพาะสิ่งที่ระบุ) */
function wipeLocal(keep: string[] = []) {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('growa_') && !keep.includes(key)) localStorage.removeItem(key);
  }
}

function ensureCacheOwner(userId: string) {
  if (localStorage.getItem(OWNER_KEY) === userId) return;
  wipeLocal();
  try {
    indexedDB.deleteDatabase(FILES_DB);
  } catch {
    // ล้างไฟล์แคชไม่ได้: ข้ามได้
  }
  localStorage.setItem(OWNER_KEY, userId);
}

function userName(user: User): string {
  const meta = user.user_metadata as { name?: string; full_name?: string } | undefined;
  return (meta?.name || meta?.full_name || user.email?.split('@')[0] || '').trim();
}

function storeAuthUser(user: User) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ id: user.id, email: user.email ?? '', name: userName(user) }));
}

/** เรียกครั้งเดียวก่อนวาดหน้าจอ: ตรวจเซสชัน ดึงข้อมูลลงแคช แล้วเริ่ม realtime */
export async function bootCloud(): Promise<void> {
  if (!cloudEnabled || !supabase) return;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    localStorage.removeItem(AUTH_KEY);
    ctx = null;
    return;
  }

  ensureCacheOwner(user.id);
  storeAuthUser(user);
  // CURRENT_MEMBER_ID คำนวณตอนโหลดไฟล์ ซึ่งเกิดก่อนบรรทัดนี้ ถ้าตอนนั้นยังไม่มีข้อมูลล็อกอิน (เพิ่งเข้าสู่ระบบ/กลับจากลิงก์ยืนยัน)
  // รหัสสมาชิกของเราจะเป็น 'me' ทั้งเซสชัน ทำให้ระบบไม่รู้ว่าเราเป็นเจ้าของบ้านและส่งคำขอหาตัวเองได้ จึงโหลดหน้าใหม่หนึ่งครั้ง
  if (CURRENT_MEMBER_ID !== user.id && sessionStorage.getItem('growa_identity_reload') !== user.id) {
    sessionStorage.setItem('growa_identity_reload', user.id);
    window.location.reload();
    return;
  }
  ctx = { userId: user.id, homeId: null, role: null };
  setSyncHandler(onQueue);

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && ctx) {
      ctx = null;
      wipeLocal();
      window.location.replace('/login');
      return;
    }
    // แท็บอื่นในเบราว์เซอร์เดียวกันเข้าสู่ระบบด้วยบัญชีอื่น: เซสชันและแคชในเครื่องใช้ร่วมกันทุกแท็บ
    // หยุดส่งข้อมูลทันที (กันข้อมูลสองบัญชีปนกัน) แล้วโหลดหน้าใหม่ให้ตรงกับบัญชีที่ล็อกอินอยู่จริง
    if (session?.user && ctx && session.user.id !== ctx.userId) {
      ctx = null;
      setSyncHandler(null);
      window.clearTimeout(pushTimer);
      window.clearTimeout(retryTimer);
      stopRealtime();
      stopPolling();
      window.location.reload();
    }
  });

  try {
    await refreshAll();
    startRealtime();
    startPolling();
  } catch (err) {
    // ออฟไลน์หรือเซิร์ฟเวอร์ไม่ตอบ: ใช้ข้อมูลในแคชต่อไป แล้วลองใหม่ตามรอบ
    console.error('Initial sync failed, using cached data', err);
    startPolling();
  }
}

/** ผู้ใช้ถูกลบออกจากบ้าน (หรือบ้านถูกลบ) ระหว่างใช้งาน */
function handleRemovedFromHome() {
  if (!ctx) return;
  ctx.homeId = null;
  ctx.role = null;
  // ข้อมูลของบ้านที่ค้างส่งอยู่ใช้ไม่ได้แล้ว (ไม่มีบ้านให้ส่งไป)
  for (const store of Object.keys(ITEM_STORES) as StoreName[]) dirty.delete(store);
  clearHomeCaches();
  stopRealtime();
  startRealtime();
  window.location.replace('/setup');
}

/** ล้างข้อมูลของบ้านออกจากแคช (เก็บข้อมูลส่วนตัวไว้) */
export function clearHomeCaches() {
  for (const store of ['calendar', 'journal', 'access', 'notices', 'records'] as StoreName[]) {
    localStorage.removeItem(KEYS[store]);
    itemSnapshots.delete(store);
  }
  localStorage.removeItem('growa_notifications_v2');
  localStorage.removeItem('growa_notification_routing_v1');
  const s = parse(localStorage.getItem(KEYS.settings)) as Record<string, Json> | null;
  if (s) {
    delete s.members;
    delete s.homeName;
    delete s.inviteCode;
    delete s.home;
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  }
  settingsSnap.home = '';
  settingsSnap.homeName = '';
}

export async function signOutAll(): Promise<void> {
  try {
    await flush();
  } catch {
    // ส่งไม่ทัน: ข้อมูลที่ค้างจะหายเมื่อออกจากระบบ
  }
  stopRealtime();
  stopPolling();
  setSyncHandler(null);
  ctx = null;
  // scope: 'local' = ออกเฉพาะเครื่อง/เบราว์เซอร์นี้ ค่าเริ่มต้น ('global') จะยกเลิกเซสชันของบัญชีนี้ทุกเครื่อง
  // ทำให้หน้าอื่นหรืออุปกรณ์อื่นที่ล็อกอินอีเมลเดียวกันถูกเด้งออกไปด้วย
  if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  wipeLocal();
  window.location.replace('/login');
}

// ---------- การทำงานกับบัญชีและบ้าน ----------

/** แปลงรหัสข้อผิดพลาดจากเซิร์ฟเวอร์เป็นข้อความภาษาไทยที่เข้าใจง่าย */
export function explainError(err: unknown): string {
  const message = String((err as { message?: string } | null)?.message ?? err ?? '');
  const table: [RegExp, string][] = [
    [/invalid_code/, 'ไม่พบรหัสเชิญนี้ ตรวจสอบรหัสอีกครั้ง'],
    [/already_in_home/, 'บัญชีนี้อยู่ในบ้านแล้ว'],
    [/too_many_attempts/, 'ใส่รหัสเชิญผิดหลายครั้งแล้ว รอ 15 นาทีแล้วลองใหม่ หรือขอรหัสใหม่จากผู้ดูแลหลักของบ้าน'],
    [/owner_cannot_leave/, 'ผู้ดูแลหลักออกจากกลุ่มบ้านเองไม่ได้ ต้องมอบบทบาทให้คนอื่นหรือลบบ้านก่อน'],
    [/forbidden/, 'คุณไม่มีสิทธิ์ทำรายการนี้'],
    [/not_authenticated/, 'หมดเวลาเข้าสู่ระบบแล้ว เข้าสู่ระบบอีกครั้งแล้วลองใหม่'],
    [/owner_has_members/, 'คุณเป็นผู้ดูแลหลักของบ้านที่ยังมีคนอื่นอยู่ มอบบทบาทผู้ดูแลหลักให้คนอื่นก่อน แล้วค่อยลบบัญชี'],
    [/files_remaining/, 'ลบไฟล์แนบของคุณไม่ครบ จึงยังไม่ลบบัญชี (ข้อมูลของคุณยังอยู่ครบ) ลองอีกครั้ง'],
    [/delete_my_account|PGRST202|Could not find the function/i, 'ระบบลบบัญชียังไม่เปิดใช้งานบนเซิร์ฟเวอร์ ข้อมูลของคุณยังอยู่ครบ โปรดติดต่อทีมงาน'],
    [/no_home/, 'ยังไม่ได้เข้าร่วมบ้าน เข้าร่วมหรือสร้างบ้านก่อนจึงจะทำรายการนี้ได้'],
    [/Invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
    [/Email not confirmed/i, 'ยังไม่ได้ยืนยันอีเมล กรุณาเปิดอีเมลแล้วกดลิงก์ยืนยัน'],
    [/User already registered/i, 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน'],
    [/Password should be at least/i, 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'],
    [/rate limit|too many/i, 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'],
    [/Failed to fetch|NetworkError|network/i, 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่'],
  ];
  return table.find(([re]) => re.test(message))?.[1] ?? 'ทำรายการไม่สำเร็จ ลองอีกครั้ง ถ้ายังไม่ได้ ให้โหลดหน้านี้ใหม่หรือลองใหม่ภายหลัง';
}

export async function signUpWithEmail(email: string, password: string, name: string): Promise<{ needsConfirm: boolean }> {
  const sb = requireClient();
  const { data, error } = await sb.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  // เก็บตัวตนไว้ก่อนโหลดหน้าใหม่ เพื่อให้ CURRENT_MEMBER_ID ถูกต้องตั้งแต่โหลดแรก
  if (data.user) storeAuthUser(data.user);
}

export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  const { error } = await requireClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw error;
}

/** เปลี่ยนอีเมลเข้าสู่ระบบ (Supabase จะส่งลิงก์ยืนยันไปที่อีเมลใหม่) */
export async function changeLoginEmail(email: string): Promise<void> {
  const { error } = await requireClient().auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

async function afterHomeChange() {
  startRealtime();
  await refreshAll();
}

export async function createHome(name: string, relation: string): Promise<void> {
  const c = ctx;
  if (!c) throw new Error('not_authenticated');
  const { data, error } = await requireClient().rpc('create_home', { p_name: name, p_relation: relation });
  if (error) throw error;
  c.homeId = data as string;
  c.role = 'owner';
  await afterHomeChange();
}

export async function joinHome(code: string, relation: string): Promise<void> {
  const c = ctx;
  if (!c) throw new Error('not_authenticated');
  const { data, error } = await requireClient().rpc('join_home', { p_code: code, p_relation: relation });
  if (error) throw error;
  // ตั้งแต่ hardening.sql: รหัสผิดคืนค่า null แทนการโยนข้อผิดพลาด (เพื่อนับจำนวนครั้งที่ลองผิดได้)
  if (!data) throw new Error('invalid_code');
  c.homeId = data as string;
  c.role = 'member';
  await afterHomeChange();
}

async function homeRpc(fn: string, args: Record<string, unknown>) {
  const c = ctx;
  if (!c?.homeId) throw new Error('no_home');
  const { data, error } = await requireClient().rpc(fn, { p_home: c.homeId, ...args });
  if (error) throw error;
  await refreshSettings();
  return data;
}

export const regenerateInvite = () => homeRpc('regenerate_invite', {}) as Promise<string>;
export const setMemberRole = (userId: string, role: 'member' | 'external') =>
  homeRpc('set_member_role', { p_user: userId, p_role: role }).then(() => undefined);
export const transferOwnership = (userId: string) =>
  homeRpc('transfer_ownership', { p_user: userId }).then(() => undefined);
export const removeMember = (userId: string) => homeRpc('remove_member', { p_user: userId }).then(() => undefined);

/** สมาชิกออกจากบ้านเอง (เจ้าของบ้านออกเองไม่ได้ ต้องมอบบทบาทหรือลบบ้านก่อน) */
export async function leaveHome(): Promise<void> {
  const c = ctx;
  if (!c?.homeId) return;
  // ส่งข้อมูลที่ค้างก่อน (ถ้าส่งไม่ได้ก็ไม่ขวางการออกจากบ้าน)
  await flush().catch(() => undefined);
  // เรียกฟังก์ชันตรง ๆ ไม่ดึงข้อมูลบ้านซ้ำ เพราะหลังออกแล้วจะไม่มีสิทธิ์อ่านข้อมูลบ้านนั้นอีก
  const { error } = await requireClient().rpc('remove_member', { p_home: c.homeId, p_user: c.userId });
  if (error) throw error;
  handleRemovedFromHome();
}

/** ลบบ้านและข้อมูลทั้งหมดของบ้าน (เฉพาะผู้ดูแลหลัก) */
export async function deleteHome(): Promise<void> {
  const c = ctx;
  if (!c?.homeId) return;
  const sb = requireClient();
  // ลบไฟล์แนบของบ้านก่อน (พยายามเต็มที่ ถ้าลบไม่ครบไม่ขวางการลบบ้าน)
  try {
    const { data } = await sb.storage.from('attachments').list(c.homeId, { limit: 1000 });
    if (data?.length) await sb.storage.from('attachments').remove(data.map((f) => `${c.homeId}/${f.name}`));
  } catch (err) {
    console.error('Failed to delete attachments', err);
  }
  const { error } = await sb.rpc('delete_home', { p_home: c.homeId });
  if (error) throw error;
  c.homeId = null;
  c.role = null;
  clearHomeCaches();
  stopRealtime();
  startRealtime();
}

// ---------- ลบบัญชีของฉัน (PDPA ม.33: สิทธิขอให้ลบข้อมูล) ----------

/**
 * ลบไฟล์ทั้งหมดใต้โฟลเดอร์หนึ่งใน Storage แล้วตรวจซ้ำว่าไม่เหลือ
 * (ไฟล์ลบผ่าน SQL ไม่ได้ ต้องผ่าน Storage API) ถ้าเหลือต้องหยุด ไม่ลบบัญชีทั้งที่ไฟล์ยังค้าง
 */
async function removeAllFilesUnder(sb: ReturnType<typeof requireClient>, bucket: string, prefix: string): Promise<void> {
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  if (data?.length) {
    const { error: removeError } = await sb.storage.from(bucket).remove(data.map((f) => `${prefix}/${f.name}`));
    if (removeError) throw removeError;
  }
  const { data: left, error: leftError } = await sb.storage.from(bucket).list(prefix, { limit: 1 });
  if (leftError) throw leftError;
  if (left?.length) throw new Error('files_remaining');
}

/**
 * ลบบัญชีและข้อมูลทั้งหมดของผู้ใช้คนนี้ แล้วออกจากระบบ
 * 1) ผู้ดูแลหลักที่ยังมีคนอื่นอยู่ในบ้าน: ปฏิเสธ (owner_has_members) ต้องมอบบทบาทก่อน
 * 2) ผู้ดูแลหลักที่อยู่คนเดียว: ลบไฟล์แนบของบ้าน แล้วฟังก์ชันฝั่งเซิร์ฟเวอร์ลบบ้านให้
 * 3) ลบไฟล์การปรึกษาของตัวเอง
 * 4) เรียก delete_my_account() ฝั่งเซิร์ฟเวอร์ (supabase/account_delete.sql) ลบบัญชี ข้อมูลส่วนตัว และการปรึกษา
 * ทุกขั้นก่อนข้อ 4 ล้มเหลวได้โดยข้อมูลยังอยู่ครบ
 */
export async function deleteMyAccount(): Promise<void> {
  const c = ctx;
  if (!c) throw new Error('not_authenticated');
  const sb = requireClient();

  if (c.homeId && c.role === 'owner') {
    const { count, error } = await sb
      .from('home_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('home_id', c.homeId);
    if (error) throw error;
    if ((count ?? 0) > 1) throw new Error('owner_has_members');
    await removeAllFilesUnder(sb, 'attachments', c.homeId);
  }

  const { data: sessions, error: sessionError } = await sb.from('consult_sessions').select('id').eq('patient_id', c.userId);
  if (sessionError) throw sessionError;
  for (const session of sessions ?? []) {
    await removeAllFilesUnder(sb, 'consult-files', String(session.id));
  }

  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;

  // บัญชีถูกลบแล้ว: หยุดซิงก์ ออกจากระบบเฉพาะเครื่องนี้ และล้างข้อมูลที่ค้างในเครื่อง
  stopRealtime();
  stopPolling();
  setSyncHandler(null);
  ctx = null;
  await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
  wipeEverythingLocal();
  window.location.replace('/login');
}

/** ล้างข้อมูลทุกอย่างของแอปในเครื่องนี้ (localStorage และไฟล์แนบในเครื่อง) ใช้ตอนลบบัญชี */
export function wipeEverythingLocal(): void {
  wipeLocal();
  for (const db of [FILES_DB, 'growa_consult_files_v1']) {
    try {
      indexedDB.deleteDatabase(db);
    } catch {
      // ล้างไฟล์ในเครื่องไม่ได้: ข้ามได้
    }
  }
}

// ---------- ไฟล์แนบ (Supabase Storage) ----------

const BUCKET = 'attachments';
const pathFor = (id: string) => (ctx?.homeId ? `${ctx.homeId}/${id}` : null);

export const canUseRemoteFiles = (): boolean => !!ctx?.homeId;

export async function uploadAttachment(id: string, blob: Blob): Promise<void> {
  const path = pathFor(id);
  if (!path) throw new Error('no_home');
  const { error } = await requireClient()
    .storage.from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' });
  if (error) throw error;
}

export async function downloadAttachment(id: string): Promise<Blob | null> {
  const path = pathFor(id);
  if (!path || !supabase) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) return null;
  return data;
}

export async function removeAttachment(id: string): Promise<void> {
  const path = pathFor(id);
  if (!path || !supabase) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

export { readAuthUser };
