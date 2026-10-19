import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUserId } from "@/lib/session";

/**
 * 必须按请求渲染：本页要读会话 cookie 决定「跳 dashboard」还是「给未登录访客看落地页」。
 * 若被静态预渲染，已登录用户会拿到缓存下来的落地页而不是跳转 —— 这是不可接受的回归。
 */
export const dynamic = "force-dynamic";

/**
 * 落地页（v1.27 Web 精修）。
 *
 * 之前 `/` 只是一句 redirect("/dashboard")，未登录用户会被 proxy 再弹到 /login，
 * 于是「产品是什么」完全没有机会讲清楚。现在：
 *   - 已登录 → 保持原行为，直接进 /dashboard（不改变任何既有体验）；
 *   - 未登录 → 展示真正的落地页，讲清「学习 / 职业 / 健康」三线主张与联动。
 *
 * 纯服务端组件 + 内联 CSS 动效：不引第三方图标包（避免 RSC 约束风险）、不加依赖。
 * 所有动画都在 prefers-reduced-motion: reduce 下关闭，并保留最终可见状态。
 */

const PILLARS = [
  {
    key: "learn",
    icon: "book",
    title: "学习",
    lead: "把「想学」变成可推进的路线",
    tone: "primary",
    points: ["阶段路线图与任务拆解", "25 分钟专注计时与统计", "费曼学习日志与复盘", "领域记录 · 习惯打卡"],
    href: "/roadmap",
    cta: "看路线图",
  },
  {
    key: "career",
    icon: "rocket",
    title: "职业",
    lead: "让每一次学习都落成职业资产",
    tone: "accent",
    points: ["就业雷达与岗位匹配", "技能树差距分析", "简历 / 证书 / 作品资产", "面试题库与投递跟踪"],
    href: "/career",
    cta: "看职业画像",
  },
  {
    key: "health",
    icon: "dumbbell",
    title: "健康",
    lead: "状态在线，成长才可持续",
    tone: "success",
    points: ["训练记录与运动档案", "今日饮食与营养目标", "精力 · 饮水 · 睡眠打卡", "连续天数与闪光卡"],
    href: "/wellbeing",
    cta: "看健康面板",
  },
] as const;

/** 三线联动：这是本项目的性格所在，落地页必须讲清楚，而不是罗列功能 */
const LINKS = [
  {
    from: "学习 → 职业",
    title: "任务完成会喂给技能树",
    body: "路线图阶段、专注时长与日志产出，直接参与技能熟练度与岗位匹配度的计算，不用手工再填一遍。",
  },
  {
    from: "专注 → 健康",
    title: "精力水位决定今天练什么",
    body: "精力与睡眠记录会影响当日建议强度；训练与饮食又反过来支撑长时间专注。",
  },
  {
    from: "坚持 → 可见",
    title: "连续打卡会长成一张闪光卡",
    body: "习惯连续天数、运动档案与阶段成果可以生成卡片，分享出去的是进度，不是又一个待办清单。",
  },
] as const;

const ICON_PATHS: Record<string, string[]> = {
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z", "M19 18v3H6.5"],
  rocket: ["M9 13l-1 3 3-1 4-4a8 8 0 0 0 2-5 8 8 0 0 0-5 2z", "M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"],
  dumbbell: ["M6 7v10", "M3.5 9.5v5", "M18 7v10", "M20.5 9.5v5", "M6 12h12"],
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  check: ["M4.5 12.5l4.5 4.5L19.5 6.5"],
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M6 6l2.4 2.4", "M15.6 15.6L18 18", "M18 6l-2.4 2.4", "M8.4 15.6L6 18"],
};

function Icon({ name, className }: { name: string; className?: string }) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.check;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export default async function Home() {
  // 未登录（或数据库暂时不可用）时展示落地页，而不是抛错
  const uid = await currentUserId().catch(() => null);
  if (uid) redirect("/dashboard");

  return (
    <div className="lwb-land">
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      {/* 流动呼吸光效层（与移动端流光呼应；减弱动态时静止） */}
      <div className="lwb-aurora" aria-hidden>
        <span className="lwb-orb lwb-orb-a" />
        <span className="lwb-orb lwb-orb-b" />
        <span className="lwb-orb lwb-orb-c" />
        <span className="lwb-grid" />
      </div>

      <header className="lwb-nav">
        <div className="lwb-nav-inner">
          <span className="lwb-brand">
            <img src="/app-icon.png" alt="" className="lwb-logo" />
            <span className="lwb-brand-text">
              <span className="lwb-brand-name">学习工作台</span>
              <span className="lwb-brand-sub">学习 · 职业 · 健康</span>
            </span>
          </span>
          <nav className="lwb-nav-actions">
            <a href="https://learn.yuanabd.cn/download.html" className="lwb-ghost">
              下载 App
            </a>
            <Link href="/login" className="lwb-solid">
              进入工作台
              <Icon name="arrow" className="lwb-i" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="lwb-main">
        <section className="lwb-hero">
          <span className="lwb-eyebrow lwb-rise" style={{ animationDelay: "0ms" }}>
            <Icon name="spark" className="lwb-i" />
            一条主线，三线联动
          </span>
          <h1 className="lwb-h1 lwb-rise" style={{ animationDelay: "70ms" }}>
            把<span className="lwb-grad">学习、职业与健康</span>
            <br />
            放进同一条成长曲线
          </h1>
          <p className="lwb-sub lwb-rise" style={{ animationDelay: "140ms" }}>
            不是又一个待办清单。路线图推进技能树，技能树决定岗位匹配；专注时长与运动、饮食、精力互相校准 ——
            <span className="lwb-sub-strong">你只记录一次，三条线一起往前走。</span>
          </p>
          <div className="lwb-cta-row lwb-rise" style={{ animationDelay: "210ms" }}>
            <Link href="/login" className="lwb-cta">
              立即开始
              <Icon name="arrow" className="lwb-i" />
            </Link>
            <a href="https://learn.yuanabd.cn/download.html" className="lwb-cta-ghost">
              下载 Android 版
            </a>
          </div>
          <ul className="lwb-facts lwb-rise" style={{ animationDelay: "280ms" }}>
            <li>Web + Android 双端同步</li>
            <li>三线数据自动联动，不重复填写</li>
            <li>进度可导出为分享卡</li>
          </ul>
        </section>

        <section className="lwb-pillars" aria-label="三条主线">
          {PILLARS.map((p, i) => (
            <article key={p.key} className={"lwb-card lwb-tone-" + p.tone + " lwb-rise"} style={{ animationDelay: 120 + i * 90 + "ms" }}>
              <span className="lwb-card-icon">
                <Icon name={p.icon} className="lwb-i-lg" />
              </span>
              <h2 className="lwb-card-title">{p.title}</h2>
              <p className="lwb-card-lead">{p.lead}</p>
              <ul className="lwb-card-points">
                {p.points.map((pt) => (
                  <li key={pt}>
                    <Icon name="check" className="lwb-i-check" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className="lwb-card-link">
                {p.cta}
                <Icon name="arrow" className="lwb-i" />
              </Link>
            </article>
          ))}
        </section>

        <section className="lwb-links" aria-label="三线如何联动">
          <h2 className="lwb-h2">三线不是三个 App，而是互相供电</h2>
          <div className="lwb-link-rows">
            {LINKS.map((l, i) => (
              <div key={l.from} className="lwb-link-row lwb-rise" style={{ animationDelay: 80 + i * 80 + "ms" }}>
                <span className="lwb-link-from">{l.from}</span>
                <div>
                  <p className="lwb-link-title">{l.title}</p>
                  <p className="lwb-link-body">{l.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lwb-final">
          <div className="lwb-final-card">
            <h2 className="lwb-h2">今天就把第一条线跑起来</h2>
            <p className="lwb-final-sub">先记一条训练、勾一个任务、看一眼岗位匹配 —— 五分钟就能看到三条线同时前进。</p>
            <div className="lwb-cta-row">
              <Link href="/login" className="lwb-cta">
                进入工作台
                <Icon name="arrow" className="lwb-i" />
              </Link>
              <a href="https://learn.yuanabd.cn/download.html" className="lwb-cta-ghost">
                下载 APK
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lwb-foot">
        <span>学习工作台 · 学习 / 职业 / 健康三线成长工作台</span>
        <span className="lwb-foot-links">
          <Link href="/login">登录</Link>
          <a href="https://learn.yuanabd.cn/download.html">下载</a>
        </span>
      </footer>
    </div>
  );
}

const LANDING_CSS = [
  ".lwb-land{position:relative;min-height:100vh;overflow-x:clip;background:var(--color-canvas);color:var(--color-text);isolation:isolate}",
  ".lwb-aurora{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}",
  ".lwb-orb{position:absolute;border-radius:9999px;filter:blur(70px);opacity:.55;will-change:transform,opacity}",
  ".lwb-orb-a{width:620px;height:620px;top:-220px;left:-140px;background:radial-gradient(closest-side,rgba(47,116,192,.55),rgba(47,116,192,0) 72%);animation:lwb-drift-a 24s ease-in-out infinite alternate}",
  ".lwb-orb-b{width:520px;height:520px;top:120px;right:-180px;background:radial-gradient(closest-side,rgba(225,120,28,.42),rgba(225,120,28,0) 72%);animation:lwb-drift-b 19s ease-in-out infinite alternate}",
  ".lwb-orb-c{width:560px;height:560px;bottom:-180px;left:32%;background:radial-gradient(closest-side,rgba(61,163,93,.34),rgba(61,163,93,0) 72%);animation:lwb-drift-c 27s ease-in-out infinite alternate}",
  ".lwb-grid{position:absolute;inset:0;opacity:.5;background-image:linear-gradient(rgba(90,80,60,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(90,80,60,.06) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(120% 80% at 50% 0,black,transparent 72%)}",
  "html.dark .lwb-orb{opacity:.4}",
  "html.dark .lwb-grid{background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)}",
  "@keyframes lwb-drift-a{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(70px,44px,0) scale(1.16)}}",
  "@keyframes lwb-drift-b{from{transform:translate3d(0,0,0) scale(1.1)}to{transform:translate3d(-64px,30px,0) scale(.96)}}",
  "@keyframes lwb-drift-c{from{transform:translate3d(0,0,0) scale(.98)}to{transform:translate3d(38px,-48px,0) scale(1.14)}}",
  ".lwb-nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(12px) saturate(1.25);background:color-mix(in srgb,var(--color-canvas) 78%,transparent);border-bottom:1px solid var(--color-border)}",
  ".lwb-nav-inner{max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 20px}",
  ".lwb-brand{display:flex;align-items:center;gap:10px}",
  ".lwb-logo{width:36px;height:36px;border-radius:12px;box-shadow:0 2px 10px rgba(60,50,30,.16)}",
  ".lwb-brand-text{display:flex;flex-direction:column;line-height:1.15}",
  ".lwb-brand-name{font-size:15px;font-weight:650}",
  ".lwb-brand-sub{font-size:11px;color:var(--color-muted-foreground)}",
  ".lwb-nav-actions{display:flex;align-items:center;gap:10px}",
  ".lwb-ghost{font-size:13px;color:var(--color-muted-foreground);padding:8px 10px;border-radius:12px;transition:color .2s,background .2s}",
  ".lwb-ghost:hover{color:var(--color-text);background:var(--color-muted)}",
  ".lwb-solid{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:9px 14px;border-radius:12px;background:var(--color-primary);color:var(--color-primary-foreground);box-shadow:0 8px 22px -10px rgba(47,116,192,.9);transition:transform .2s,box-shadow .2s}",
  ".lwb-solid:hover{transform:translateY(-1px);box-shadow:0 12px 26px -10px rgba(47,116,192,1)}",
  ".lwb-main{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:0 20px 72px}",
  ".lwb-hero{position:relative;padding:76px 0 56px;text-align:center;overflow:hidden}",
  ".lwb-hero::after{content:'';position:absolute;top:-40%;left:-60%;width:60%;height:180%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);transform:rotate(8deg);animation:lwb-sheen 9s ease-in-out infinite;pointer-events:none}",
  "html.dark .lwb-hero::after{background:linear-gradient(100deg,transparent,rgba(255,255,255,.1),transparent)}",
  "@keyframes lwb-sheen{0%{left:-60%}55%{left:120%}100%{left:120%}}",
  ".lwb-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.02em;padding:6px 12px;border-radius:9999px;border:1px solid var(--color-border);background:color-mix(in srgb,var(--color-surface) 70%,transparent);color:var(--color-muted-foreground)}",
  ".lwb-h1{margin:18px auto 0;max-width:16ch;font-size:clamp(30px,5.2vw,54px);line-height:1.12;font-weight:800;letter-spacing:-.02em}",
  ".lwb-grad{background:linear-gradient(96deg,var(--color-primary),var(--color-accent));-webkit-background-clip:text;background-clip:text;color:transparent}",
  ".lwb-sub{margin:18px auto 0;max-width:62ch;font-size:15px;line-height:1.75;color:var(--color-muted-foreground)}",
  ".lwb-sub-strong{color:var(--color-text);font-weight:600}",
  ".lwb-cta-row{margin-top:26px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}",
  ".lwb-cta{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:650;padding:13px 22px;border-radius:14px;background:linear-gradient(120deg,var(--color-primary),var(--color-primary-strong));color:var(--color-primary-foreground);box-shadow:0 14px 34px -16px rgba(47,116,192,1);transition:transform .22s,box-shadow .22s}",
  ".lwb-cta:hover{transform:translateY(-2px);box-shadow:0 20px 40px -16px rgba(47,116,192,1)}",
  ".lwb-cta-ghost{display:inline-flex;align-items:center;gap:8px;font-size:15px;font-weight:600;padding:13px 22px;border-radius:14px;border:1px solid var(--color-border);background:color-mix(in srgb,var(--color-surface) 72%,transparent);color:var(--color-text);transition:transform .22s,border-color .22s}",
  ".lwb-cta-ghost:hover{transform:translateY(-2px);border-color:var(--color-accent)}",
  ".lwb-facts{margin:30px auto 0;display:flex;flex-wrap:wrap;gap:8px 22px;justify-content:center;list-style:none;padding:0;font-size:12.5px;color:var(--color-muted-foreground)}",
  ".lwb-facts li{position:relative;padding-left:16px}",
  ".lwb-facts li::before{content:'';position:absolute;left:0;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:9999px;background:var(--color-primary)}",
  ".lwb-pillars{margin-top:24px;display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(268px,1fr))}",
  ".lwb-card{position:relative;display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:22px;border:1px solid var(--color-border);background:color-mix(in srgb,var(--color-surface) 82%,transparent);backdrop-filter:blur(10px);transition:transform .34s cubic-bezier(.22,.68,.32,1),box-shadow .34s,border-color .34s}",
  ".lwb-card:hover{transform:translateY(-6px);border-color:color-mix(in srgb,var(--color-primary) 45%,var(--color-border));box-shadow:0 24px 60px -30px rgba(47,116,192,.75)}",
  ".lwb-card-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;background:color-mix(in srgb,var(--color-primary) 14%,transparent);color:var(--color-primary)}",
  ".lwb-tone-accent .lwb-card-icon{background:color-mix(in srgb,var(--color-accent) 16%,transparent);color:var(--color-accent)}",
  ".lwb-tone-success .lwb-card-icon{background:color-mix(in srgb,var(--color-success) 16%,transparent);color:var(--color-success)}",
  ".lwb-card-title{margin:4px 0 0;font-size:20px;font-weight:750}",
  ".lwb-card-lead{margin:0;font-size:13.5px;color:var(--color-muted-foreground)}",
  ".lwb-card-points{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}",
  ".lwb-card-points li{display:flex;align-items:flex-start;gap:8px;font-size:13.5px}",
  ".lwb-card-link{margin-top:auto;padding-top:12px;display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:650;color:var(--color-primary);transition:gap .2s}",
  ".lwb-card-link:hover{gap:11px}",
  ".lwb-links{margin-top:64px}",
  ".lwb-h2{margin:0;font-size:clamp(20px,3vw,28px);font-weight:750;letter-spacing:-.01em;text-align:center}",
  ".lwb-link-rows{margin-top:24px;display:flex;flex-direction:column;gap:12px}",
  ".lwb-link-row{display:grid;grid-template-columns:minmax(96px,140px) 1fr;gap:16px;align-items:start;padding:18px 20px;border-radius:18px;border:1px solid var(--color-border);background:color-mix(in srgb,var(--color-surface) 66%,transparent)}",
  ".lwb-link-from{font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--color-primary);padding-top:2px}",
  ".lwb-link-title{margin:0;font-size:15px;font-weight:650}",
  ".lwb-link-body{margin:6px 0 0;font-size:13.5px;line-height:1.7;color:var(--color-muted-foreground)}",
  ".lwb-final{margin-top:64px}",
  ".lwb-final-card{position:relative;overflow:hidden;padding:40px 24px;border-radius:26px;border:1px solid var(--color-border);background:linear-gradient(120deg,color-mix(in srgb,var(--color-primary) 12%,transparent),color-mix(in srgb,var(--color-accent) 12%,transparent))}",
  ".lwb-final-sub{margin:12px auto 0;max-width:52ch;text-align:center;font-size:14px;color:var(--color-muted-foreground)}",
  ".lwb-foot{position:relative;z-index:1;max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:22px 20px 40px;font-size:12px;color:var(--color-muted-foreground)}",
  ".lwb-foot-links{display:flex;gap:16px}",
  ".lwb-foot-links a{transition:color .2s}",
  ".lwb-foot-links a:hover{color:var(--color-text)}",
  ".lwb-i{width:16px;height:16px}",
  ".lwb-i-lg{width:22px;height:22px}",
  ".lwb-i-check{width:14px;height:14px;flex-shrink:0;margin-top:3px;color:var(--color-success)}",
  ".lwb-rise{animation:lwb-rise .72s cubic-bezier(.22,.68,.32,1) both}",
  "@keyframes lwb-rise{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}",
  "@media (max-width:640px){.lwb-hero{padding:48px 0 36px}.lwb-link-row{grid-template-columns:1fr;gap:8px}}",
  "@media (prefers-reduced-motion:reduce){.lwb-orb,.lwb-hero::after{animation:none}.lwb-hero::after{opacity:0}.lwb-rise{animation:none;opacity:1;transform:none}.lwb-card,.lwb-cta,.lwb-cta-ghost,.lwb-solid{transition:none}}",
].join("\n");
