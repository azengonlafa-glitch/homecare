import React, { useState } from 'react';
import { loadHomeData } from '../lib/storage';
import { Calendar, Clock, MapPin, AlertCircle, Plus } from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const data = loadHomeData();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('all');

  const filteredAppointments = data.appointments.filter((apt) => {
    return selectedPatientId === 'all' || apt.patientId === selectedPatientId;
  });

  return (
    <div className="space-y-6">
      {/* ส่วนหัวหน้าจอนัดหมอ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            ตารางนัดหมอ
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1">
            เตือนความจำวันพบแพทย์และสิ่งที่ต้องเตรียมตัวสำหรับทุกคนในบ้าน
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert('ระบบต้นแบบ: เพิ่มการนัดหมายใหม่จะเปิดให้ทดสอบในขั้นตอนถัดไป')}
          className="min-h-[48px] px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-2xl transition-all shadow-sm shadow-purple-200 flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-5 h-5" />
          <span>เพิ่มวันนัดหมอ</span>
        </button>
      </div>

      {/* แถบตัวกรองคนในบ้าน */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedPatientId('all')}
          className={`min-h-[48px] px-5 py-2 rounded-2xl text-base font-semibold transition-all cursor-pointer whitespace-nowrap ${
            selectedPatientId === 'all'
              ? 'bg-purple-700 text-white shadow-sm shadow-purple-200'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          ทั้งหมด ({data.appointments.length})
        </button>

        {data.patients.map((patient) => {
          const count = data.appointments.filter((a) => a.patientId === patient.id).length;
          const isSelected = selectedPatientId === patient.id;
          return (
            <button
              key={patient.id}
              type="button"
              onClick={() => setSelectedPatientId(patient.id)}
              className={`min-h-[48px] px-5 py-2 rounded-2xl text-base font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-purple-700 text-white shadow-sm shadow-purple-200'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {patient.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid แสดงรายการนัดหมอ: 1 คอลัมน์บนมือถือ, 2 คอลัมน์บนจอแท็บเล็ตและคอมพิวเตอร์ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredAppointments.map((apt) => {
          const patient = data.patients.find((p) => p.id === apt.patientId);

          return (
            <div
              key={apt.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* แถบวันและเวลา */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-purple-800 block">
                        {apt.date}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> เวลา {apt.time}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full">
                    {patient?.name}
                  </span>
                </div>

                {/* สถานที่พบแพทย์ */}
                <div className="mb-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {apt.clinicOrDoctor}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 pl-7">
                    {apt.purpose}
                  </p>
                </div>

                {/* กล่องข้อความเตือนพิเศษก่อนไปพบแพทย์ */}
                {apt.note && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mt-4">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-amber-900 block">
                          ข้อควรจำก่อนไปโรงพยาบาล:
                        </span>
                        <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
                          {apt.note}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ปุ่มการทำงาน */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  เตือนล่วงหน้า 1 วัน
                </span>
                <button
                  type="button"
                  onClick={() => alert(`บันทึกในปฏิทิน: นัดหมอวันที่ ${apt.date}`)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                >
                  เพิ่มลงปฏิทิน
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
