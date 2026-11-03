import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * โหมดคลาวด์เปิดเมื่อตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env
 * ถ้าไม่ตั้งค่า แอปจะทำงานแบบต้นแบบเดิม (เก็บในเครื่อง + ปุ่ม Demo)
 */
export const cloudEnabled = !!url && !!anonKey;

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('cloud-disabled');
  return supabase;
}
