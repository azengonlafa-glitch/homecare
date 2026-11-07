import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { Mascot } from './Mascot';

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <Card className="py-12 text-center">
    <Mascot kind="cloud" mood="sleepy" className="mx-auto mb-3 h-24 w-24" />
    <p className="text-slate-600 font-medium">{message}</p>
  </Card>
);
