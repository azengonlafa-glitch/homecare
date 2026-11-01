import React from 'react';
import { loadHomeData } from '../lib/storage';
import { Users, AlertTriangle, Pill, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const HomePage: React.FC = () => {
  const data = loadHomeData();

  return (
    <div className="space-y-6">
      {/* การ์ดต้อนรับและสรุปภาพรวมบ้าน */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-800 rounded-3xl p-6 sm:p-8 text-white shadow-md shadow-purple-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs sm:text-sm font-medium bg-purple-600/60 px-3 py-1 rounded-full text-purple-100 uppercase tracking-wide">
              บ้านของคุณ
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2">
              {data.homeName}
            </h1>
            <p className="text-purple-100 text-base sm:text-lg mt-1">
              ดูแลสุขภาพของคนในบ้านอย่างใกล้ชิดและปลอดภัย
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center min-w-[90px]">
              <span className="block text-2xl font-bold">{data.patients.length}</span>
              <span className="text-xs text-purple-200">คนที่ดูแล</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center min-w-[90px]">
              <span className="block text-2xl font-bold">{data.medications.length}</span>
              <span className="text-xs text-purple-200">รายการยา</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 text-center min-w-[90px]">
              <span className="block text-2xl font-bold">{data.appointments.length}</span>
              <span className="text-xs text-purple-200">นัดหมอ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid สำหรับ Responsive Layout: 1 คอลัมน์บนมือถือ, 2 คอลัมน์บนแท็บเล็ต/คอมพิวเตอร์ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* คอลัมน์ซ้าย (7 ส่วนบนจอใหญ่): ข้อมูลผู้รับการดูแลและยาที่ต้องกิน */}
        <div className="lg:col-span-7 space-y-6">
          {/* ส่วนผู้รับการดูแล */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-700" />
                <span>คนที่รับการดูแลในบ้าน</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.patients.map((patient) => (
                <div
                  key={patient.id}
                  className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-900">{patient.name}</span>
                      <span className="text-xs font-semibold bg-white text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                        {patient.relationship} (อายุ {patient.age} ปี)
                      </span>
                    </div>

                    {/* แจ้งเตือนแพ้ยาเด่นชัดเพื่อความปลอดภัย */}
                    {patient.allergies.length > 0 && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2.5">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                          <div className="text-xs text-red-900">
                            <span className="font-bold">ประวัติแพ้ยา: </span>
                            {patient.allergies.map((a, idx) => (
                              <span key={idx}>
                                {a.medicineName} ({a.symptoms})
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ยาที่ต้องกินประจำวัน */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-purple-700" />
                <span>ยาที่ต้องกินประจำวัน</span>
              </h2>
              <Link to="/meds" className="text-sm font-semibold text-purple-700 hover:text-purple-800">
                ดูทั้งหมด ({data.medications.length}) →
              </Link>
            </div>

            <div className="space-y-3">
              {data.medications.slice(0, 3).map((med) => {
                const patient = data.patients.find((p) => p.id === med.patientId);
                return (
                  <div
                    key={med.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-purple-300 transition-all bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Pill className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900">{med.name}</span>
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                            {patient?.name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{med.purpose}</p>
                        <p className="text-xs text-purple-700 font-medium mt-1">
                          ⏰ {med.scheduleTime} • {med.dosage}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="text-xs text-slate-500 block">คงเหลือ</span>
                      <span className="text-sm font-bold text-slate-800">
                        {med.remainingCount} {med.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* คอลัมน์ขวา (5 ส่วนบนจอใหญ่): นัดหมายหมอ และตัวช่วยความจำ */}
        <div className="lg:col-span-5 space-y-6">
          {/* นัดหมายหมอที่ใกล้จะถึง */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-purple-700" />
                <span>นัดหมอที่จะถึงนี้</span>
              </h2>
              <Link to="/appointments" className="text-sm font-semibold text-purple-700 hover:text-purple-800">
                ดูทั้งหมด →
              </Link>
            </div>

            <div className="space-y-3">
              {data.appointments.map((apt) => {
                const patient = data.patients.find((p) => p.id === apt.patientId);
                return (
                  <div
                    key={apt.id}
                    className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-purple-800 bg-purple-200/60 px-2 py-0.5 rounded-md">
                        📅 {apt.date} • {apt.time}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {patient?.name}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-base">{apt.clinicOrDoctor}</p>
                    <p className="text-sm text-slate-600 mt-1">{apt.purpose}</p>
                    {apt.note && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                        ⚠️ บันทึกเตือน: {apt.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ป้ายให้กำลังใจและคำแนะนำการใช้งานง่ายๆ */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-emerald-950 text-base sm:text-lg">
                  แอปใช้งานง่าย สบายใจทั้งบ้าน
                </h3>
                <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
                  ตัวหนังสือขนาดใหญ่ ปุ่มกดชัดเจน ไม่ต้องกลัวกดผิด ข้อมูลบันทึกไว้ในเครื่องของคุณอย่างปลอดภัย
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
