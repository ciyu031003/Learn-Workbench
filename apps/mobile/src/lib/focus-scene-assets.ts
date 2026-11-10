import type { ImageSourcePropType } from "react-native";

/**
 * Focus scene photos are bundled with the app so the timer works offline and
 * never depends on an external image CDN. Keep the keys in sync with
 * FOCUS_SCENES in packages/shared/src/focus-scenes.ts.
 */
const SCENE_IMAGES: Record<string, ImageSourcePropType> = {
  window: require("../../assets/images/scenes/window.jpg"),
  "rain-cafe": require("../../assets/images/scenes/rain-cafe.jpg"),
  library: require("../../assets/images/scenes/library.jpg"),
  seaside: require("../../assets/images/scenes/seaside.jpg"),
  snow: require("../../assets/images/scenes/snow.jpg"),
  campfire: require("../../assets/images/scenes/campfire.jpg"),
};

export function focusSceneSource(id: string): ImageSourcePropType {
  return SCENE_IMAGES[id] ?? SCENE_IMAGES.snow;
}
