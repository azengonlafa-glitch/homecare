/// <reference types="vite/client" />

/** วันที่/เวลา build (ISO) ตั้งค่าใน vite.config.ts */
declare const __BUILD_DATE__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
