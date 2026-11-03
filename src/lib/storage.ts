import { HomeData, initialHomeData as demoHomeData } from '../data/mockData';
import { cloudEnabled } from '../cloud/client';

/** โหมดคลาวด์ไม่ใช้ข้อมูลตัวอย่าง */
const initialHomeData: HomeData = cloudEnabled
  ? { homeName: '', patients: [], medications: [], appointments: [] }
  : demoHomeData;

const STORAGE_KEY = 'growa_homecare_data_v1';

export function loadHomeData(): HomeData {
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    if (!item) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialHomeData));
      return initialHomeData;
    }
    return JSON.parse(item);
  } catch (err) {
    console.error('Failed to load data from localStorage', err);
    return initialHomeData;
  }
}

export function saveHomeData(data: HomeData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save data to localStorage', err);
  }
}

export function resetHomeData(): HomeData {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialHomeData));
  } catch (err) {
    console.error('Failed to reset data in localStorage', err);
  }
  return initialHomeData;
}

