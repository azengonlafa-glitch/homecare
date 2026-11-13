import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { MedsPage } from './pages/MedsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CalendarPage } from './pages/CalendarPage';
import { JournalPage } from './pages/JournalPage';
import { MenuPage } from './pages/MenuPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { HomeSetupPage } from './pages/HomeSetupPage';
const OnboardingPage = lazyNamed(() => import('./pages/OnboardingPage'), 'OnboardingPage');
import { RequireAuth, RequireOnboarding } from './components/auth/RequireOnboarding';
import { HomeSettingsPage } from './pages/HomeSettingsPage';
const HealthProfilePage = lazyNamed(() => import('./pages/HealthProfilePage'), 'HealthProfilePage');
const FoldersPage = lazyNamed(() => import('./pages/FoldersPage'), 'FoldersPage');
const FolderDetailPage = lazyNamed(() => import('./pages/FolderDetailPage'), 'FolderDetailPage');
import { MembersPage } from './pages/MembersPage';
import { MemberDetailPage } from './pages/MemberDetailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
const PrivacySettingsPage = lazyNamed(() => import('./pages/settings/PrivacySettingsPage'), 'PrivacySettingsPage');
const ProfileSettingsPage = lazyNamed(() => import('./pages/settings/ProfileSettingsPage'), 'ProfileSettingsPage');
const RemindersSettingsPage = lazyNamed(() => import('./pages/settings/RemindersSettingsPage'), 'RemindersSettingsPage');
const FontSizeSettingsPage = lazyNamed(() => import('./pages/settings/FontSizeSettingsPage'), 'FontSizeSettingsPage');
const DataSettingsPage = lazyNamed(() => import('./pages/settings/DataSettingsPage'), 'DataSettingsPage');
const PrivacyPolicyPage = lazyNamed(() => import('./pages/PrivacyPolicyPage'), 'PrivacyPolicyPage');
const TermsPage = lazyNamed(() => import('./pages/TermsPage'), 'TermsPage');

const ConsultShell = lazyNamed(() => import('./pages/consult/ConsultShell'), 'ConsultShell');
const ConsultHomePage = lazyNamed(() => import('./pages/consult/ConsultHomePage'), 'ConsultHomePage');
const CheckinPage = lazyNamed(() => import('./pages/consult/CheckinPage'), 'CheckinPage');
const ReviewConsentPage = lazyNamed(() => import('./pages/consult/ReviewConsentPage'), 'ReviewConsentPage');
const ConsultRoomPage = lazyNamed(() => import('./pages/consult/ConsultRoomPage'), 'ConsultRoomPage');
const ProviderPublicPage = lazyNamed(() => import('./pages/consult/ProviderPublicPage'), 'ProviderPublicPage');
const ConsultHistoryPage = lazyNamed(() => import('./pages/consult/ConsultHistoryPage'), 'ConsultHistoryPage');
const FollowUpPage = lazyNamed(() => import('./pages/consult/FollowUpPage'), 'FollowUpPage');
const StaffShell = lazyNamed(() => import('./pages/pharmacist/StaffShell'), 'StaffShell');
const AdminShell = lazyNamed(() => import('./pages/admin/AdminShell'), 'AdminShell');
const AdminListPage = lazyNamed(() => import('./pages/admin/AdminListPage'), 'AdminListPage');
const AdminProviderPage = lazyNamed(() => import('./pages/admin/AdminProviderPage'), 'AdminProviderPage');
const AdminProviderFormPage = lazyNamed(() => import('./pages/admin/AdminProviderFormPage'), 'AdminProviderFormPage');
const ConsolePlaceholder = lazyNamed(() => import('./pages/pharmacist/PharmacistConsolePage'), 'ConsolePlaceholder');
const PharmacistConsolePage = lazyNamed(() => import('./pages/pharmacist/PharmacistConsolePage'), 'PharmacistConsolePage');
const PharmacistWorkspaceRoute = lazyNamed(() => import('./pages/pharmacist/PharmacistWorkspacePage'), 'PharmacistWorkspaceRoute');
const StaffDashboardPage = lazyNamed(() => import('./pages/pharmacist/StaffDashboardPage'), 'StaffDashboardPage');

import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { lazyNamed } from './lib/lazyNamed';
import { PageLoading } from './components/ui/PageLoading';

/** นำทางไปยังหน้าล่าสุดที่ผู้ใช้เคยเข้าชม (ถ้ายังไม่เคยเข้า ให้เปิดหน้าบันทึกอาการเป็นค่าเริ่มต้น) */
const DefaultRouteRedirect: React.FC = () => {
  const lastPath = localStorage.getItem('growa_last_visited_path');
  const target = lastPath && lastPath !== '/' && lastPath !== '' ? lastPath : '/journal';
  return <Navigate to={target} replace />;
};

/** ที่อยู่ที่ไม่มีจริง: ลืมที่อยู่นี้ไม่ให้เป็น "หน้าล่าสุด" แล้วไปหน้าบันทึกอาการ */
const NotFoundRedirect: React.FC = () => {
  try {
    localStorage.removeItem('growa_last_visited_path');
  } catch {
    // ข้ามได้
  }
  return <Navigate to="/journal" replace />;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoading />}>
        <Routes>
        {/* เข้าสู่ระบบและสมัครสมาชิก */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        {/* นโยบายความเป็นส่วนตัว: อ่านได้โดยไม่ต้องล็อกอิน */}
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        {/* ข้อกำหนดการใช้งาน: อ่านได้โดยไม่ต้องล็อกอิน */}
        <Route path="/terms" element={<TermsPage />} />

        {/* หลังเข้าสู่ระบบ: เข้าร่วมบ้านด้วยรหัสเชิญ หรือสร้างบ้านใหม่ */}
        <Route path="/setup" element={<RequireAuth><HomeSetupPage /></RequireAuth>} />

        {/* ต่อจากนั้น: กรอกข้อมูลสุขภาพพื้นฐาน 7 ขั้น (บังคับ) */}
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        {/* พื้นที่เภสัชกร/คลินิก: แยกจากหน้าผู้ใช้ และไม่ต้องมีบ้าน */}
        <Route path="/pharmacist" element={<StaffShell />}>
          <Route path="dashboard" element={<StaffDashboardPage />} />
          <Route element={<PharmacistConsolePage />}>
            <Route index element={<ConsolePlaceholder />} />
            <Route path=":id" element={<PharmacistWorkspaceRoute />} />
          </Route>
        </Route>

        {/* แอดมิน: จัดการผู้ให้บริการและบัญชีเจ้าหน้าที่ */}
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminListPage />} />
          <Route path="providers/new" element={<AdminProviderFormPage />} />
          <Route path="providers/:id" element={<AdminProviderPage />} />
          <Route path="providers/:id/edit" element={<AdminProviderFormPage />} />
        </Route>

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
          <Route path="menu" element={<MenuPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="meds" element={<MedsPage />} />
          <Route path="home-settings" element={<HomeSettingsPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="health" element={<HealthProfilePage />} />
          <Route path="folders" element={<FoldersPage />} />
          <Route path="folders/:id" element={<FolderDetailPage />} />
          <Route path="consult" element={<ConsultShell />}>
            <Route index element={<ConsultHomePage />} />
            <Route path="providers/:id" element={<ProviderPublicPage />} />
            <Route path="checkin" element={<CheckinPage />} />
            <Route path="review" element={<ReviewConsentPage />} />
            <Route path="room/:id" element={<ConsultRoomPage />} />
            <Route path="history" element={<ConsultHistoryPage />} />
            <Route path="followup/:id" element={<FollowUpPage />} />
            {/* พิมพ์ที่อยู่ผิดบ่อย: พาไปหน้าทีมงาน/แอดมินที่ถูกต้อง */}
            <Route path="pharmacist/*" element={<Navigate to="/pharmacist" replace />} />
            <Route path="admin/*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="pharmacy/*" element={<Navigate to="/pharmacist" replace />} />
          {/* ที่อยู่ที่ไม่มีจริง: ไปหน้าบันทึกอาการตรง ๆ (ไม่ผ่าน "/" เพราะ "/" พากลับไปหน้าล่าสุด ซึ่งอาจเป็นที่อยู่ผิดนี้เอง แล้ววนไม่จบ) */}
          <Route path="*" element={<NotFoundRedirect />} />
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
          <Route path="data" element={<DataSettingsPage />} />
        </Route>
      </Routes>
        </Suspense>
    </BrowserRouter>
  </ErrorBoundary>
  );
};

export default App;
