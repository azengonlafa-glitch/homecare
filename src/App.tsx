import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { MedsPage } from './pages/MedsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CalendarPage } from './pages/CalendarPage';
import { JournalPage } from './pages/JournalPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { HomeSetupPage } from './pages/HomeSetupPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RequireAuth, RequireOnboarding } from './components/auth/RequireOnboarding';
import { HomeSettingsPage } from './pages/HomeSettingsPage';
import { HealthProfilePage } from './pages/HealthProfilePage';
import { MembersPage } from './pages/MembersPage';
import { MemberDetailPage } from './pages/MemberDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacySettingsPage } from './pages/settings/PrivacySettingsPage';
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage';
import { RemindersSettingsPage } from './pages/settings/RemindersSettingsPage';
import { FontSizeSettingsPage } from './pages/settings/FontSizeSettingsPage';

import { ErrorBoundary } from './components/ui/ErrorBoundary';

/** นำทางไปยังหน้าล่าสุดที่ผู้ใช้เคยเข้าชม (ถ้ายังไม่เคยเข้า ให้เปิดหน้าบันทึกอาการเป็นค่าเริ่มต้น) */
const DefaultRouteRedirect: React.FC = () => {
  const lastPath = localStorage.getItem('growa_last_visited_path');
  const target = lastPath && lastPath !== '/' && lastPath !== '' ? lastPath : '/journal';
  return <Navigate to={target} replace />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* เข้าสู่ระบบและสมัครสมาชิก */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* หลังเข้าสู่ระบบ: เข้าร่วมบ้านด้วยรหัสเชิญ หรือสร้างบ้านใหม่ */}
        <Route path="/setup" element={<RequireAuth><HomeSetupPage /></RequireAuth>} />

        {/* ต่อจากนั้น: กรอกข้อมูลสุขภาพพื้นฐาน 7 ขั้น (บังคับ) */}
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        {/* หน้าจอหลักของระบบ (ตั้ง default เป็นหน้าล่าสุดที่เข้าชม) */}
        <Route
          path="/"
          element={
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          }
        >
          <Route index element={<DefaultRouteRedirect />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="meds" element={<MedsPage />} />
          <Route path="home-settings" element={<HomeSettingsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="health" element={<HealthProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        {/* หน้าตั้งค่าและหน้าย่อย (ใช้เลย์เอาต์เดียวกับระบบหลัก) */}
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
          <Route path="reminders" element={<RemindersSettingsPage />} />
          <Route path="privacy" element={<PrivacySettingsPage />} />
          <Route path="font-size" element={<FontSizeSettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
  );
};

export default App;
