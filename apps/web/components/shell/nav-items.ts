import type { ShellIcon } from "./icons";
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Dumbbell,
  FileText,
  Flower,
  FolderGit2,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Map,
  MessageSquare,
  NotebookPen,
  Radar,
  Repeat,
  Rocket,
  Salad,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Users,
} from "./icons";

/**
 * AppShell 的导航数据与纯判断（原样从 `components/app-shell.tsx` 抽出，供路由组复用）。
 *
 * 只放"数据 + 纯函数"：链接、文案、图标、hash、选中态判定。
 * 视觉/DOM 由 `components/shell/*` 组件负责，这里是可单测的纯层。
 */
export interface ShellNavItem {
  href: string;
  label: string;
  icon: ShellIcon;
  /** 锚点（如专注入口的 #focus），拼接在 href 之后 */
  hash?: string;
}

/** 一级入口：首页 / 我的一天 */
export const NAV: readonly ShellNavItem[] = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/today", label: "我的一天", icon: Sparkles },
];

/** 学习分组（路线图 / 今日任务 / 专注 / 日志 / 领域记录 / 习惯 / 健康） */
export const LEARN_ITEMS: ShellNavItem[] = [
  { href: "/learn", label: "技术课程", icon: BookOpen },
  { href: "/roadmap", label: "路线图", icon: Map },
  { href: "/tasks", label: "今日任务", icon: ListTodo },
  { href: "/tasks", label: "专注", icon: Timer, hash: "#focus" },
  { href: "/logs", label: "学习日志", icon: NotebookPen },
  { href: "/trackers", label: "领域记录", icon: Gauge },
  { href: "/habits", label: "习惯打卡", icon: Repeat },
  { href: "/wellbeing/workout", label: "训练记录", icon: Dumbbell },
  { href: "/wellbeing/nutrition", label: "今日饮食", icon: Salad },
  { href: "/wellbeing/sports", label: "运动档案", icon: Trophy },
];

/** 职业分组（画像 / 技能树 / 简历 / GitHub / 面试 / 求职） */
export const CAREER_ITEMS: readonly ShellNavItem[] = [
  { href: "/career", label: "职业画像", icon: Users },
  { href: "/career/profile", label: "我的资料", icon: UserRound },
  { href: "/career/skills", label: "技能树", icon: GraduationCap },
  { href: "/career/radar", label: "就业雷达", icon: Radar },
  { href: "/career/certificates", label: "我的证书", icon: Award },
  { href: "/career/resume", label: "简历", icon: FileText },
  { href: "/career/resume-assets", label: "简历资产", icon: FolderGit2 },
  { href: "/career/interview", label: "面试", icon: MessageSquare },
  { href: "/career/applications", label: "我的求职", icon: Briefcase },
  { href: "/career/market", label: "市场分析", icon: BarChart3 },
];

/** 移动端底部导航（5 入口：首页 / 学习 / 招花 / 职业 / 我的） */
export const BOTTOM_TABS: readonly ShellNavItem[] = [
  { href: "/dashboard", label: "首页", icon: LayoutDashboard },
  { href: "/roadmap", label: "学习", icon: GraduationCap },
  { href: "/jobs", label: "招花", icon: Flower },
  { href: "/career", label: "职业", icon: Rocket },
  { href: "/settings", label: "我的", icon: Settings },
];

/** 下载页地址（桌面/移动顶栏共用）。 */
export const DOWNLOAD_URL = "https://learn.yuanabd.cn/download.html";

/** 顶栏选中态 key（滑动胶囊指示器用）。 */
export type NavActiveKey = "dashboard" | "today" | "learn" | "jobs" | "career" | "settings";

/**
 * 路径 -> 顶栏选中态 key（纯函数，原样抽自 app-shell.tsx）。
 *
 * 学习分组覆盖 roadmap / tasks / logs 三个一级段；未命中的路径返回 null（不显示胶囊）。
 */
export function getNavActiveKey(pathname: string): NavActiveKey | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/today") return "today";
  if (pathname.startsWith("/roadmap") || pathname.startsWith("/tasks") || pathname.startsWith("/logs")) return "learn";
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/career")) return "career";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

/** 导航项是否选中：自身或子路径（`/jobs` 命中 `/jobs/1`，但不命中 `/jobsx`）。 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
