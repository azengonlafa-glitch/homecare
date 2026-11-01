import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, message }) => (
  <Card className="py-12 text-center">
    <Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
    <p className="text-slate-600 font-medium">{message}</p>
  </Card>
);
