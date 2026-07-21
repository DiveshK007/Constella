"use client";

import { MotionConfig } from "framer-motion";

/**
 * App-wide motion policy. `reducedMotion="user"` makes every framer-motion
 * animation automatically respect the OS "reduce motion" setting, complementing
 * the CSS reduced-motion reset in globals.css.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
