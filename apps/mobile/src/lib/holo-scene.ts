/**
 * 学习闪光卡的 three.js 场景（v16 P2）——**真 three.js，不引入 expo-three**。
 *
 * 参考项目的着色器骨架（镭射 spectrum + 波浪 wave + 星点 star + 扫光 sweep）在这里
 * 用程序化方式复现（没有 study 专用三层贴图，所以主体/背景改为着色器生成，
 * 文字层交给 RN 视图叠加 —— 中文文本在 GL 里排版代价太高）。
 *
 * 与参考卡 web/app.js 的对应关系：
 *   spectrum / noise / star / wave / overlay  → 逐函数搬运
 *   UnrealBloom                               → 移动端不做后处理（低端机不稳），改成着色器内发光
 *   renderer.domElement.toDataURL             → 由 GLView.takeSnapshotAsync 承担出图
 */
import * as THREE from "three";

const VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uFoil;
uniform vec2 uDrift;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 spectrum(float t) {
  t = fract(t);
  vec3 pink = vec3(1.0, 0.32, 0.62), yellow = vec3(1.0, 0.85, 0.32), blue = vec3(0.22, 0.62, 1.0);
  if (t < 0.35) return mix(pink, yellow, t / 0.35);
  if (t < 0.7) return mix(yellow, blue, (t - 0.35) / 0.35);
  return mix(blue, vec3(1.0), (t - 0.7) / 0.3);
}
vec3 overlay(vec3 b, vec3 f) { return mix(2.0 * b * f, 1.0 - 2.0 * (1.0 - b) * (1.0 - f), step(vec3(0.5), b)); }
float wave(vec2 p) { vec2 a = p + uDrift * 2.4; return 0.5 + 0.5 * sin((a.x * 0.848 - a.y * 0.530) * 6.283 * 0.55 + 7.0 * noise(a * 1.5)); }
float star(vec2 p) {
  vec2 q = p * 105.0, id = floor(q), f = fract(q);
  float first = 9.0, second = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(id + g), hash(id + g + 43.3));
      float d = length(g + o - f);
      if (d < first) { second = first; first = d; } else second = min(second, d);
    }
  }
  float edge = 1.0 - smoothstep(0.01, 0.035, second - first);
  float sparse = step(0.90, hash(id + 8.8));
  float twinkle = pow(0.5 + 0.5 * sin(uTime * 1.8 + hash(id) * 30.0), 6.0);
  return edge * sparse * twinkle;
}

void main() {
  vec2 uv = vUv;
  // 深色丝绒底 + 竖向渐变，保证叠加金色文字时有足够对比
  vec3 base = mix(vec3(0.055, 0.070, 0.105), vec3(0.105, 0.120, 0.180), uv.y);
  float w = wave(uv);
  vec3 foil = spectrum(w * 0.8 + noise(uv * 5.0) * 0.12);
  vec3 col = mix(base, overlay(base, foil), uFoil * 0.34);
  // 扫光（参考卡的 sweep）
  float sweep = pow(max(0.0, sin((uv.x * 0.83 + uv.y * 0.35 + uTime * 0.28) * 6.283)), 12.0);
  col += foil * sweep * uFoil * 0.34;
  // 星点（只在暗处显示）
  col += vec3(0.66, 0.86, 1.0) * star(uv + uDrift * 0.4) * uFoil * 0.7;
  // 描金内框
  vec2 p = abs(uv - 0.5);
  float frame = smoothstep(0.5, 0.487, max(p.x * 1.0, p.y * 0.72));
  col = mix(col, vec3(0.85, 0.73, 0.45), frame * 0.22);
  gl_FragColor = vec4(pow(max(col, vec3(0.0)), vec3(2.2)), 1.0);
}`;

export interface HoloSceneHandle {
  /** 停掉渲染循环并释放资源 */
  dispose: () => void;
}

interface GLLike {
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  endFrameEXP: () => void;
}

/**
 * 在 expo-gl 的上下文里起一个全屏着色器平面。
 * 注意：three 需要一个"canvas 形状"的对象，这里用最小 shim 适配 RN。
 */
export function startHoloScene(gl: GLLike, opts: { foil?: number } = {}): HoloSceneHandle {
  const width = Math.max(1, gl.drawingBufferWidth);
  const height = Math.max(1, gl.drawingBufferHeight);

  const canvasShim = {
    width,
    height,
    style: {},
    clientWidth: width,
    clientHeight: height,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  };

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasShim as unknown as HTMLCanvasElement,
    context: gl as unknown as WebGLRenderingContext,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const uniforms = {
    uTime: { value: 0 },
    uFoil: { value: Math.min(1.2, Math.max(0, opts.foil ?? 0.85)) },
    uDrift: { value: new THREE.Vector2(0, 0) },
  };

  const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  let raf: number | null = null;
  let elapsed = 0;
  const started = Date.now();

  const tick = () => {
    elapsed = (Date.now() - started) / 1000;
    uniforms.uTime.value = elapsed;
    // 缓慢漂移，制造"光在动"的视差感（不需要手势，避免与弹层手势打架）
    uniforms.uDrift.value.set(Math.sin(elapsed * 0.35) * 0.12, Math.cos(elapsed * 0.27) * 0.09);
    renderer.render(scene, camera);
    gl.endFrameEXP();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    dispose: () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
