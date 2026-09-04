import Svg, { Circle } from "react-native-svg";

export function RingProgress({
  size = 160,
  strokeWidth = 12,
  progress = 0,
  trackColor = "rgba(120,90,45,0.14)",
  color = "#F28C28",
  children,
}: {
  size?: number;
  strokeWidth?: number;
  progress?: number;
  trackColor?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = c * (1 - clamped);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c}`}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {children}
    </Svg>
  );
}
