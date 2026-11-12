import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

const headerValue = (key: string): string => {
  const config = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const all = config.headers.find((h) => h.source === '/(.*)');
  return all?.headers.find((h) => h.key === key)?.value ?? '';
};

describe('หัวข้อความปลอดภัยของเว็บ (vercel.json)', () => {
  it('นโยบาย CSP อนุญาตสคริปต์ในหน้า index.html ตรงตามแฮชปัจจุบัน', () => {
    // ถ้าแก้สคริปต์ในหน้านี้ แฮชเปลี่ยน เบราว์เซอร์จะบล็อกสคริปต์ ต้องอัปเดตค่าใน vercel.json ด้วย
    const html = read('index.html').replace(/\r\n/g, '\n');
    const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
      (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`
    );
    expect(hashes.length).toBeGreaterThan(0);
    const csp = headerValue('Content-Security-Policy');
    for (const hash of hashes) expect(csp, hash).toContain(hash);
  });

  it('ห้ามให้เว็บอื่นฝังหน้านี้ และห้ามใช้ unsafe-inline กับสคริปต์', () => {
    const csp = headerValue('Content-Security-Policy');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    const tokens = scriptSrc.trim().split(/\s+/);
    expect(tokens).not.toContain("'unsafe-inline'");
    // 'wasm-unsafe-eval' ต้องมีเพื่อให้ตัวอ่านฉลากยา (WebAssembly) ทำงาน แต่ห้าม 'unsafe-eval' ที่เปิดให้รันโค้ดจากข้อความได้
    expect(tokens).not.toContain("'unsafe-eval'");
  });

  it('มีหัวข้อพื้นฐานครบ', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue('X-Frame-Options')).toBe('DENY');
    expect(headerValue('Referrer-Policy')).not.toBe('');
    expect(headerValue('Permissions-Policy')).toContain('camera=(self)');
  });
});
