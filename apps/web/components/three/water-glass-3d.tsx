"use client";

import { useEffect, useRef, useState } from "react";
// 仅类型导入（编译期擦除，不进包体）
import type { Mesh } from "three";

/**
 * 3D 水杯（v8 P3）：玻璃圆柱 + 液柱 + 波光液面 + 上升气泡，液位 = 今日饮水完成度。
 *
 * 与 StateOrb 同一套工程约束：three 动态 import、无 WebGL / reduced-motion / 离屏不跑 RAF、
 * 卸载 dispose、失败回落 CSS 液面（不白屏）。
 */
export function WaterGlass3D({ ratio, size = 176, className }: { ratio: number; size?: number; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let disposed = false;
    let raf = 0;
    let visible = true;
    let inView = true;
    let cleanup: (() => void) | undefined;

    const reduce = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    const probe = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!probe) return;

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
        camera.position.set(0, 0.5, 4.4);
        camera.lookAt(0, 0.05, 0);

        const resize = () => {
          const w = host.clientWidth || size;
          const h = host.clientHeight || size * 1.25;
          renderer.setSize(w, h, false);
          camera.aspect = w / Math.max(1, h);
          camera.updateProjectionMatrix();
        };

        const INNER = 2.15; // 液柱最大高度
        const BOTTOM = -1.12;

        // 玻璃杯身（开口圆柱 + 底部圆盘）
        const glassGeo = new THREE.CylinderGeometry(1, 0.84, 2.5, 48, 1, true);
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.16,
          roughness: 0.08,
          metalness: 0,
          side: THREE.DoubleSide,
        });
        scene.add(new THREE.Mesh(glassGeo, glassMat));
        const bottomGeo = new THREE.CircleGeometry(0.84, 48);
        const bottomMat = new THREE.MeshStandardMaterial({ color: 0xdff3f0, transparent: true, opacity: 0.35, roughness: 0.4 });
        const bottom = new THREE.Mesh(bottomGeo, bottomMat);
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.y = BOTTOM;
        scene.add(bottom);

        // 液柱（高度随完成度）
        const liquidGeo = new THREE.CylinderGeometry(0.95, 0.83, 1, 40, 1, false);
        const liquidMat = new THREE.MeshStandardMaterial({
          color: 0x2fb3a6,
          roughness: 0.22,
          metalness: 0.15,
          transparent: true,
          opacity: 0.92,
          emissive: new THREE.Color(0x1c6f68),
        });
        const liquid = new THREE.Mesh(liquidGeo, liquidMat);
        scene.add(liquid);

        // 液面（波光）
        const surfaceGeo = new THREE.CircleGeometry(0.95, 40);
        const surfaceMat = new THREE.MeshStandardMaterial({
          color: 0x8fe6dc,
          roughness: 0.12,
          metalness: 0.35,
          transparent: true,
          opacity: 0.95,
        });
        const surface = new THREE.Mesh(surfaceGeo, surfaceMat);
        surface.rotation.x = -Math.PI / 2;
        scene.add(surface);

        // 气泡
        const bubbleGeo = new THREE.SphereGeometry(0.045, 12, 12);
        const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xd9fff8, transparent: true, opacity: 0.42, roughness: 0.2 });
        const bubbles: { mesh: Mesh; speed: number; seed: number }[] = [];
        for (let i = 0; i < 7; i++) {
          const mesh = new THREE.Mesh(bubbleGeo, bubbleMat);
          const angle = (i / 7) * Math.PI * 2;
          const r = 0.25 + (i % 3) * 0.22;
          mesh.position.set(Math.cos(angle) * r, BOTTOM + 0.2 + (i % 4) * 0.35, Math.sin(angle) * r);
          bubbles.push({ mesh, speed: 0.12 + (i % 5) * 0.035, seed: i });
          scene.add(mesh);
        }

        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const key = new THREE.DirectionalLight(0xffffff, 1.1);
        key.position.set(3, 5, 4);
        scene.add(key);
        const rim = new THREE.PointLight(0x2fb3a6, 12, 12);
        rim.position.set(-2.2, 0.4, 2.4);
        scene.add(rim);

        resize();
        setLive(true);

        /** 液位缓动（每帧向目标靠拢） */
        let level = Math.max(0.04, clamped);
        const lay = () => {
          const h = Math.max(0.05, INNER * level);
          liquid.scale.y = h;
          liquid.position.y = BOTTOM + h / 2;
          surface.position.y = BOTTOM + h + 0.01;
        };
        lay();

        const start = performance.now();
        const step = () => {
          const now = performance.now();
          const t = (now - start) / 1000;
          const target = Math.max(0.04, clamped);
          level += (target - level) * 0.08;
          lay();
          surface.position.y += Math.sin(t * 2.2) * 0.0018;
          for (const b of bubbles) {
            b.mesh.position.y += b.speed * 0.016;
            if (b.mesh.position.y > BOTTOM + INNER * level) {
              b.mesh.position.y = BOTTOM + 0.08;
            }
          }
          camera.position.x = Math.sin(t * 0.3) * 0.28;
          camera.lookAt(0, 0.05, 0);
          renderer.render(scene, camera);
          if (!reduce && visible && inView) raf = requestAnimationFrame(step);
        };
        step();

        const onVisibility = () => {
          const next = document.visibilityState === "visible";
          if (next === visible) return;
          visible = next;
          if (visible && !reduce) step();
        };
        document.addEventListener("visibilitychange", onVisibility);

        const io =
          typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(
                (entries) => {
                  const next = entries.some((e) => e.isIntersecting);
                  if (next === inView) return;
                  inView = next;
                  if (inView && !reduce) step();
                },
                { rootMargin: "80px" }
              )
            : null;
        io?.observe(host);

        const onResize = () => resize();
        window.addEventListener("resize", onResize);

        cleanup = () => {
          document.removeEventListener("visibilitychange", onVisibility);
          window.removeEventListener("resize", onResize);
          io?.disconnect();
          glassGeo.dispose();
          glassMat.dispose();
          bottomGeo.dispose();
          bottomMat.dispose();
          liquidGeo.dispose();
          liquidMat.dispose();
          surfaceGeo.dispose();
          surfaceMat.dispose();
          bubbleGeo.dispose();
          bubbleMat.dispose();
          renderer.dispose();
          renderer.forceContextLoss?.();
        };
      } catch {
        setLive(false);
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [clamped, size]);

  return (
    <div ref={hostRef} className={className} style={{ width: size, height: size * 1.25, position: "relative" }} aria-hidden>
      {/* CSS 回落：一个带液面的圆角杯 */}
      <div
        className="absolute inset-0 overflow-hidden rounded-b-[26px] rounded-t-[14px] transition-opacity duration-700"
        style={{
          opacity: live ? 0 : 1,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(47,179,166,0.12))",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${Math.round(clamped * 100)}%`, background: "linear-gradient(180deg, #57c7b2, #2fb3a6)" }}
        />
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }} />
    </div>
  );
}
