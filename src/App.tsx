import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { MedsPage } from './pages/MedsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CalendarPage } from './pages/CalendarPage';
import { JournalPage } from './pages/JournalPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { HomeSetupPage } from './pages/HomeSetupPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RequireOnboarding } from './components/auth/RequireOnboarding';
import { SettingsPage } from './pages/SettingsPage';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage';
import { HomeCodeSettingsPage } from './pages/settings/HomeCodeSettingsPage';
import { MembersSettingsPage } from './pages/settings/MembersSettingsPage';
import { RemindersSettingsPage } from './pages/settings/RemindersSettingsPage';
import { FontSizeSettingsPage } from './pages/settings/FontSizeSettingsPage';
import { PharmacySettingsPage } from './pages/settings/PharmacySettingsPage';
import { AboutSettingsPage } from './pages/settings/AboutSettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* หน้า Login และ Sign up แบบ Clean UI */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* หลังเข้าสู่ระบบ: เข้าร่วมบ้านด้วยรหัสเชิญ หรือสร้างบ้านใหม่ */}
        <Route path="/setup" element={<HomeSetupPage />} />

        {/* ต่อจากนั้น: กรอกข้อมูลสุขภาพพื้นฐาน 7 ขั้น (บังคับ ยกเว้นกดข้ามตอน dev) */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* หน้าจอหลักของแอปที่มีเมนูล่าง 3 แท็บ */}
        <Route
          path="/"
          element={
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="meds" element={<MedsPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* หน้าตั้งค่าและหน้าย่อย (ใช้เลย์เอาต์เดียวกับหน้าหลัก) */}
        <Route
          path="/settings"
          element={
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          }
        >
          <Route index element={<SettingsPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="home" element={<HomeCodeSettingsPage />} />
          <Route path="members" element={<MembersSettingsPage />} />
          <Route path="reminders" element={<RemindersSettingsPage />} />
          <Route path="font-size" element={<FontSizeSettingsPage />} />
          <Route path="pharmacy" element={<PharmacySettingsPage />} />
          <Route path="about" element={<AboutSettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

