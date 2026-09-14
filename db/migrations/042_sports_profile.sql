-- 042：Sports Profile / Share——sports_profiles（运动档案 + 公开分享）
-- 目标：羽球档案类「运动身份卡」；默认不公开，公开时只暴露白名单字段
--       （运动身份 / 等级 / 装备 / 公开成绩 / 照片），绝不暴露体重、年龄、身体测量、饮食、训练细节。
-- 每用户每种运动一条（UNIQUE(user_id, sport_key)），幂等。

CREATE TABLE IF NOT EXISTS sports_profiles (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_key    text NOT NULL,                    -- SPORT_CATALOG 的 key（如 badminton）
  identity     text,                             -- 运动身份（如 双打搭子）
  level_text   text,                             -- 等级（如 中羽 1 级）
  handedness   text CHECK (handedness IS NULL OR handedness IN ('left','right')),
  play_style   text,                             -- 打法（如 混双 / 单打）
  photo_url    text,                             -- 运动照片
  gear         jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ "label": "球拍", "value": "雷霆80" }]
  highlights   jsonb NOT NULL DEFAULT '[]'::jsonb, -- 公开成绩 [{ "label": "校赛", "value": "亚军" }]
  is_public    boolean NOT NULL DEFAULT false,   -- 默认不公开
  share_slug   text UNIQUE,                      -- 公开分享短链标识（开启公开时生成）
  deleted_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_profiles_user_sport
  ON sports_profiles(user_id, sport_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sports_profiles_public
  ON sports_profiles(is_public) WHERE deleted_at IS NULL AND is_public = true;

DROP TRIGGER IF EXISTS trg_sports_profiles_updated ON sports_profiles;
CREATE TRIGGER trg_sports_profiles_updated BEFORE UPDATE ON sports_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();