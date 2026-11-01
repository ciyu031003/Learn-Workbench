import { coDeepLessons } from "./co";
import { dsDeepLessons } from "./ds";
import { netDeepLessons } from "./net";
import { osDeepLessons } from "./os";
import type { Exam408DeepLessonMap } from "./types";

/** 25 个章级知识点的稳定 key（与 exam-408-grad.ts 一一对应）。 */
export const EXAM408_DEEP_CHAPTER_KEYS = [
  "ex408g-ds-basic",
  "ex408g-ds-linearlist",
  "ex408g-ds-array",
  "ex408g-ds-strings",
  "ex408g-ds-tree",
  "ex408g-ds-graph",
  "ex408g-ds-search",
  "ex408g-ds-sort",
  "ex408g-co-overview",
  "ex408g-co-representation",
  "ex408g-co-instruction",
  "ex408g-co-cpu",
  "ex408g-co-storage",
  "ex408g-co-bus",
  "ex408g-os-concepts",
  "ex408g-os-process",
  "ex408g-os-memory",
  "ex408g-os-files",
  "ex408g-os-io_device",
  "ex408g-net-overall",
  "ex408g-net-physical",
  "ex408g-net-datalink",
  "ex408g-net-network",
  "ex408g-net-transport",
  "ex408g-net-application",
] as const;

export const exam408DeepLessons: Exam408DeepLessonMap = {
  ...dsDeepLessons,
  ...coDeepLessons,
  ...osDeepLessons,
  ...netDeepLessons,
};
