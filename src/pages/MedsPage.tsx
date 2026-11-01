import React, { useState } from 'react';
import { loadHomeData } from '../lib/storage';
import { Pill, Clock, AlertCircle, Check, Search } from 'lucide-react';

export const MedsPage: React.FC = () => {
  const data = loadHomeData();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredMeds = data.medications.filter((med) => {
    const matchesPatient = selectedPatientId === 'all' || med.patientId === selectedPatientId;
    const matchesSearch = med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          med.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPatient && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ส่วนหัวหน้าตู้ยา */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            ตู้ยาประจำบ้าน
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1">
            รายการยาทั้งหมด {data.medications.length} ชนิด พร้อมคำอธิบายแบบเข้าใจง่าย
          </p>
        </div>

        {/* ช่องค้นหายา */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อยาหรืออาการ..."
            className="w-full min-h-[48px] pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm shadow-xs"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* แถบตัวกรองเลือกตามคนกินยา: ปุ่มสูงอย่างน้อย 48px สำหรับผู้สูงอายุ */}
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
          ทั้งหมด ({data.medications.length})
        </button>

        {data.patients.map((patient) => {
          const count = data.medications.filter((m) => m.patientId === patient.id).length;
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

      {/* Grid แสดงรายการยา: 1 คอลัมน์บนมือถือ, 2 คอลัมน์บนแท็บเล็ต, 3 คอลัมน์บนจอคอมพิวเตอร์ */}
      {filteredMeds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMeds.map((med) => {
            const patient = data.patients.find((p) => p.id === med.patientId);
            const isLow = med.remainingCount <= 15;

            return (
              <div
                key={med.id}
                className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* แถบด้านบน: ชื่อคนกินยา และสถานะคงเหลือ */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full">
                      {patient?.name}
                    </span>

                    {isLow ? (
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        ใกล้หมด
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
                        มียาพอทาน
                      </span>
                    )}
                  </div>

                  {/* ชื่อยาและสรรพคุณแบบภาษาเข้าใจง่าย */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <Pill className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                        {med.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {med.purpose}
                      </p>
                    </div>
                  </div>

                  {/* กล่องข้อมูลเวลากินและขนาดยา */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-2 mb-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-purple-600" /> เวลากิน
                      </span>
                      <span className="font-semibold text-slate-900">{med.scheduleTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">ปริมาณ</span>
                      <span className="font-semibold text-slate-900">{med.dosage}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200/60 text-xs text-slate-600">
                      👉 {med.instruction}
                    </div>
                  </div>
                </div>

                {/* แถวล่างสุด: จำนวนยาคงเหลือ */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">จำนวนคงเหลือ</span>
                    <span className={`text-base font-bold ${isLow ? 'text-amber-700' : 'text-slate-900'}`}>
                      {med.remainingCount} {med.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert(`บันทึกแล้ว: กินยา ${med.name} เรียบร้อย`)}
                    className="min-h-[44px] px-4 py-2 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-800 font-semibold rounded-xl text-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>กินแล้ว</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <Pill className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">ไม่พบรายการยาที่ค้นหา</p>
        </div>
      )}
    </div>
  );
};
