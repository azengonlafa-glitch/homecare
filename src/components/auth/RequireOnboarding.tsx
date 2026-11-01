import React from 'react';
import { Navigate } from 'react-router-dom';
import { isOnboardingDone } from '../../lib/onboarding';

/**
 * ด่านบังคับกรอกข้อมูลพื้นฐาน: ผู้ใช้ที่ล็อกอินแล้วแต่ยังไม่กรอกข้อมูล (หรือยังไม่กดข้ามตอน dev)
 * จะถูกส่งไปหน้า /onboarding ผู้เยี่ยมชมที่ยังไม่ล็อกอินผ่านได้ตามปกติ
 */
export const RequireOnboarding: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loggedIn = !!localStorage.getItem('growa_auth_user');
  if (loggedIn && !isOnboardingDone()) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};
