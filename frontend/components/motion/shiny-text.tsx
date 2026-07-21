"use client";

import { useReducedMotion } from "framer-motion";

interface ShinyTextProps {
  text: string;
  className?: string;
  /** Seconds per sheen sweep. */
  speed?: number;
}

/**
 * Adapted from reactbits.dev "ShinyText" (copy-paste, no dependency), tuned
 * monochrome: a white highlight band sweeps across grey text. Falls back to
 * plain foreground text when the user prefers reduced motion.
 */
export function ShinyText({ text, className = "", speed = 4 }: ShinyTextProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(120deg, hsl(0 0% 58%) 35%, hsl(0 0% 100%) 50%, hsl(0 0% 58%) 65%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        animation: `shine ${speed}s linear infinite`,
      }}
    >
      {text}
    </span>
  );
}
