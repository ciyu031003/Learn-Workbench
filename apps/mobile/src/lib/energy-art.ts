import type { ImageSourcePropType } from "react-native";

/**
 * 精力 5 档的 3D 表情素材（本地打包，不走外链）。
 *
 * 素材来源：花瓣画板「【素材】3D表情包」(huaban.com/boards/94591802)，
 * 同一套 12 枚 3D 黄色表情里挑出 5 枚，抠成透明底后统一缩放到 210px 画布。
 * 版权口径：按用户确认的「坚持用花瓣那套，版权正常」执行；运行时不热链花瓣 / 微信图床。
 */
const ENERGY_ART: Record<number, ImageSourcePropType> = {
  1: require("../../assets/images/energy/energy-1-exhausted.png"),
  2: require("../../assets/images/energy/energy-2-tired.png"),
  3: require("../../assets/images/energy/energy-3-okay.png"),
  4: require("../../assets/images/energy/energy-4-good.png"),
  5: require("../../assets/images/energy/energy-5-full.png"),
};

export function energyArt(level: number): ImageSourcePropType | null {
  return ENERGY_ART[level] ?? null;
}

/** 庆祝主视觉：3D 表情吹派对喇叭（用户提供的完成 GIF，已本地打包并压缩到 360px） */
export const CELEBRATION_GIF: ImageSourcePropType = require("../../assets/images/celebration/celebrate.gif");
