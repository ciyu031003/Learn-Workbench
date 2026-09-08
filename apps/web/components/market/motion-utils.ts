"use client";

import { useEffect, useRef, useState } from "react";
import { easeCubicOut, easeCubicInOut } from "d3-ease";
import { interpolateNumber } from "d3-interpolate";
import { MOTION } from "./motion-tokens";

export function useInView<T extends HTMLElement = HTMLDivElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.2, rootMargin: "0px 0px -12% 0px", ...options });
    observer.observe(node);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
}

export function useCountUp(target: number, enabled: boolean, duration: number = MOTION.base) {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      started.current = true;
      return;
    }
    const interpolate = interpolateNumber(0, target);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(interpolate(easeCubicOut(p)));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    started.current = true;
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [duration, enabled, target]);

  return value;
}

export function useProgressive(start: number, end: number, enabled: boolean, duration: number = MOTION.base) {
  const [value, setValue] = useState(start);
  const frame = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(end);
      started.current = true;
      return;
    }
    const interpolate = interpolateNumber(start, end);
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      setValue(interpolate(easeCubicInOut(p)));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    started.current = true;
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, [duration, enabled, end, start]);

  return value;
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
