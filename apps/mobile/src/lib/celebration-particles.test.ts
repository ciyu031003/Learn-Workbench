import { describe, expect, it } from "vitest";
import {
  BURSTS,
  CONFETTI_COUNT,
  PALETTE,
  RING_MS,
  TOTAL_MS,
  buildParticles,
  burstRingStateAt,
  makeRandom,
  particleStateAt,
} from "./celebration-particles";

/**
 * v1.44 庆祝特效单测。
 *
 * 用户真机反馈是「烟花效果并不明显，只有几条彩带，彩带也只是几个颜色的矩形」，
 * 所以这里锁的不是"代码能跑"，而是**那些让效果看起来寒酸的具体量**：
 * 粒子总数、颜色种数、形状种数、时间轴是否被截断、同种子是否稳定。
 */

describe("buildParticles", () => {
  const particles = buildParticles(0x9e3779b9);

  it("粒子总量足够（旧版只有 36 个同源粒子）", () => {
    expect(particles.length).toBeGreaterThan(60);
  });

  it("彩带与烟花两类都有，且数量与常量一致", () => {
    const confetti = particles.filter((p) => p.kind !== "spark");
    const sparks = particles.filter((p) => p.kind === "spark");
    expect(confetti).toHaveLength(CONFETTI_COUNT);
    expect(sparks).toHaveLength(BURSTS.reduce((sum, b) => sum + b.count, 0));
  });

  it("颜色不是「只有几个色」：至少用到 8 种调色板颜色", () => {
    const used = new Set(particles.map((p) => p.color));
    expect(used.size).toBeGreaterThanOrEqual(8);
    for (const color of used) expect(PALETTE).toContain(color);
  });

  it("形状不止矩形：彩带里 ribbon / dot / streamer 三种都出现", () => {
    const kinds = new Set(particles.filter((p) => p.kind !== "spark").map((p) => p.kind));
    expect(kinds).toEqual(new Set(["ribbon", "dot", "streamer"]));
  });

  it("没有粒子被时间轴截断（delay + life 不超过 TOTAL_MS）", () => {
    // 不只看默认种子：跑一批种子，因为延迟/寿命是随机的。
    // 这条断言抓到过一次真实缺陷（TOTAL_MS=2600 时最坏 2635ms，尾部 35ms 被截断）。
    let worst = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      for (const p of buildParticles(seed)) {
        worst = Math.max(worst, p.delayMs + p.lifeMs);
      }
    }
    expect(worst).toBeLessThanOrEqual(TOTAL_MS);
  });

  it("爆点密度足够（首版 15/12/12 渲染出来像一小撮散点，不像烟花）", () => {
    for (const b of BURSTS) expect(b.count).toBeGreaterThanOrEqual(20);
    expect(BURSTS.reduce((sum, b) => sum + b.count, 0)).toBeGreaterThanOrEqual(70);
  });

  it("彩带数量足够（首版 30 条在 390pt 宽屏上偏稀）", () => {
    expect(CONFETTI_COUNT).toBeGreaterThanOrEqual(40);
  });

  it("三个爆点确实是错峰的（不是同一时刻全炸）", () => {
    const delays = [...new Set(BURSTS.map((b) => b.delayMs))];
    expect(delays).toHaveLength(3);
    expect(Math.max(...delays)).toBeGreaterThan(400);
  });

  it("同一个种子产出完全一致的粒子（避免每次渲染都换一批）", () => {
    expect(buildParticles(42)).toEqual(buildParticles(42));
  });

  it("不同种子产出不同粒子（「再庆祝一次」有新意）", () => {
    expect(buildParticles(1)).not.toEqual(buildParticles(2));
  });

  it("彩带都从屏幕上方之外起步（y0 < 0）", () => {
    for (const p of particles.filter((x) => x.kind !== "spark")) {
      expect(p.y0).toBeLessThan(0);
    }
  });

  it("烟花火花有重力（g > 0），彩带也有（否则不像飘落）", () => {
    for (const p of particles) expect(p.g).toBeGreaterThan(0);
  });
});

describe("burstRingStateAt（爆点扩散光环）", () => {
  it("起爆前不可见", () => {
    expect(burstRingStateAt(500, 0).opacity).toBe(0);
    expect(burstRingStateAt(500, 400 / TOTAL_MS).opacity).toBe(0);
  });

  it("爆发中可见并向外扩散（scale 递增、opacity 递减）", () => {
    const early = burstRingStateAt(0, (RING_MS * 0.15) / TOTAL_MS);
    const late = burstRingStateAt(0, (RING_MS * 0.8) / TOTAL_MS);
    expect(early.opacity).toBeGreaterThan(0);
    expect(early.opacity).toBeGreaterThan(late.opacity);
    expect(late.scale).toBeGreaterThan(early.scale);
  });

  it("光环演完后完全消失（不会留一个静止的圈）", () => {
    expect(burstRingStateAt(0, (RING_MS + 1) / TOTAL_MS).opacity).toBe(0);
  });

  it("三个爆点的光环都在时间轴内演完", () => {
    for (const b of BURSTS) expect(b.delayMs + RING_MS).toBeLessThanOrEqual(TOTAL_MS);
  });
});

describe("makeRandom", () => {
  it("输出稳定落在 [0,1)", () => {
    const rand = makeRandom(7);
    for (let i = 0; i < 200; i += 1) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("particleStateAt", () => {
  const particles = buildParticles(0x1234567);

  it("进度 0 时全部不可见（不会闪一帧）", () => {
    for (const p of particles) {
      expect(particleStateAt(p, 0, 400, 800).opacity).toBe(0);
    }
  });

  it("延迟未到时仍然不可见", () => {
    const delayed = particles.filter((p) => p.delayMs > 300);
    expect(delayed.length).toBeGreaterThan(0);
    for (const p of delayed) {
      const progress = (p.delayMs - 50) / TOTAL_MS;
      expect(particleStateAt(p, progress, 400, 800).opacity).toBe(0);
    }
  });

  it("寿命终点淡出到 0（粒子不会「啪」地消失）", () => {
    for (const p of particles.slice(0, 12)) {
      const endProgress = (p.delayMs + p.lifeMs) / TOTAL_MS;
      expect(particleStateAt(p, endProgress, 400, 800).opacity).toBeCloseTo(0, 5);
    }
  });

  it("活着的时候至少有一次可见（否则等于没画）", () => {
    for (const p of particles) {
      const mid = (p.delayMs + p.lifeMs * 0.4) / TOTAL_MS;
      expect(particleStateAt(p, mid, 400, 800).opacity).toBeGreaterThan(0.3);
    }
  });

  it("烟花火花会下坠（重力生效：后半程 y 比前半程大）", () => {
    const spark = particles.find((p) => p.kind === "spark")!;
    const early = particleStateAt(spark, (spark.delayMs + spark.lifeMs * 0.2) / TOTAL_MS, 400, 800).y;
    const late = particleStateAt(spark, (spark.delayMs + spark.lifeMs * 0.8) / TOTAL_MS, 400, 800).y;
    expect(late).toBeGreaterThan(early);
  });

  it("彩带有翻转（scaleY 在 0.35–1 之间呼吸，不是恒为 1）", () => {
    const ribbon = particles.find((p) => p.kind === "ribbon")!;
    const samples = Array.from({ length: 12 }, (_, i) =>
      particleStateAt(ribbon, (ribbon.delayMs + (ribbon.lifeMs * i) / 12) / TOTAL_MS, 400, 800).scaleY
    );
    expect(new Set(samples).size).toBeGreaterThan(1);
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(0.35);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("尺寸按容器缩放：容器越大位移越大（不写死像素）", () => {
    const p = particles[0];
    const progress = (p.delayMs + p.lifeMs * 0.5) / TOTAL_MS;
    const small = particleStateAt(p, progress, 200, 400);
    const large = particleStateAt(p, progress, 400, 800);
    expect(Math.abs(large.x - small.x)).toBeGreaterThan(0);
    expect(Math.abs(large.y - small.y)).toBeGreaterThan(0);
  });
});
