"use client";

import { motion } from "framer-motion";

interface TimerRingProps {
  durationMs: number;
  remainingMs: number;
  size?: number;
  strokeWidth?: number;
}

export function TimerRing({
  durationMs,
  remainingMs,
  size = 80,
  strokeWidth = 8,
}: TimerRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const offset = circumference * (1 - fraction);

  const color =
    fraction > 0.5 ? "#22c55e" : fraction > 0.25 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#374151"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {Math.ceil(remainingMs / 1000)}
      </div>
    </div>
  );
}
