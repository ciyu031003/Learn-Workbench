import { router } from "expo-router";
import { EntryCard } from "@/components/entry-card";
import { ListGroup } from "@/components/list-row";

/**
 * 模块 ②：领域追踪 / 模块 ⑤：运动闪光卡。
 *
 * 这两块在成长页原本就是入口行（数据在各自的二级页里），整块搬过来只做命名统一：
 *  - 领域追踪 → /trackers（跑量 / 体重 / 通用计量）
 *  - 运动闪光卡 → /sports-card（战绩 / 装备 / 绝技的镭射卡面）
 * 交互与跳转目标与重构前一致。
 */

export function GrowthTrackersEntry() {
  return (
    <ListGroup>
      <EntryCard
        size="row"
        icon="map-outline"
        tone="primary"
        title="领域追踪"
        meta="跑量 · 体重 · 通用计量"
        last
        onPress={() => router.push("/trackers" as never)}
        accessibilityLabel="领域追踪，打开领域健康页"
      />
    </ListGroup>
  );
}

export function GrowthSportsCardEntry() {
  return (
    <ListGroup>
      <EntryCard
        size="row"
        icon="sparkles-outline"
        tone="warning"
        title="运动闪光卡"
        meta="战绩 · 装备 · 绝技，实时镭射卡面"
        last
        onPress={() => router.push("/sports-card" as never)}
        accessibilityLabel="运动闪光卡，打开闪光时刻卡面"
      />
    </ListGroup>
  );
}
