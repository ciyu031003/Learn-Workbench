/**
 * 庆祝特效的**纯逻辑**（v1.44）—— 零 react-native / reanimated 依赖，vitest 可直接加载。
 *
 * 为什么单独抽出来：粒子排布与运动学是这套特效里唯一"会算错"的部分
 * （延迟、寿命、重力、摆动都靠它），而它跟渲染无关。抽成纯函数后可以：
 *   - 单测锁死"每个粒子的 delay+life 不超过时间轴"（否则尾部粒子会被截断）；
 *   - 单测锁死"同一种子产出同一组粒子"（避免每次渲染都换一批、看起来乱跳）；
 *   - 单测锁死"颜色与形状真的有多种"（这正是用户反馈"只有几个颜色的矩形"的回归点）。
 * 组件只负责把这里算出的数字喂给 useAnimatedStyle。
 */

/** 12 色盘：深色遮罩上也能看清，比旧版 7 色明显更热闹 */
export const PALETTE = [
  "#FFD166", "#FF6B6B", "#4ECDC4", "#7C5CFF", "#FF9F1C", "#2EC4B6",
  "#FF4D8D", "#A0E7E5", "#FFE066", "#5B8DEF", "#F76F8E", "#B8F2E6",
];

/**
 * 整个特效的时间轴长度（ms）。必须 ≥ 所有粒子的 delayMs + lifeMs。
 *
 * 取值依据：爆点最晚 620ms 起爆，火花寿命最长 900+320=1220ms，再叠加最多 60ms 的抖动
 * → 最坏 1900ms；彩带最晚 620ms 落下、寿命最长 2020ms → 最坏 2640ms。
 * 留余量取 **2900**。（曾取 2600：跑 3000 个种子枚举发现最坏 2635ms，
 * 尾部 35ms 会被截断 —— 单测 `没有粒子被时间轴截断` 现在锁死这条。）
 */
export const TOTAL_MS = 2900;

/** 彩带（从顶部飘落）数量。首版 30 条在 390pt 宽的屏上显得稀，加密到 44。 */
export const CONFETTI_COUNT = 44;

/**
 * 3 个爆点：正中先炸，左右两侧错峰跟上。
 *
 * 每个爆点的 `count` 与 `speed` 是"烟花够不够明显"的直接来源：
 * 首版是 15/12/12 个、速度 0.62/0.5/0.52，渲染预览出来是一小撮散点、不像烟花。
 * 现在加密到 30/24/24 并把速度提到 0.95/0.8/0.84 —— 同一时刻有更多射线在飞，
 * 配合"火花画成沿速度方向的短线"（见 particleStateAt 的 angle），才有爆开的观感。
 */
export const BURSTS = [
  { x: 0.5, y: 0.3, count: 30, delayMs: 0, speed: 0.95 },
  { x: 0.18, y: 0.22, count: 24, delayMs: 300, speed: 0.8 },
  { x: 0.82, y: 0.24, count: 24, delayMs: 580, speed: 0.84 },
] as const;

export type ParticleKind = "ribbon" | "dot" | "streamer" | "spark";

export interface Particle {
  kind: ParticleKind;
  /** 起点（容器宽/高的比例） */
  x0: number;
  y0: number;
  /** 速度（每秒移动的「容器比例」） */
  vx: number;
  vy: number;
  /** 重力（每秒平方的「容器比例」） */
  g: number;
  /** 尺寸（pt） */
  w: number;
  h: number;
  radius: number;
  color: string;
  opacity: number;
  delayMs: number;
  lifeMs: number;
  rot0: number;
  spin: number;
  /** 横向摆动幅度（容器比例）与频率 */
  swayAmp: number;
  swayFreq: number;
  /** 翻转频率（0 = 不翻转） */
  flipFreq: number;
  phase: number;
}

/** 可复现的伪随机（mulberry32）——避免 Math.random 让每次渲染的粒子都不同 */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 生成一组粒子（彩带 + 三个爆点的烟花火花）。同 seed → 同结果。 */
export function buildParticles(seed: number): Particle[] {
  const rand = makeRandom(seed);
  const out: Particle[] = [];
  const pick = () => PALETTE[Math.floor(rand() * PALETTE.length)] ?? PALETTE[0];

  // ---- 彩带：从屏幕上方飘落，横向摆动 + 翻转 ----
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    const roll = rand();
    const kind: ParticleKind = roll < 0.5 ? "ribbon" : roll < 0.8 ? "dot" : "streamer";
    const size = 5 + rand() * 6;
    out.push({
      kind,
      x0: rand(),
      y0: -0.08 - rand() * 0.12,
      vx: (rand() - 0.5) * 0.06,
      vy: 0.32 + rand() * 0.26,
      g: 0.05 + rand() * 0.06,
      w: kind === "dot" ? size : kind === "streamer" ? size * 0.6 : size * 1.5,
      h: kind === "dot" ? size : kind === "streamer" ? size * 3.2 : size * 0.62,
      radius: kind === "dot" ? 999 : kind === "streamer" ? 999 : 2,
      color: pick(),
      opacity: 0.92,
      delayMs: Math.floor(rand() * 620),
      lifeMs: 1500 + Math.floor(rand() * 520),
      rot0: rand() * 360,
      spin: (rand() - 0.5) * 900,
      swayAmp: 0.03 + rand() * 0.06,
      swayFreq: 2.4 + rand() * 3.4,
      flipFreq: 3 + rand() * 5,
      phase: rand() * Math.PI * 2,
    });
  }

  // ---- 烟花：每个爆点按球面角均匀散开，强重力下坠 ----
  for (const burst of BURSTS) {
    for (let i = 0; i < burst.count; i += 1) {
      // 加一点抖动，避免出现"完美的圆"这种一眼假的排布
      const angle = (i / burst.count) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const speed = burst.speed * (0.72 + rand() * 0.5);
      out.push({
        kind: "spark",
        x0: burst.x,
        y0: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        g: 0.42 + rand() * 0.24,
        // 火花画成**沿飞行方向的短线**（宽 > 高，再按速度角旋转）——
        // 圆点看不出"射线"，短线才有烟花爆开的样子。
        w: 11 + rand() * 9,
        h: 2.6 + rand() * 1.8,
        radius: 2,
        color: pick(),
        opacity: 1,
        delayMs: burst.delayMs + Math.floor(rand() * 60),
        lifeMs: 900 + Math.floor(rand() * 320),
        rot0: 0,
        spin: 0,
        swayAmp: 0,
        swayFreq: 0,
        flipFreq: 0,
        phase: 0,
      });
    }
  }

  return out;
}

/**
 * 单个粒子在全局进度 `progress`（0–1，映射到 TOTAL_MS）下的瞬时状态。
 * 抽成纯函数是为了让"运动学算得对不对"可单测，而不是只能靠肉眼在真机上看。
 */
export function particleStateAt(
  particle: Particle,
  progress: number,
  width: number,
  height: number
): { x: number; y: number; rotate: number; scaleY: number; opacity: number; angle: number } {
  const elapsed = progress * TOTAL_MS - particle.delayMs;
  const started = elapsed > 0;
  const life = started ? Math.min(1, elapsed / particle.lifeMs) : 0;
  const sec = (life * particle.lifeMs) / 1000;

  const sway =
    particle.swayAmp === 0 ? 0 : particle.swayAmp * Math.sin(sec * particle.swayFreq + particle.phase);
  const x = particle.x0 * width + particle.vx * width * sec + sway * width;
  const y = particle.y0 * height + particle.vy * height * sec + 0.5 * particle.g * height * sec * sec;

  // 起手 1/6 寿命淡入，末段 28% 淡出
  const fadeIn = Math.min(1, life * 6);
  const fadeOut = life > 0.72 ? Math.max(0, (1 - life) / 0.28) : 1;

  /**
   * 火花要沿"当前速度方向"摆：重力会让它越来越朝下，所以角度必须用**瞬时速度**算，
   * 而不是初始角度 —— 否则后半程射线会与飞行方向脱节。
   */
  const vxNow = particle.vx;
  const vyNow = particle.vy + particle.g * sec;
  const angle = (Math.atan2(vyNow, vxNow) * 180) / Math.PI;

  return {
    x,
    y,
    rotate: particle.kind === "spark" ? angle : particle.rot0 + particle.spin * life,
    scaleY:
      particle.flipFreq === 0
        ? 1
        : 0.35 + 0.65 * Math.abs(Math.cos(sec * particle.flipFreq + particle.phase)),
    opacity: started ? fadeIn * fadeOut * particle.opacity : 0,
    angle,
  };
}
