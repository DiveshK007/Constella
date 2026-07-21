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
 * monochrome. The BASE colour is legible on its own (~13:1 on dark surfaces,
 * well past AA for large headings); the sheen is a *subtle brightening* toward
 * white, never a bright sweep over a dark base. Under reduced motion the text
 * renders statically in that same legible base — never a dim trough.
 */
const BASE = "hsl(0 0% 88%)";

export function ShinyText({ text, className = "", speed = 4 }: ShinyTextProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <span className={className} style={{ color: BASE }}>
        {text}
      </span>
    );
  }

  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(120deg, ${BASE} 42%, hsl(0 0% 100%) 50%, ${BASE} 58%)`,
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
