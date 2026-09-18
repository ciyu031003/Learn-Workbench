"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 3D 今日状态球（v8 P3）
 *
 * 低多边形二十面体 + 顶点扰动：**状态分越低越「皱」，越高越圆润**，颜色从能量橙渐变到达标绿。
 *
 * 工程约束（见 docs/APP端优化方案-v8-Web端同步与3D视觉.md §1）：
 *  1. three 在 useEffect 里 **动态 import**，不进首包；
 *  2. 无 WebGL / reduced-motion / 离屏 / 页面隐藏 → 不跑 RAF（或只画一帧）；
 *  3. 卸载时 dispose 几何体/材质/renderer（StrictMode 双挂载安全）；
 *  4. 渲染失败一律静默回落到 CSS 渐变球（不白屏、不报错）。
 */
export function StateOrb({ score, size = 220, className }: { score: number; size?: number; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  /** 分数在主色里做插值：0 → 橙，100 → 绿 */
  const mix = Math.max(0, Math.min(1, score / 100));
  const color = `hsl(${Math.round(28 + mix * 118)} 62% 52%)`;

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

    // WebGL 探测：拿不到上下文就保持 CSS 回落
    const probe = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!probe) return;

    (async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

        const square = () => {
          const w = host.clientWidth || size;
          const h = host.clientHeight || size;
          renderer.setSize(w, h, false);
          camera.aspect = w / Math.max(1, h);
          camera.updateProjectionMatrix();
        };
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0, 4.3);

        const group = new THREE.Group();
        scene.add(group);

        const baseColor = new THREE.Color(color);
        // detail=5 → 20480 面：够细腻又不至于让低端机掉帧（配合 DPR ≤ 2）
        const geometry = new THREE.IcosahedronGeometry(1.25, 5);
        const position = geometry.attributes.position;
        const base = Float32Array.from(position.array as Float32Array);
        const material = new THREE.MeshStandardMaterial({
          color: baseColor,
          flatShading: true,
          roughness: 0.35,
          metalness: 0.18,
          emissive: baseColor.clone().multiplyScalar(0.18),
        });
        const orb = new THREE.Mesh(geometry, material);
        group.add(orb);

        // 外层柔光壳（背面）
        const haloGeo = new THREE.IcosahedronGeometry(1.42, 2);
        const haloMat = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.08,
          side: THREE.BackSide,
        });
        group.add(new THREE.Mesh(haloGeo, haloMat));

        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const key = new THREE.DirectionalLight(0xffffff, 1.15);
        key.position.set(3, 4, 5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(baseColor, 0.9);
        rim.position.set(-4, -2, -3);
        scene.add(rim);

        square();
        setLive(true);

        const amp = 0.05 + 0.17 * (1 - mix);
        const draw = (t: number) => {
          for (let i = 0; i < position.count; i++) {
            const ix = i * 3;
            const bx = base[ix];
            const by = base[ix + 1];
            const bz = base[ix + 2];
            const n =
              Math.sin(bx * 2.1 + t * 1.1) * Math.cos(by * 2.0 - t * 0.7) * Math.sin(bz * 2.3 + t * 0.5);
            const k = 1 + n * amp;
            position.setXYZ(i, bx * k, by * k, bz * k);
          }
          position.needsUpdate = true;
          group.rotation.y = t * 0.28;
          group.rotation.x = Math.sin(t * 0.33) * 0.14;
          renderer.render(scene, camera);
        };

        const start = performance.now();
        const loop = () => {
          if (disposed) return;
          const t = (performance.now() - start) / 1000;
          draw(t);
          if (!reduce && visible && inView) raf = requestAnimationFrame(loop);
        };
        loop();

        const onVisibility = () => {
          const next = document.visibilityState === "visible";
          if (next === visible) return;
          visible = next;
          if (visible && !reduce) loop();
        };
        document.addEventListener("visibilitychange", onVisibility);

        const io =
          typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver(
                (entries) => {
                  const next = entries.some((e) => e.isIntersecting);
                  if (next === inView) return;
                  inView = next;
                  if (inView && !reduce) loop();
                },
                { rootMargin: "80px" }
              )
            : null;
        io?.observe(host);

        const onResize = () => square();
        window.addEventListener("resize", onResize);

        cleanup = () => {
          document.removeEventListener("visibilitychange", onVisibility);
          window.removeEventListener("resize", onResize);
          io?.disconnect();
          geometry.dispose();
          material.dispose();
          haloGeo.dispose();
          haloMat.dispose();
          renderer.dispose();
          renderer.forceContextLoss?.();
        };
      } catch {
        // 3D 初始化失败：保留 CSS 回落
        setLive(false);
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [color, mix, size]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden
    >
      {/* CSS 回落：3D 未就绪 / 无 WebGL 时显示渐变球，不白屏 */}
      <div
        className="absolute inset-0 rounded-full transition-opacity duration-700"
        style={{
          opacity: live ? 0 : 1,
          background: `radial-gradient(circle at 32% 28%, ${color}, transparent 62%), radial-gradient(circle at 68% 74%, rgba(255,255,255,0.35), transparent 55%)`,
          filter: "blur(2px)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full transition-opacity duration-700" style={{ opacity: live ? 1 : 0 }} />
    </div>
  );
}
