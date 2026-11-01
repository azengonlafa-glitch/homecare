import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { MedsPage } from './pages/MedsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { HomeSetupPage } from './pages/HomeSetupPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* หน้า Login และ Sign up แบบ Clean UI */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* หลังเข้าสู่ระบบ: เข้าร่วมบ้านด้วยรหัสเชิญ หรือสร้างบ้านใหม่ */}
        <Route path="/setup" element={<HomeSetupPage />} />

        {/* หน้าจอหลักของแอปที่มีเมนูล่าง 3 แท็บ */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="meds" element={<MedsPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

