/** เขียว growa (ปุ่มหลักและสีเด่นของแอป) 600 ขึ้นไปบนพื้นขาว และตัวอักษรขาวบน 600 ขึ้นไป ผ่าน AA */
const GROWA = {
  50: '#F0FAF2',
  100: '#DCF3E1',
  200: '#BDE6C8',
  300: '#8FD3A3',
  400: '#5DBB7C',
  500: '#2F9E5C',
  600: '#18813F',
  700: '#15703A',
  800: '#115C30',
  900: '#0E4A27',
  950: '#08301A'
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', 'sans-serif'],
        // หัวข้อทรงเรียบ เป็นมิตร ไม่กลมจนตัวหนังสือดูตัน
        display: ['Anuphan', '"IBM Plex Sans Thai"', 'sans-serif'],
      },
      colors: {
        // ธีมร้านชำ growa: เขียวเป็นสีหลัก กระดาษครีม ผ้าลายตาราง (กิงแฮม) สีต่างกันตามหมวด
        // โค้ดเดิมที่ใช้ purple-* เปลี่ยนเป็นเขียวทั้งแอปจากที่นี่ที่เดียว
        purple: GROWA,
        primary: { ...GROWA, DEFAULT: GROWA[700] },
        // เทาอมเขียวใบหญ้าให้เข้ากับพื้นหลังทุ่งปิกนิก ตัวอักษรยังเข้มพอ
        slate: {
          50: '#F6FAF5',
          100: '#EBF3EA',
          200: '#DAE7D8',
          300: '#BFD1BC',
          400: '#8FA58C',
          500: '#5A6F57',
          600: '#4C6049',
          700: '#3A4B38',
          800: '#2A382A',
          900: '#1E2A20',
          950: '#121B14',
        },
        canvas: '#DDF1FF',
        peach: { DEFAULT: '#FFE7D0', soft: '#FFF4E8' },
        sun: { DEFAULT: '#FFD25E', soft: '#FFF1C9' },
        coral: { DEFAULT: '#F58FA5', soft: '#FDE4EA' },
        mint: { DEFAULT: '#8FEBD6', soft: '#DDF6F0' },
        sky: { DEFAULT: '#A3CFFF', soft: '#E3F0FF' },
        surface: {
          light: '#FAFAFE',
          DEFAULT: '#FFFFFF',
          dark: '#0F172A',
        },
        contrast: {
          high: '#0F172A',
          medium: '#475569',
          border: '#E2E8F0',
        }
      },
      // ใช้ rem เพื่อให้ขนาดตัวอักษรทั้งแอปขยายตามค่า html font-size
      // (ตัวอักษรหลักที่ขนาดปกติ = 18px, หน้า "ตั้งค่า > ขนาดตัวอักษร" ปรับได้ 18/22/26px)
      fontSize: {
        // ตัวอักษรเล็กสุดของแอป 14.4px (ค่าเริ่มต้นของ Tailwind 13.5px เล็กเกินไปสำหรับผู้สูงอายุ)
        xs: ['0.8rem', { lineHeight: '1.2rem' }],
        sm: ['0.8889rem', { lineHeight: '1.3333rem' }],
        base: ['1rem', { lineHeight: '1.5556rem' }],
        lg: ['1.1111rem', { lineHeight: '1.6667rem' }],
        xl: ['1.3333rem', { lineHeight: '1.7778rem' }],
        '2xl': ['1.5556rem', { lineHeight: '2rem' }],
        '3xl': ['1.7778rem', { lineHeight: '2.2222rem' }],
      },
      minHeight: {
        // ขนาดสัมผัสของปุ่มอย่างน้อย 48px สำหรับผู้สูงอายุ
        button: '48px',
        touch: '48px',
      },
      spacing: {
        12: '48px', // ปุ่ม 48px
      }
    },
  },
  plugins: [],
};

