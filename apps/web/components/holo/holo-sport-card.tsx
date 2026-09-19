"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SportsCardModel } from "@learn-workbench/shared";
import { Button } from "@/components/ui/button";
import {
  CARD_TEXT_HEIGHT,
  CARD_TEXT_WIDTH,
  createCardTextCanvas,
  drawCardTextLayer,
  holoAssetUrl,
  HOLO_LAYERS,
} from "@/lib/holo-card-text";

/**
 * 运动闪光卡（Web 端）—— 移植自 sports-cards 的 three.js 全息卡牌：
 * 三层贴图（主体 / 背景 / 线描）+ 实时镭射着色器 + GLB 卡体 + 泛光后处理，
 * 文字层改为按档案数据实时绘制，所以卡面上是我们的战绩与装备。
 *
 * 性能约束（沿用 v8 的 3D 规范）：three 走 useEffect 内动态 import（异步 chunk）、
 * DPR ≤ 1.75、离屏/隐藏页暂停、prefers-reduced-motion 只画一帧、卸载 dispose、无 WebGL 回落静态卡。
 */
interface HoloSportCardProps {
  model: SportsCardModel;
  /** 素材根目录 */
  base?: string;
  className?: string;
  autoPlay?: boolean;
  /** 卡面下方是否显示控制条 */
  controls?: boolean;
}

interface Controller {
  updateModel: (next: SportsCardModel) => void;
  setAuto: (value: boolean) => void;
  flip: () => void;
  reset: () => void;
  save: () => void;
  dispose: () => void;
}

const VERTEX_SHADER = `varying vec2 vUv;
void main(){vUv=vec2(uv.x,1.0-uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

const SHARED_GLSL = `precision highp float;
varying vec2 vUv;
uniform float uTime,uFoil,uScale,uDepth,uBgDepth,uSafeScale;
uniform vec2 uSafeOffset;
uniform vec3 uView;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec3 spectrum(float t){t=fract(t);vec3 pink=vec3(1.,.32,.62),yellow=vec3(1.,.85,.32),blue=vec3(.22,.62,1.);if(t<.35)return mix(pink,yellow,t/.35);if(t<.7)return mix(yellow,blue,(t-.35)/.35);return mix(blue,vec3(1.),(t-.7)/.3);}
vec3 overlay(vec3 b,vec3 f){return mix(2.*b*f,1.-2.*(1.-b)*(1.-f),step(vec3(.5),b));}
float inside(vec2 p){return step(0.,p.x)*step(0.,p.y)*step(p.x,1.)*step(p.y,1.);}
vec2 parallax(vec2 p,float s,float d){return (p-.5)*s+.5+uView.xy/max(abs(uView.z),.35)*d*.14;}
float wave(vec2 p){vec2 a=p+uView.xy*2.4;return .5+.5*sin((a.x*.848-a.y*.530)*6.283*.55+7.*noise(a*1.5));}
float star(vec2 p){vec2 q=p*105.,id=floor(q),f=fract(q);float first=9.,second=9.;for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 o=vec2(hash(id+g),hash(id+g+43.3));float d=length(g+o-f);if(d<first){second=first;first=d;}else second=min(second,d);}}float edge=1.-smoothstep(.01,.035,second-first);float sparse=step(.90,hash(id+8.8));float twinkle=pow(.5+.5*sin(uTime*1.8+hash(id)*30.+uView.x*27.+uView.y*21.),6.);return edge*sparse*twinkle;}
`;

const FRAGMENT_SHADER = SHARED_GLSL + `
uniform sampler2D tSubject,tBackground,tText,tLine;
void main(){
 vec2 uv=vUv;
 vec2 su=parallax(uv,uScale,uDepth)*uSafeScale+uSafeOffset;
 vec2 bu=parallax(uv,1.,uBgDepth);
 vec4 sub=texture2D(tSubject,clamp(su,0.,1.));sub.a*=inside(su);
 vec3 bg=texture2D(tBackground,clamp(bu,0.,1.)).rgb;
 float w=wave(uv); vec3 foil=spectrum(w*.8+noise(uv*5.)*.12);
 vec3 subject=mix(sub.rgb,overlay(sub.rgb,foil),uFoil*.28);
 bg=mix(bg,overlay(bg,foil),uFoil*.36);
 vec3 col=mix(bg,subject,sub.a);
 float sweep=pow(max(0.,sin((uv.x*.83+uv.y*.35+uView.x*1.8+uView.y*.9)*6.283)),12.);
 col+=foil*sweep*uFoil*.28;
 float line=1.-smoothstep(.06,.25,texture2D(tLine,clamp(su,0.,1.)).r);
 col+=vec3(1.,.94,.78)*line*inside(su)*sub.a*sweep*uFoil*.22;
 col+=vec3(.66,.86,1.)*star(bu)*uFoil*.65*(1.-sub.a*.7);
 vec4 text=texture2D(tText,uv);col=mix(col,text.rgb,text.a);
 gl_FragColor=vec4(pow(max(col,vec3(0.)),vec3(2.2)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

const EDGE_SHADER = SHARED_GLSL + `
void main(){vec3 col=mix(vec3(.55,.34,.1),spectrum(wave(vUv)),.65+uFoil*.2);gl_FragColor=vec4(col*.8+.14,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

const BACK_SHADER = SHARED_GLSL + `
uniform sampler2D tBack;
void main(){vec4 art=texture2D(tBack,vec2(1.-vUv.x,vUv.y));vec2 p=vUv-.5;float filigree=.5+.5*sin(length(p*vec2(1.,1.5))*100.+noise(p*15.)*4.);vec3 col=mix(vec3(.025,.042,.064),vec3(.085,.092,.11),filigree*.35);float border=step(.465,max(abs(p.x),abs(p.y)));col=mix(col,spectrum(wave(vUv))*.55,border);col+=spectrum(wave(vUv))*uFoil*.08;col=mix(col,art.rgb,art.a);gl_FragColor=vec4(pow(col,vec3(2.2)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

/** 卡片参数：与源工程一致（镭射强度 / 主体缩放与景深 / 背景景深 / 安全区） */
const CARD_PARAMS = { foil: 0.9, subjectScale: 1.25, subjectDepth: 0.4, backgroundDepth: -0.25 };
const SAFE_AREA = { scale: 1.12, offset: [-0.06, -0.085] as [number, number] };

/** 卡背：暗色 + 描金 + 中央「幻」字（源工程同款，改为按卡面数据生成） */
function makeBackTexture(THREE: typeof import("three"), model: SportsCardModel) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 1024, 1536);
    ctx.strokeStyle = "#c2a368";
    ctx.lineWidth = 2;
    ctx.strokeRect(74, 74, 876, 1388);
    ctx.strokeRect(87, 87, 850, 1362);
    ctx.save();
    ctx.translate(512, 650);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-210, -210, 420, 420);
    ctx.strokeRect(-196, -196, 392, 392);
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#dbc18b";
    ctx.font = "166px KaiTi, STKaiti, serif";
    ctx.fillText("幻", 512, 709);
    ctx.font = "31px KaiTi, STKaiti, serif";
    ctx.fillText(model.collection, 512, 1050);
    ctx.font = "20px Georgia";
    ctx.fillStyle = "#a09a8f";
    ctx.fillText(model.subtitle, 512, 1114);
    ctx.font = "20px Georgia";
    ctx.fillText(model.edition, 512, 1310);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export default function HoloSportCard({ model, base = "/holo", className, autoPlay = false, controls = true }: HoloSportCardProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fallbackRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<Controller | null>(null);
  const modelRef = useRef(model);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [auto, setAuto] = useState(autoPlay);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let disposed = false;
    let controller: Controller | null = null;
    let backTex: import("three").Texture | null = null;
    const disposables: { dispose: () => void }[] = [];

    const boot = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
      const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
      if (disposed) return;

      const initial = modelRef.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-5, 5, 5.65, -5.65, 0.1, 100);
      camera.position.set(0, 0, 20);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      renderer.setClearColor(0xffffff, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      stage.appendChild(renderer.domElement);
      disposables.push(renderer);

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(720, 1000), 0.18, 0.35, 1.0));
      composer.addPass(new OutputPass());

      const textTexture = new THREE.CanvasTexture(createCardTextCanvas(initial));
      textTexture.colorSpace = THREE.NoColorSpace;
      const backTexture = makeBackTexture(THREE, initial);
      backTex = backTexture;

      const loader = new THREE.TextureLoader();
      const loaded = await Promise.all(HOLO_LAYERS.map((layer) => loader.loadAsync(holoAssetUrl(initial.sportKey, layer, base))));
      if (disposed) {
        loaded.forEach((t) => t.dispose());
        return;
      }
      loaded.forEach((t) => {
        t.colorSpace = THREE.NoColorSpace;
        t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        disposables.push(t);
      });
      const [subjectTex, backgroundTex, lineartTex] = loaded;
      disposables.push(textTexture, backTexture);

      const uniforms: Record<string, { value: unknown }> = {
        tSubject: { value: subjectTex },
        tBackground: { value: backgroundTex },
        tText: { value: textTexture },
        tLine: { value: lineartTex },
        tBack: { value: backTexture },
        uTime: { value: 0 },
        uView: { value: new THREE.Vector3(0, 0, 1) },
        uFoil: { value: CARD_PARAMS.foil },
        uScale: { value: CARD_PARAMS.subjectScale },
        uDepth: { value: CARD_PARAMS.subjectDepth },
        uBgDepth: { value: CARD_PARAMS.backgroundDepth },
        uSafeScale: { value: SAFE_AREA.scale },
        uSafeOffset: { value: new THREE.Vector2(SAFE_AREA.offset[0], SAFE_AREA.offset[1]) },
      };
      const shaderUniforms = uniforms as unknown as { [key: string]: import("three").IUniform };

      const frontMat = new THREE.ShaderMaterial({ uniforms: shaderUniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, side: THREE.FrontSide });
      const edgeMat = new THREE.ShaderMaterial({ uniforms: shaderUniforms, vertexShader: VERTEX_SHADER, fragmentShader: EDGE_SHADER });
      const backMat = new THREE.ShaderMaterial({ uniforms: shaderUniforms, vertexShader: VERTEX_SHADER, fragmentShader: BACK_SHADER });
      const goldMat = new THREE.MeshBasicMaterial({ color: 0xbfa26b });
      disposables.push(frontMat, edgeMat, backMat, goldMat);

      const gltf = await new GLTFLoader().loadAsync(holoAssetUrl(initial.sportKey, "card.glb", base));
      if (disposed) return;
      const root = new THREE.Group();
      root.add(gltf.scene);
      scene.add(root);
      let face: import("three").Mesh | null = null;
      gltf.scene.traverse((ob) => {
        const mesh = ob as import("three").Mesh;
        if (!mesh.isMesh) return;
        const role = (mesh.material as { name?: string } | undefined)?.name;
        if (role === "web_front") { mesh.material = frontMat; face = mesh; }
        else if (role === "web_back") mesh.material = backMat;
        else if (role === "web_gold") mesh.material = goldMat;
        else if (role === "web_text") mesh.visible = false;
        else mesh.material = edgeMat;
      });
      if (!face) throw new Error("卡牌模型缺少 web_front 面");

      let targetX = 0.025;
      let targetY = -0.13;
      let targetZoom = 1;
      let rotationX = targetX;
      let rotationY = targetY;
      let autoSpin = false;
      let isFlipped = false;
      let dragging = false;
      let last = { x: 0, y: 0 };
      let lastTime = 0;
      let elapsed = 0;
      let visible = true;

      const resize = () => {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (!w || !h) return;
        const aspect = w / h;
        const halfH = 5.65 / targetZoom;
        camera.left = -halfH * aspect;
        camera.right = halfH * aspect;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        dragging = true;
        autoSpin = false;
        setAuto(false);
        last = { x: e.clientX, y: e.clientY };
        stage.setPointerCapture(e.pointerId);
        stage.focus({ preventScroll: true });
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const baseY = isFlipped ? Math.PI : 0;
        targetY = THREE.MathUtils.clamp(targetY + (e.clientX - last.x) * 0.006, baseY - 0.65, baseY + 0.65);
        targetX = THREE.MathUtils.clamp(targetX + (e.clientY - last.y) * 0.005, -0.43, 0.43);
        last = { x: e.clientX, y: e.clientY };
      };
      const onPointerUp = () => { dragging = false; };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        targetZoom = THREE.MathUtils.clamp(targetZoom - e.deltaY * 0.001, 0.82, 1.18);
        resize();
      };
      const onKeyDown = (e: KeyboardEvent) => {
        const baseY = isFlipped ? Math.PI : 0;
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "f", "F", "r", "R"].includes(e.key)) {
          e.preventDefault();
          autoSpin = false;
          setAuto(false);
        }
        if (e.key === "ArrowLeft") targetY -= 0.07;
        if (e.key === "ArrowRight") targetY += 0.07;
        if (e.key === "ArrowUp") targetX -= 0.06;
        if (e.key === "ArrowDown") targetX += 0.06;
        if (e.key === "f" || e.key === "F") controller?.flip();
        if (e.key === "r" || e.key === "R") controller?.reset();
        if (e.key.startsWith("Arrow")) {
          targetY = THREE.MathUtils.clamp(targetY, baseY - 0.65, baseY + 0.65);
          targetX = THREE.MathUtils.clamp(targetX, -0.43, 0.43);
        }
      };

      stage.addEventListener("pointerdown", onPointerDown);
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("pointercancel", onPointerUp);
      stage.addEventListener("lostpointercapture", onPointerUp);
      stage.addEventListener("wheel", onWheel, { passive: false });
      stage.addEventListener("keydown", onKeyDown);

      const observer = new ResizeObserver(resize);
      observer.observe(stage);
      const io = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting ?? true; }, { threshold: 0.05 });
      io.observe(stage);
      resize();

      const animate = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.1) || 0;
        lastTime = now;
        if (!document.hidden && visible) elapsed += dt;
        if (autoSpin) {
          targetY = Math.sin(elapsed * 0.65) * 0.38;
          targetX = Math.sin(elapsed * 0.85) * 0.12;
        }
        const ease = reduced ? 1 : 1 - Math.exp(-dt * 8);
        rotationX += (targetX - rotationX) * ease;
        rotationY += (targetY - rotationY) * ease;
        root.rotation.set(rotationX, rotationY, 0);
        root.updateMatrixWorld(true);
        const view = uniforms.uView.value as import("three").Vector3;
        view.copy(camera.position).applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert()).normalize();
        uniforms.uTime.value = reduced && !autoSpin ? 0 : elapsed;
        if (visible && !document.hidden) composer.render();
      };
      renderer.setAnimationLoop(animate);

      controller = {
        updateModel(next) {
          const canvas = createCardTextCanvas(next);
          textTexture.image = canvas;
          textTexture.needsUpdate = true;
          const nextBack = makeBackTexture(THREE, next);
          if (backTex) backTex.dispose();
          backTex = nextBack;
          uniforms.tBack.value = nextBack;
        },
        setAuto(value) {
          autoSpin = value;
          setAuto(value);
        },
        flip() {
          isFlipped = !isFlipped;
          autoSpin = false;
          setAuto(false);
          setFlipped(isFlipped);
          targetX = 0;
          targetY = isFlipped ? Math.PI : 0;
        },
        reset() {
          targetX = 0.025;
          targetY = -0.13;
          targetZoom = 1;
          isFlipped = false;
          autoSpin = false;
          setAuto(false);
          setFlipped(false);
          resize();
        },
        save() {
          composer.render();
          try {
            const a = document.createElement("a");
            a.download = modelRef.current.fileStem + "-闪光卡.png";
            a.href = renderer.domElement.toDataURL("image/png");
            a.click();
          } catch {
            /* 浏览器拒绝导出时静默失败，卡片仍可正常观看 */
          }
        },
        dispose() {
          renderer.setAnimationLoop(null);
          observer.disconnect();
          io.disconnect();
          stage.removeEventListener("pointerdown", onPointerDown);
          stage.removeEventListener("pointermove", onPointerMove);
          stage.removeEventListener("pointerup", onPointerUp);
          stage.removeEventListener("pointercancel", onPointerUp);
          stage.removeEventListener("lostpointercapture", onPointerUp);
          stage.removeEventListener("wheel", onWheel);
          stage.removeEventListener("keydown", onKeyDown);
          scene.traverse((ob) => {
            const mesh = ob as import("three").Mesh;
            if (mesh.isMesh) mesh.geometry?.dispose();
          });
          disposables.forEach((d) => d.dispose());
          composer.dispose();
          if (renderer.domElement.parentNode === stage) stage.removeChild(renderer.domElement);
        },
      };
      controllerRef.current = controller;
      setStatus("ready");
    };

    void boot().catch(() => {
      if (!disposed) setStatus("fallback");
    });

    return () => {
      disposed = true;
      controllerRef.current = null;
      controller?.dispose();
      disposables.forEach((d) => d.dispose());
    };
  }, [base]);

  // 档案数据变化：只重画文字层与卡背，不重建场景
  useEffect(() => {
    controllerRef.current?.updateModel(model);
  }, [model]);

  // 无 WebGL 时的降级卡：背景 + 主体 + 实时文字层（纯 2D）
  useEffect(() => {
    if (status !== "fallback") return;
    const canvas = fallbackRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) drawCardTextLayer(ctx, model);
  }, [status, model]);

  const fallbackBg = useMemo(
    () => ({ backgroundImage: "url(" + holoAssetUrl(model.sportKey, "background", base) + ")" }),
    [model.sportKey, base]
  );

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[24px] bg-white shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)]">
        <div
          ref={stageRef}
          tabIndex={0}
          role="img"
          aria-label={model.title + " 闪光卡：拖动旋转，滚轮缩放，按 F 翻面，按 R 复位"}
          className="h-[420px] w-full cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:h-[540px]"
        />
        {status === "fallback" ? (
          <div className="absolute inset-0" style={fallbackBg}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={holoAssetUrl(model.sportKey, "subject", base)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover mix-blend-multiply"
            />
            <canvas
              ref={fallbackRef}
              width={CARD_TEXT_WIDTH}
              height={CARD_TEXT_HEIGHT}
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : null}
        {status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">正在唤醒镭射卡…</div>
        ) : null}
      </div>

      {controls ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={auto ? "default" : "outline"} onClick={() => controllerRef.current?.setAuto(!auto)}>
            {auto ? "暂停赏卡" : "自动赏卡"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => controllerRef.current?.flip()}>
            {flipped ? "回到正面" : "翻看背面"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => controllerRef.current?.reset()}>复位</Button>
          <Button size="sm" variant="ghost" onClick={() => controllerRef.current?.save()}>保存此刻</Button>
          <span className="ml-auto text-[11px] text-muted-foreground">拖动转卡 · 滚轮缩放 · 拖到边缘看镭射</span>
        </div>
      ) : null}
    </div>
  );
}
