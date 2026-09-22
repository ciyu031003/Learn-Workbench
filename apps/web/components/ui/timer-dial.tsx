"use client";

/**
 * v13 U3：计时表盘（技法参考 uiverse.io/david-mohseni/young-frog-89 的秒表刻度盘, MIT）。
 * 只借"刻度 + 指针 + 中心轴"的构图，颜色沿用专注（橙红）/ 运动（晴空蓝）两套主题色。
 */
export function TimerDial({
  ratio,
  running,
  tone = "focus",
  size = 340,
}: {
  /** 0–1，表盘走针与进度弧都按它算 */
  ratio: number;
  running?: boolean;
  tone?: "focus" | "exercise";
  size?: number;
}) {
  const p = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const R = 118;
  const C = 2 * Math.PI * R;
  const gradId = tone === "exercise" ? "dial-grad-exercise" : "dial-grad-focus";
  const from = tone === "exercise" ? "#8bb7e8" : "#ffb25e";
  const to = tone === "exercise" ? "#2f74c0" : "#ff6a5e";
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <svg
      width={"min(72vw," + size + "px)"}
      height={"min(72vw," + size + "px)"}
      viewBox="0 0 300 300"
      role="img"
      aria-label={"计时表盘，进度 " + Math.round(p * 100) + "%"}
      className="drop-shadow-[0_6px_30px_rgba(0,0,0,0.4)]"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      {/* 外圈与刻度：每 5 格加长，读起来像真表盘 */}
      <circle cx="150" cy="150" r="132" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {ticks.map((i) => {
        const major = i % 5 === 0;
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const r1 = major ? 108 : 114;
        const r2 = 124;
        return (
          <line
            key={i}
            x1={150 + Math.cos(a) * r1}
            y1={150 + Math.sin(a) * r1}
            x2={150 + Math.cos(a) * r2}
            y2={150 + Math.sin(a) * r2}
            stroke={major ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)"}
            strokeWidth={major ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {/* 进度弧 */}
      <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="6" />
      <circle
        cx="150"
        cy="150"
        r={R}
        fill="none"
        stroke={"url(#" + gradId + ")"}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - p)}
        transform="rotate(-90 150 150)"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />

      {/* 指针与中心轴 */}
      <g transform={"rotate(" + p * 360 + " 150 150)"} style={{ transition: "transform 1s linear" }}>
        <line x1="150" y1="150" x2="150" y2="52" stroke={to} strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="150" cy="150" r="9" fill="rgba(255,255,255,0.92)" />
      <circle cx="150" cy="150" r="4" fill={running ? to : "rgba(255,255,255,0.5)"} />
    </svg>
  );
}
