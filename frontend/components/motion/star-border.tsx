"use client";

import React from "react";
import { useReducedMotion } from "framer-motion";

interface StarBorderProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** Duration of the travelling highlight, e.g. "6s". */
  speed?: string;
  children: React.ReactNode;
}

/**
 * Adapted from reactbits.dev "StarBorder" (copy-paste, no dependency), tuned
 * monochrome: two white highlights travel along the top and bottom edges of a
 * pill. Static (plain bordered pill) under prefers-reduced-motion.
 */
export function StarBorder({
  as: Tag = "button",
  speed = "6s",
  className = "",
  children,
  ...rest
}: StarBorderProps) {
  const reduce = useReducedMotion();

  return (
    <Tag
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/15 bg-secondary px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-white/30 ${className}`}
      {...rest}
    >
      {!reduce && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-11px] right-[-25%] h-1/2 w-[80%] rounded-full opacity-70"
            style={{
              background: "radial-gradient(circle, hsl(0 0% 100% / 0.8), transparent 14%)",
              animation: `star-move ${speed} linear infinite alternate`,
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[-11px] left-[-25%] h-1/2 w-[80%] rounded-full opacity-70"
            style={{
              background: "radial-gradient(circle, hsl(0 0% 100% / 0.8), transparent 14%)",
              animation: `star-move ${speed} linear infinite alternate-reverse`,
            }}
          />
        </>
      )}
      <span className="relative z-10">{children}</span>
    </Tag>
  );
}
