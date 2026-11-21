import type { IconProps } from "phosphor-react-native";

import { HouseIcon } from "phosphor-react-native/src/icons/House";
import { BookOpenIcon } from "phosphor-react-native/src/icons/BookOpen";
import { BriefcaseIcon } from "phosphor-react-native/src/icons/Briefcase";
import { LeafIcon } from "phosphor-react-native/src/icons/Leaf";
import { UserCircleIcon } from "phosphor-react-native/src/icons/UserCircle";
import { PlusIcon } from "phosphor-react-native/src/icons/Plus";
import { XIcon } from "phosphor-react-native/src/icons/X";
import { BellIcon } from "phosphor-react-native/src/icons/Bell";
import { BellRingingIcon } from "phosphor-react-native/src/icons/BellRinging";
import { MagnifyingGlassIcon } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { DotsThreeIcon } from "phosphor-react-native/src/icons/DotsThree";
import { ArrowsDownUpIcon } from "phosphor-react-native/src/icons/ArrowsDownUp";
import { StarIcon } from "phosphor-react-native/src/icons/Star";
import { CloudIcon } from "phosphor-react-native/src/icons/Cloud";
import { MoonIcon } from "phosphor-react-native/src/icons/Moon";
import { MoonStarsIcon } from "phosphor-react-native/src/icons/MoonStars";
import { SunIcon } from "phosphor-react-native/src/icons/Sun";
import { CircleHalfIcon } from "phosphor-react-native/src/icons/CircleHalf";
import { InfoIcon } from "phosphor-react-native/src/icons/Info";
import { QuestionIcon } from "phosphor-react-native/src/icons/Question";
import { SquaresFourIcon } from "phosphor-react-native/src/icons/SquaresFour";
import { GearIcon } from "phosphor-react-native/src/icons/Gear";
import { LockSimpleIcon } from "phosphor-react-native/src/icons/LockSimple";
import { AlarmIcon } from "phosphor-react-native/src/icons/Alarm";
import { ListChecksIcon } from "phosphor-react-native/src/icons/ListChecks";
import { FlagIcon } from "phosphor-react-native/src/icons/Flag";
import { TrendUpIcon } from "phosphor-react-native/src/icons/TrendUp";
import { TargetIcon } from "phosphor-react-native/src/icons/Target";
import { WrenchIcon } from "phosphor-react-native/src/icons/Wrench";
import { SparkleIcon } from "phosphor-react-native/src/icons/Sparkle";
import { FileTextIcon } from "phosphor-react-native/src/icons/FileText";
import { MedalIcon } from "phosphor-react-native/src/icons/Medal";
import { ChartLineIcon } from "phosphor-react-native/src/icons/ChartLine";
import { FolderIcon } from "phosphor-react-native/src/icons/Folder";
import { GitBranchIcon } from "phosphor-react-native/src/icons/GitBranch";
import { DropIcon } from "phosphor-react-native/src/icons/Drop";
import { ForkKnifeIcon } from "phosphor-react-native/src/icons/ForkKnife";
import { BarbellIcon } from "phosphor-react-native/src/icons/Barbell";
import { BookOpenTextIcon } from "phosphor-react-native/src/icons/BookOpenText";
import { FlowerLotusIcon } from "phosphor-react-native/src/icons/FlowerLotus";
import { FlameIcon } from "phosphor-react-native/src/icons/Flame";
import { TimerIcon } from "phosphor-react-native/src/icons/Timer";
import { CheckIcon } from "phosphor-react-native/src/icons/Check";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { CaretDownIcon } from "phosphor-react-native/src/icons/CaretDown";

/**
 * Phosphor 图标系统（V7 设计语言）。
 *
 * 为什么逐个子路径导入：phosphor-react-native 的根入口会把上千个图标全部挂到
 * 同一个模块上，Metro 对 CJS 不做 tree-shaking，直接 import 根入口会让 JS bundle
 * 多出几 MB。`phosphor-react-native/src/icons/*` 是包内声明的 exports 子路径，
 * 单图标单文件，只打进真正用到的那些。
 *
 * weight 规则（对齐 demo）：
 * - regular：常规信息、导航未选中
 * - bold：主操作、箭头、关闭
 * - fill：选中态与状态色（导航选中、收藏、火焰）
 * - duotone：卡片 / 列表图标（柔和两层）
 */
export type IconWeight = "regular" | "bold" | "fill" | "duotone";

export const ICON_WEIGHT = {
  regular: "regular",
  bold: "bold",
  fill: "fill",
  duotone: "duotone",
} as const;

/** 尺寸档位：与 demo 的 ic / ic-lg / ic-xl 一致，导航单独一档 28 */
export const ICON_SIZE = {
  sm: 16,
  md: 22,
  row: 21,
  lg: 24,
  nav: 28,
  xl: 28,
  xxl: 34,
} as const;

const ICONS = {
  today: HouseIcon,
  learn: BookOpenIcon,
  career: BriefcaseIcon,
  growth: LeafIcon,
  me: UserCircleIcon,
  plus: PlusIcon,
  close: XIcon,
  bell: BellIcon,
  bellRing: BellRingingIcon,
  search: MagnifyingGlassIcon,
  more: DotsThreeIcon,
  sort: ArrowsDownUpIcon,
  star: StarIcon,
  cloud: CloudIcon,
  moon: MoonIcon,
  moonStars: MoonStarsIcon,
  sun: SunIcon,
  theme: CircleHalfIcon,
  info: InfoIcon,
  help: QuestionIcon,
  tools: SquaresFourIcon,
  settings: GearIcon,
  lock: LockSimpleIcon,
  alarm: AlarmIcon,
  list: ListChecksIcon,
  flag: FlagIcon,
  trend: TrendUpIcon,
  target: TargetIcon,
  wrench: WrenchIcon,
  sparkle: SparkleIcon,
  resume: FileTextIcon,
  award: MedalIcon,
  chart: ChartLineIcon,
  folder: FolderIcon,
  github: GitBranchIcon,
  drop: DropIcon,
  food: ForkKnifeIcon,
  workout: BarbellIcon,
  reading: BookOpenTextIcon,
  stretch: FlowerLotusIcon,
  flame: FlameIcon,
  timer: TimerIcon,
  check: CheckIcon,
  chevron: CaretRightIcon,
  chevronDown: CaretDownIcon,
} as const;

export type IconName = keyof typeof ICONS;

export type AppIconProps = Omit<IconProps, "weight" | "size"> & {
  name: IconName;
  size?: number;
  weight?: IconWeight;
};

export function Icon({ name, size = ICON_SIZE.md, weight = "regular", ...rest }: AppIconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} weight={weight} {...rest} />;
}
