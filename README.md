# Growa Homecare (โกรว่า โฮมแคร์)

เว็บแอปพลิเคชันสำหรับอุปกรณ์มือถือ เพื่อช่วยครอบครัวไทยดูแลยาของผู้สูงอายุหรือคนที่กินยาประจำ ออกแบบเน้นความง่ายในการใช้งาน ตัวอักษรขนาดใหญ่อ่านง่าย คอนทราสต์สูง และไม่ใช้คำศัพท์ทางการแพทย์ที่เข้าใจยาก

---

## สแต็กเทคโนโลยี
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS (Custom Design Tokens เพื่อผู้สูงอายุ)
- **Routing:** React Router DOM (v6)
- **Font:** IBM Plex Sans Thai (Google Fonts)
- **Data & State:** React State + `localStorage` (ไม่มี backend ไม่เก็บข้อมูลส่วนบุคคล)

---

## ข้อกำหนดการออกแบบ (Design Tokens)
- **สีหลัก (Primary):** สีส้มอิฐอบอุ่น (`#EA580C` / Orange 600) สบายตาและสังเกตง่าย
- **ขนาดตัวอักษร:** เริ่มต้นที่ `18px` (base) ขึ้นไป เพื่อให้อ่านสบายตา
- **ขนาดปุ่มและจุดสัมผัส:** ความสูงขั้นต่ำ `48px` (ตามมาตรฐานการเข้าถึง WCAG / Touch Target)
- **คอนทราสต์:** ใช้สีพื้นหลังขาว/เทาอ่อนมาก ตัดกับตัวอักษรสีเทาเข้มเกือบดำ (`#0F172A`)

---

## โครงสร้างโฟลเดอร์
```text
src/
├── components/         # คอมโพเนนต์ที่ใช้ร่วมกัน (รวม layout และ bottom bar)
│   └── layout/
│       └── AppLayout.tsx
├── pages/              # หน้าจอหลัก (3 แท็บตามเมนูล่าง)
│   ├── HomePage.tsx
│   ├── MedsPage.tsx
│   └── AppointmentsPage.tsx
├── data/               # ข้อมูลจำลองภาษาไทย
│   └── mockData.ts
├── lib/                # ตัวช่วยจัดการข้อมูล localStorage
│   └── storage.ts
├── App.tsx             # ตั้งค่าเส้นทาง Router
├── index.css           # Tailwind base & custom styles
└── main.tsx            # จุดเริ่มต้นแอป
```

---

## วิธีติดตั้งและเริ่มใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รันโหมดทดสอบ (Development)
```bash
npm run dev
```

### 3. ตรวจสอบและ Build สำหรับ Production
```bash
npm run build
```

---

## วิธีเปิดทดสอบบนมือถือจริง

### วิธีที่ 1: ผ่านเครือข่าย Wi-Fi เดียวกัน (Local LAN)
1. ให้คอมพิวเตอร์และมือถือเชื่อมต่อ Wi-Fi วงเดียวกัน
2. รันคำสั่ง:
   ```bash
   npm run dev -- --host
   ```
3. หน้าจอเทอร์มินัลจะแสดงลิงก์ Network เช่น `http://192.168.x.x:5173`
4. นำ URL ดังกล่าวไปเปิดในเบราว์เซอร์บนมือถือ (Safari หรือ Chrome)
5. *ข้อแนะนำ:* สามารถกด "Add to Home Screen" (เพิ่มไปยังหน้าจอโฮม) เพื่อทดสอบแบบเสมือนแอปจริงได้

### วิธีที่ 2: ผ่าน Vercel Preview (ออนไลน์)
1. Push โค้ดขึ้น GitHub repository: `https://github.com/azengonlafa-glitch/homecare.git`
2. เชื่อมต่อโปรเจกต์นี้ใน [Vercel](https://vercel.com)
3. ระบบจะ Build ให้อัตโนมัติ (ตามไฟล์ `vercel.json` ที่เตรียมไว้)
4. เปิดลิงก์ที่ Vercel มอบให้บนมือถือได้ทุกที่ ทุกเครือข่าย

---

## นโยบายความปลอดภัยและความเป็นส่วนตัว
- **ไม่มีการจัดเก็บข้อมูลส่วนบุคคล (Zero PII):** ข้อมูลผู้ป่วยและยาในแอปเป็นข้อมูลสมมติทั้งหมด
- **ทำงานบนเครื่องผู้ใช้ (Client-Side Only):** บันทึกการเปลี่ยนแปลงลงใน `localStorage` ของเบราว์เซอร์ผู้ใช้เท่านั้น
- **ไม่มี Token หรือ API Key:** หากในอนาคตจำเป็นต้องใช้บริการภายนอก ให้ตั้งค่าผ่านไฟล์ `.env` บนเครื่องของท่าน และกำหนด Environment Variables บน Vercel เท่านั้น

