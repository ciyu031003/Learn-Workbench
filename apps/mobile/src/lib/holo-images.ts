import type { ImageSourcePropType } from "react-native";

/**
 * 闪光卡素材（随包发布，离线可用）：7 个球类项目的 主体 / 背景 两层。
 * 原始素材来自 sports-cards 工程（1728×2368 PNG），构建时压成 896 宽 WebP：
 * 全部 7 项合计约 3.3MB，因此直接进包而不是走网络。
 */
export interface HoloImages {
  subject: ImageSourcePropType;
  background: ImageSourcePropType;
}

export const HOLO_IMAGES: Record<string, HoloImages> = {
  badminton: {
    subject: require("../../assets/holo/badminton/subject.webp"),
    background: require("../../assets/holo/badminton/background.webp"),
  },
  tennis: {
    subject: require("../../assets/holo/tennis/subject.webp"),
    background: require("../../assets/holo/tennis/background.webp"),
  },
  basketball: {
    subject: require("../../assets/holo/basketball/subject.webp"),
    background: require("../../assets/holo/basketball/background.webp"),
  },
  volleyball: {
    subject: require("../../assets/holo/volleyball/subject.webp"),
    background: require("../../assets/holo/volleyball/background.webp"),
  },
  "table-tennis": {
    subject: require("../../assets/holo/table-tennis/subject.webp"),
    background: require("../../assets/holo/table-tennis/background.webp"),
  },
  soccer: {
    subject: require("../../assets/holo/soccer/subject.webp"),
    background: require("../../assets/holo/soccer/background.webp"),
  },
  baseball: {
    subject: require("../../assets/holo/baseball/subject.webp"),
    background: require("../../assets/holo/baseball/background.webp"),
  },
};

export function holoImages(sportKey: string): HoloImages | null {
  return HOLO_IMAGES[sportKey] ?? null;
}

export function hasHoloImages(sportKey: string): boolean {
  return Boolean(HOLO_IMAGES[sportKey]);
}
