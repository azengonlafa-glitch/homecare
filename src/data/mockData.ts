export interface Medication {
  id: string;
  patientId: string;
  name: string;             // ชื่อยา เช่น ยาลดความดัน (แอมโลดิพีน)
  purpose: string;          // สรรพคุณแบบภาษาชาวบ้าน เช่น ช่วยลดความดันโลหิต
  dosage: string;           // ขนาด เช่น 1 เม็ด (5 มิลลิกรัม)
  scheduleTime: string;     // เวลา เช่น เช้า 08:00 น.
  instruction: string;      // วิธีทาน เช่น หลังอาหารเช้า ทันที
  remainingCount: number;   // จำนวนคงเหลือ
  unit: string;             // หน่วยนับ เช่น เม็ด, แคปซูล
  colorBadge?: string;      // แถบสีช่วยจำ
}

export interface AllergyHistory {
  medicineName: string;     // ชื่อยาที่แพ้
  symptoms: string;         // อาการ เช่น เกิดผื่นคัน คันคอ หายใจติดขัด
  severity: 'high' | 'medium';
}

export interface Patient {
  id: string;
  name: string;             // เช่น พ่อสมชาย, แม่สมศรี
  relationship: string;     // พ่อ, แม่
  age: number;
  allergies: AllergyHistory[];
}

export interface DoctorAppointment {
  id: string;
  patientId: string;
  clinicOrDoctor: string;   // เช่น คลินิกความดันสูง / รพ. ใกล้บ้าน
  purpose: string;          // เหตุผลการนัด เช่น นัดตรวจเลือดและรับยาประจำ
  date: string;             // วันที่นัด เช่น 15 พฤศจิกายน 2569
  time: string;             // เช่น 09:00 น.
  note: string;             // บันทึกช่วยจำ เช่น งดน้ำงดอาหารหลังเที่ยงคืน
}

export interface HomeData {
  homeName: string;
  patients: Patient[];
  medications: Medication[];
  appointments: DoctorAppointment[];
}

export const initialHomeData: HomeData = {
  homeName: "บ้านสุขใจ (ครอบครัว)",
  patients: [
    {
      id: "p1",
      name: "พ่อสมชาย",
      relationship: "คุณพ่อ",
      age: 72,
      allergies: [
        {
          medicineName: "เพนิซิลลิน (ยาฆ่าเชื้อ)",
          symptoms: "ผื่นแดงคันทั้งตัว แน่นหน้าอก หายใจลำบาก",
          severity: "high"
        }
      ]
    },
    {
      id: "p2",
      name: "แม่สมศรี",
      relationship: "คุณแม่",
      age: 68,
      allergies: [
        {
          medicineName: "แอสไพริน (ยาแก้ปวด)",
          symptoms: "ปวดท้อง คลื่นไส้ แน่นคอ",
          severity: "high"
        }
      ]
    }
  ],
  medications: [
    {
      id: "m1",
      patientId: "p1",
      name: "ยาลดความดัน",
      purpose: "ช่วยคุมระดับความดันโลหิตให้อยู่ในเกณฑ์ปกติ",
      dosage: "1 เม็ด (5 มิลลิกรัม)",
      scheduleTime: "เช้า (08:00 น.)",
      instruction: "กินหลังอาหารเช้าทันที ดื่มน้ำตามมากๆ",
      remainingCount: 28,
      unit: "เม็ด",
      colorBadge: "bg-blue-100 text-blue-800 border-blue-300"
    },
    {
      id: "m2",
      patientId: "p1",
      name: "ยาเบาหวาน",
      purpose: "ช่วยควบคุมระดับน้ำตาลในเลือด",
      dosage: "1 เม็ด (500 มิลลิกรัม)",
      scheduleTime: "เช้า (08:00 น.) และ เย็น (18:00 น.)",
      instruction: "กินพร้อมมื้ออาหาร หรือหลังอาหารทันที",
      remainingCount: 14,
      unit: "เม็ด",
      colorBadge: "bg-amber-100 text-amber-800 border-amber-300"
    },
    {
      id: "m3",
      patientId: "p1",
      name: "ยาลดไขมัน",
      purpose: "ช่วยลดไขมันตัวไม่ดีในเส้นเลือด",
      dosage: "1 เม็ด (20 มิลลิกรัม)",
      scheduleTime: "ก่อนนอน (20:30 น.)",
      instruction: "กินก่อนนอนเป็นประจำทุกวัน",
      remainingCount: 30,
      unit: "เม็ด",
      colorBadge: "bg-purple-100 text-purple-800 border-purple-300"
    },
    {
      id: "m4",
      patientId: "p2",
      name: "ยาบำรุงกระดูกและข้อ (แคลเซียม)",
      purpose: "เสริมสร้างความแข็งแรงของกระดูก",
      dosage: "1 เม็ด",
      scheduleTime: "เช้า (08:00 น.)",
      instruction: "กินหลังอาหารเช้า เคี้ยวให้ละเอียดก่อนกลืน",
      remainingCount: 42,
      unit: "เม็ด",
      colorBadge: "bg-emerald-100 text-emerald-800 border-emerald-300"
    },
    {
      id: "m5",
      patientId: "p2",
      name: "น้ำตาเทียม (ชนิดรายวัน)",
      purpose: "ช่วยเพิ่มความชุ่มชื้น ลดอาการตาแห้งระคายเคือง",
      dosage: "1 หลอด (หยอดข้างละ 1-2 หยด)",
      scheduleTime: "เช้า (08:00 น.) และ บ่าย (13:00 น.)",
      instruction: "ล้างมือก่อนหยอด และเปิดใช้แล้วทิ้งภายในวันเดียว",
      remainingCount: 20,
      unit: "หลอด",
      colorBadge: "bg-cyan-100 text-cyan-800 border-cyan-300"
    }
  ],
  appointments: [
    {
      id: "a1",
      patientId: "p1",
      clinicOrDoctor: "โรงพยาบาลประจำอำเภอ (คลินิกเบาหวาน)",
      purpose: "นัดเจาะเลือดตรวจค่าน้ำตาลและความดันประจำ 3 เดือน",
      date: "15 พฤศจิกายน 2569",
      time: "08:30 น.",
      note: "งดน้ำและอาหารหลังเที่ยงคืน นำสมุดยาไปด้วย"
    },
    {
      id: "a2",
      patientId: "p2",
      clinicOrDoctor: "โรงพยาบาลศูนย์ (แผนกกระดูกและข้อ)",
      purpose: "ตรวจติดตามอาการปวดเข่าและรับยาบำรุงข้อ",
      date: "28 พฤศจิกายน 2569",
      time: "10:00 น.",
      note: "สวมกางเกงที่พับขาสะดวกเพื่อตรวจหัวเข่า"
    }
  ]
};
