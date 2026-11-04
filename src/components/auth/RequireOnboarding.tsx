import React from 'react';
import { Navigate } from 'react-router-dom';
import { isOnboardingDone } from '../../lib/onboarding';
import { cloudEnabled } from '../../cloud/client';
import { readAuthUser } from '../../cloud/identity';
import { hasHome } from '../../cloud/engine';
import { loadHomeSetup } from '../../lib/homeSetup';

/**
 * ด่านก่อนเข้าใช้งาน (โหมดคลาวด์): ต้องเข้าสู่ระบบ -> มีบ้าน -> กรอกข้อมูลพื้นฐานครบ
 * โหมดต้นแบบ: ต้องสร้างหรือเข้าร่วมบ้านก่อน
 */
export const RequireOnboarding: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loggedIn = !!readAuthUser();
  if (cloudEnabled) {
    if (!loggedIn) return <Navigate to="/login" replace />;
    if (!hasHome()) return <Navigate to="/setup" replace />;
  } else if (!loadHomeSetup()) {
    return <Navigate to="/setup" replace />;
  }
  if (loggedIn && !isOnboardingDone()) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

/** หน้าที่ต้องเข้าสู่ระบบก่อน (เช่น ตั้งค่าบ้าน กรอกข้อมูลพื้นฐาน) เฉพาะโหมดคลาวด์ */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (cloudEnabled && !readAuthUser()?.id) return <Navigate to="/login" replace />;
  return <>{children}</>;
};
