/**
 * v2.1 移动端数据面板组件库（RN 自研，视觉对齐 BoardUI 仪表盘）。
 *
 * 说明：BoardUI 是 Web React 组件（DOM + Tailwind），**不能装进 RN**；这里按截图的视觉语言
 * 用 react-native-svg + theme tokens 重写，几何/归一/文案全部落在 lib/chart-math.ts 并单测。
 * 所有组件均为静态渲染，本批次不接任何动画 API（动效后续统一批次再加）。
 */
export { ActivityRings } from "./activity-rings";
export type { ActivityRingItem } from "./activity-rings";
export { AreaChart } from "./area-chart";
export type { AreaChartSeries } from "./area-chart";
export { BarList } from "./bar-list";
export type { BarListItem } from "./bar-list";
export { ChartHeader } from "./chart-header";
export { HeatmapCalendar } from "./heatmap-calendar";
export { RadarChart } from "./radar-chart";
export type { RadarAxis } from "./radar-chart";
export { SegmentRing } from "./segment-ring";
export type { SegmentRingItem } from "./segment-ring";
export { StatTile, StatTileRow } from "./stat-tile";
export type { StatDelta, StatTileProps, StatTone } from "./stat-tile";
export { StepsBar } from "./steps-bar";
export type { StepsBarItem } from "./steps-bar";
export { useChartWidth } from "./use-chart-width";
