"use client";

import { motion, useReducedMotion } from "framer-motion";

interface TimerRingProps {
  durationMs: number;
  remainingMs: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function TimerRing({
  durationMs,
  remainingMs,
  size = 80,
  strokeWidth = 8,
  label = "Round timer",
  className = "",
}: TimerRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const offset = circumference * (1 - fraction);
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const urgency = fraction > 0.5 ? "steady" : fraction > 0.25 ? "warning" : "critical";

  const color = urgency === "steady" ? "var(--ftw-success)" : urgency === "warning" ? "var(--ftw-warning)" : "var(--ftw-danger)";
  const urgencyClass = urgency === "steady" ? "border-ftw-success/45" : urgency === "warning" ? "border-ftw-warning/60" : "border-ftw-danger/70";

  return (
    <div
      className={`relative grid place-items-center rounded-full border bg-ftw-raised shadow-ftw-sm shadow-ftw-inset ${urgencyClass} ${className}`}
      role="timer"
      aria-label={`${label}: ${seconds} seconds remaining`}
      aria-live={seconds <= 5 ? "assertive" : "polite"}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--ftw-line)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth * 0.75}
          stroke="var(--ftw-muted)"
          strokeWidth={1}
          fill="none"
          strokeDasharray="3 7"
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
          style={{ strokeDashoffset: offset }}
          animate={prefersReducedMotion ? undefined : { strokeDashoffset: offset }}
          transition={{ duration: 0.16, ease: "linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="ftw-number text-xl leading-none text-ftw-text">{seconds}</span>
        <span className="mt-1 text-[0.55rem] font-black uppercase tracking-[0.25em] text-ftw-muted">sec</span>
      </div>
    </div>
  );
}
