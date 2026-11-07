import { defineConfig } from 'vitest/config';

// การทดสอบไม่เชื่อมฐานข้อมูลจริง: ล้างค่า Supabase ที่อ่านมาจาก .env
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_CONSULT_BACKEND: 'mock' },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
