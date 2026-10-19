"use client";

/**
 * 页面级共享动效样式（v1.27 Web 精修）—— 从 `components/app-shell.tsx` 原样抽出。
 *
 * 与 `globals.css` 里既有的 .ambient-glow / .page-enter 互补，不重叠命名：
 * 这里只提供「顶栏动效 + 页面光效层 + 入场 stagger」，由 AppShell 挂载
 * （today / dashboard 各引一次即可）。全部动效在 prefers-reduced-motion: reduce 下关闭。
 */
export function WebMotionStyles() {
  return <style dangerouslySetInnerHTML={{ __html: WEB_MOTION_CSS }} />;
}

export const WEB_MOTION_CSS = [
  ".lwb-nav-pill{position:absolute;left:0;top:50%;height:38px;margin-top:-19px;z-index:0;border-radius:12px;background:color-mix(in srgb,var(--color-primary) 13%,transparent);border:1px solid color-mix(in srgb,var(--color-primary) 24%,transparent);box-shadow:0 6px 18px -12px rgba(47,116,192,.9);opacity:0;pointer-events:none;transition:transform .34s cubic-bezier(.22,.68,.32,1),width .34s cubic-bezier(.22,.68,.32,1),opacity .18s ease-out}",
  ".lwb-nav-pill[data-on='true']{opacity:1}",
  ".lwb-nav-icon{transition:transform .28s cubic-bezier(.22,.68,.32,1)}",
  ".lwb-nav-item:hover .lwb-nav-icon{transform:scale(1.14) rotate(-4deg)}",
  ".lwb-menu{animation:lwb-menu-in .22s cubic-bezier(.22,.68,.32,1) both;transform-origin:top left}",
  "@keyframes lwb-menu-in{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}",
  ".lwb-menu-item{transition:transform .18s ease-out,background-color .18s ease-out}",
  ".lwb-menu-item:hover{transform:translateX(2px)}",
  ".lwb-menu-icon{transition:transform .2s ease-out,color .2s ease-out}",
  ".lwb-menu-item:hover .lwb-menu-icon{color:var(--color-primary);transform:scale(1.1)}",
  ".lwb-tab-icon{position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:26px;border-radius:12px;transition:background-color .24s ease-out}",
  ".lwb-tab-icon[data-active='true']{background:color-mix(in srgb,var(--color-primary) 14%,transparent)}",
  ".lwb-tab-icon[data-active='true'][data-tone='accent']{background:color-mix(in srgb,var(--color-accent) 16%,transparent)}",
  ".lwb-tab-icon[data-active='true']::after{content:'';position:absolute;top:-5px;left:50%;width:16px;height:2.5px;margin-left:-8px;border-radius:9999px;background:currentColor;animation:lwb-tab-bar .34s cubic-bezier(.22,.68,.32,1) both}",
  "@keyframes lwb-tab-bar{from{transform:scaleX(.3);opacity:0}to{transform:scaleX(1);opacity:.9}}",
  ".lwb-page-aurora{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}",
  ".lwb-page-orb{position:absolute;border-radius:9999px;filter:blur(64px);opacity:.4;will-change:transform,opacity}",
  ".lwb-page-orb-a{width:460px;height:460px;top:-180px;right:-120px;background:radial-gradient(closest-side,rgba(47,116,192,.5),rgba(47,116,192,0) 72%);animation:lwb-page-drift-a 22s ease-in-out infinite alternate}",
  ".lwb-page-orb-b{width:420px;height:420px;bottom:-160px;left:-100px;background:radial-gradient(closest-side,rgba(225,120,28,.4),rgba(225,120,28,0) 72%);animation:lwb-page-drift-b 17s ease-in-out infinite alternate}",
  ".lwb-page-orb-c{width:360px;height:360px;top:38%;left:46%;background:radial-gradient(closest-side,rgba(61,163,93,.3),rgba(61,163,93,0) 72%);animation:lwb-page-drift-c 25s ease-in-out infinite alternate}",
  "html.dark .lwb-page-orb{opacity:.3}",
  "@keyframes lwb-page-drift-a{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(-46px,34px,0) scale(1.14)}}",
  "@keyframes lwb-page-drift-b{from{transform:translate3d(0,0,0) scale(1.06)}to{transform:translate3d(40px,-26px,0) scale(.95)}}",
  "@keyframes lwb-page-drift-c{from{transform:translate3d(0,0,0) scale(.96)}to{transform:translate3d(28px,30px,0) scale(1.1)}}",
  "@keyframes lwb-rise-in{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}",
  ".lwb-stagger>*{animation:lwb-rise-in .58s cubic-bezier(.22,.68,.32,1) both}",
  ".lwb-stagger>*:nth-child(1){animation-delay:0ms}",
  ".lwb-stagger>*:nth-child(2){animation-delay:70ms}",
  ".lwb-stagger>*:nth-child(3){animation-delay:140ms}",
  ".lwb-stagger>*:nth-child(4){animation-delay:210ms}",
  ".lwb-stagger>*:nth-child(5){animation-delay:280ms}",
  ".lwb-stagger>*:nth-child(6){animation-delay:350ms}",
  ".lwb-stagger>*:nth-child(7){animation-delay:420ms}",
  ".lwb-stagger>*:nth-child(8){animation-delay:490ms}",
  ".lwb-stagger>*:nth-child(n+9){animation-delay:540ms}",
  ".lwb-lift{transition:transform .3s cubic-bezier(.22,.68,.32,1),box-shadow .3s ease-out}",
  ".lwb-lift:hover{transform:translateY(-4px)}",
  ".lwb-sheen{position:relative;overflow:hidden}",
  ".lwb-sheen::after{content:'';position:absolute;top:-60%;left:-70%;width:45%;height:220%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.34),transparent);transform:rotate(9deg);animation:lwb-sheen-sweep 8.5s ease-in-out infinite;pointer-events:none}",
  "html.dark .lwb-sheen::after{background:linear-gradient(100deg,transparent,rgba(255,255,255,.09),transparent)}",
  "@keyframes lwb-sheen-sweep{0%{left:-70%}52%{left:130%}100%{left:130%}}",
  "@media (prefers-reduced-motion:reduce){.lwb-nav-pill,.lwb-nav-icon,.lwb-menu,.lwb-menu-item,.lwb-menu-icon,.lwb-tab-icon,.lwb-lift{transition:none}.lwb-menu,.lwb-page-orb,.lwb-stagger>*,.lwb-sheen::after,.lwb-tab-icon[data-active='true']::after{animation:none}.lwb-page-orb{opacity:.22}.lwb-sheen::after{opacity:0}.lwb-stagger>*{opacity:1;transform:none}}",
].join("\n");
