'use client';

import { useState, useEffect } from 'react';

const GEAR_FRAMES = ['⚙', '⛭', '⚙', '⛮', '⚙', '⛭', '⛮', '⚙'];
const FRAME_DURATION = 120; // ms per frame

interface GearSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function GearSpinner({ size = 'md', className = '' }: GearSpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % GEAR_FRAMES.length);
    }, FRAME_DURATION);
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <span className={`text-amber-400 font-mono ${sizeClasses[size]} ${className}`}>
      {GEAR_FRAMES[frame]}
    </span>
  );
}
