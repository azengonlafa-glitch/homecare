const INDIGO = {
  50: '#F3F3FD',
  100: '#E7E7FA',
  200: '#D2D2F5',
  300: '#B1B2EE',
  400: '#8E8FE4',
  500: '#7071D6',
  600: '#5E5FCE',
  700: '#5051C3',
  800: '#4142A3',
  900: '#343582',
  950: '#26275E'
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
        // โทนคราม พีช เหลือง ชมพู โค้ดเดิมที่ใช้ purple-* เปลี่ยนตามทั้งแอปจากที่นี่ที่เดียว
        // ตัวอักษร purple-600 ขึ้นไปบนพื้นขาว และตัวอักษรขาวบน purple-600 ขึ้นไป ผ่าน AA ทั้งหมด
        purple: INDIGO,
        primary: { ...INDIGO, DEFAULT: INDIGO[700] },
        // เทาอมครามให้เข้ากับธีม ตัวอักษรยังเข้มพอ
        slate: {
          50: '#F6F6FD',
          100: '#EEEEF9',
          200: '#E1E1F2',
          300: '#CBCBE3',
          400: '#9A9AB9',
          500: '#6A6A8C',
          600: '#52527A',
          700: '#3F3F63',
          800: '#2E2E50',
          900: '#23234F',
          950: '#17173A',
        },
        canvas: '#EEEEFD',
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

