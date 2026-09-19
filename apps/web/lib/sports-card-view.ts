/** 把运动档案（或公开分享视图）投影成卡面数据模型 —— 页面只负责把它交给卡片组件 */
import {
  buildSportsCardModel,
  sportItemByKey,
  type SportsCardModel,
  type SportsProfile,
  type SportsShare,
} from "@learn-workbench/shared";

export function cardModelFor(profile: SportsProfile, index: number, total: number): SportsCardModel {
  const sportName = sportItemByKey(profile.sportKey)?.name ?? profile.sportKey;
  return buildSportsCardModel(profile, { sportName, index, total });
}

export function cardModelFromShare(share: SportsShare, index = 1, total = 1): SportsCardModel {
  return buildSportsCardModel(
    {
      sportKey: share.sportKey,
      identity: share.identity,
      levelText: share.levelText,
      playStyle: share.playStyle,
      handedness: share.handedness,
      gear: share.gear,
      highlights: share.highlights,
      matchesPlayed: share.matchesPlayed,
      wins: share.wins,
      losses: share.losses,
      signatureMove: share.signatureMove,
    },
    { sportName: share.sportName, index, total }
  );
}
