import { DEFAULT_FOCUS_SCENE_ID, FOCUS_SCENES } from "@learn-workbench/shared/focus-scenes";

/** Scene photos are bundled under public/scenes so the focus room never depends on a CDN. */
const LOCAL_SCENE_IMAGES = new Set(FOCUS_SCENES.map((scene) => scene.id));

export function focusSceneImage(id: string): string {
  const safeId = LOCAL_SCENE_IMAGES.has(id) ? id : DEFAULT_FOCUS_SCENE_ID;
  return `/scenes/${safeId}.jpg`;
}
