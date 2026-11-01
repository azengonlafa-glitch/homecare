import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export const PasswordToggle: React.FC<PasswordToggleProps> = ({ visible, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
    aria-pressed={visible}
    className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer"
  >
    {visible ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
  </button>
);
