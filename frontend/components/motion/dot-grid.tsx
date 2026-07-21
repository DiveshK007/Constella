"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface DotGridProps {
  className?: string;
  gap?: number;
  dotRadius?: number;
}

/**
 * Adapted from reactbits.dev "DotGrid" (copy-paste, no dependency), tuned
 * monochrome: a canvas grid of white dots with a gentle opacity wave. Meant for
 * hero / empty-state backdrops only — NEVER behind the ReactFlow canvas. Heavy
 * enough to lazy-load (default export → next/dynamic). Renders a static grid
 * (no rAF) under prefers-reduced-motion.
 */
export default function DotGrid({ className = "", gap = 26, dotRadius = 1.4 }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (let y = gap; y < h; y += gap) {
        for (let x = gap; x < w; x += gap) {
          const wave = reduce ? 0 : (Math.sin((x + y) * 0.02 + t * 0.001) + 1) * 0.06;
          ctx.beginPath();
          ctx.fillStyle = `hsla(0,0%,100%,${0.05 + wave})`;
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw(0);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [gap, dotRadius, reduce]);

  return <canvas ref={canvasRef} className={`h-full w-full ${className}`} aria-hidden="true" />;
}
