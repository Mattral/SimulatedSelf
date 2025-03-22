
import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  floatEffect?: boolean;
}

const GlassCard = ({ 
  children, 
  className, 
  hoverEffect = false, 
  floatEffect = false,
  ...props 
}: GlassCardProps) => {
  return (
    <div 
      className={cn(
        'glass-card p-6 transition-all duration-300 ease-in-out overflow-hidden',
        hoverEffect && 'hover:shadow-2xl hover:bg-white/20 hover:translate-y-[-5px]',
        floatEffect && 'animate-float',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
