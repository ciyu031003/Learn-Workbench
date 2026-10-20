import type { SVGProps } from "react";

/**
 * 公开页专用内联图标（S8-b）。
 *
 * 为什么不用 lucide-react：公开页首载预算被 69+42KB 的 framework 基线占满，
 * 而 lucide 为了 8 个图标会额外拉一个 ~9KB gz 的共享图标 chunk（公共页共享 chunk 里
 * 同时含全部按需导出的 lucide 运行时）。公开页只需要 10 个图标，直接内联 SVG 后
 * 图标成本降到 ~1.5KB gz，且没有额外 chunk 往返。
 *
 * 约束：只放公开页（登录/分享）用到的图标；应用区继续用 lucide（那边 chunk 已被
 * AppShell 等页面共享，内联反而增加重复）。
 */

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

function Svg({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg {...BASE} width="1em" height="1em" {...props}>
      {children}
    </svg>
  );
}

export function CheckCircle2(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function KeyRound(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.2-8.2M16 7l2 2M18.5 4.5l2 2" />
    </Svg>
  );
}

export function Loader2(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 1 1-6.2-8.56" />
    </Svg>
  );
}

export function Lock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Svg>
  );
}

export function Mail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </Svg>
  );
}

export function MessageCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20l1-4.8A8.5 8.5 0 1 1 21 11.5Z" />
    </Svg>
  );
}

export function User(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}

export function UserRoundPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 6.5v5M16.5 9h5" />
    </Svg>
  );
}

export function Share2(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
    </Svg>
  );
}

export function Sparkles(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.6 8l4.4 1.6-4.4 1.6L12 15.6 10.4 11.2 6 9.6 10.4 8 12 3.5Z" />
      <path d="M19 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </Svg>
  );
}
