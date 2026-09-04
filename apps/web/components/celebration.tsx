"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, PartyPopper } from "lucide-react";

const CELEBRATION_COLORS = ["#2f74c0", "#5b93d6", "#e1781c", "#f1a45c", "#8fbf5f", "#3da35d"];

type CelebrationKind = "sparkle" | "confetti";

export function Celebration({
  kind = "sparkle",
  origin,
  duration,
  message = "又向前一步！",
  onDone,
}: {
  kind?: CelebrationKind;
  origin?: { x: number; y: number };
  duration?: number;
  message?: string;
  onDone?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      setReduced(reducedMotion);
      setMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted || onDone === undefined) return;
    const d = kind === "confetti" ? duration ?? 2600 : duration ?? 1300;
    const id = window.setTimeout(onDone, d);
    return () => window.clearTimeout(id);
  }, [mounted, onDone, kind, duration]);

  const center = useMemo(() => {
    if (typeof window === "undefined") return { x: 50, y: 50 };
    return {
      x: origin?.x ?? window.innerWidth / 2,
      y: origin?.y ?? window.innerHeight / 2,
    };
  }, [origin]);

  if (!mounted) return null;

  if (reduced) {
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center">
        <div className="surface-nav flex items-center gap-3 rounded-2xl px-5 py-4 text-left shadow-[0_16px_50px_rgba(80,60,25,0.18)]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-strong">
            {kind === "confetti" ? <PartyPopper className="size-5" /> : <CheckCircle2 className="size-5" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">今天也留下了一点进度。</p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (kind === "sparkle") {
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[300] overflow-hidden">
        <SparkleBurst origin={center} />
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[300]">
      <ConfettiCanvas duration={duration ?? 2600} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="surface-nav flex items-center gap-3 rounded-2xl px-5 py-4 shadow-[0_16px_50px_rgba(80,60,25,0.2)]">
          <PartyPopper className="size-6 text-accent-strong" />
          <div>
            <p className="text-sm font-semibold text-foreground">{message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">把成果变成下一段的燃料。</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SparkleBurst({ origin }: { origin: { x: number; y: number } }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 18;
        const distance = 34 + (i % 4) * 18;
        return {
          id: i,
          x: origin.x + Math.cos(angle) * distance,
          y: origin.y + Math.sin(angle) * distance,
          color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
          delay: Math.round((i % 5) * 18),
          scale: i % 3 === 0 ? 1.35 : 1,
        };
      }),
    [origin]
  );

  return (
    <>
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="celebration-spark fixed rounded-full"
          style={{
            left: s.x,
            top: s.y,
            width: 10,
            height: 10,
            backgroundColor: s.color,
            boxShadow: `0 0 14px ${s.color}`,
            animationDelay: `${s.delay}ms`,
            transform: `translate(-50%, -50%) scale(${s.scale})`,
          }}
        />
      ))}
      <span
        className="fixed -translate-x-1/2 -translate-y-1/2 celebration-pop"
        style={{ left: origin.x, top: origin.y, color: "#2f74c0" }}
      >
        <CheckCircle2 className="size-8" />
      </span>
    </>
  );
}

function ConfettiCanvas({ duration }: { duration: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
      vy: 2 + Math.random() * 3.4,
      vx: -1.2 + Math.random() * 2.4,
      rot: Math.random() * Math.PI,
      vr: -0.12 + Math.random() * 0.24,
    }));

    let raf = 0;
    const start = performance.now();
    const draw = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const piece of pieces) {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rot += piece.vr;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rot);
        ctx.globalAlpha = p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 0.92;
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      }
      if (p < 1) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [duration]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}
