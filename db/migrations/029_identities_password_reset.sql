-- 029：统一第三方身份关联 + 密码重置令牌（P1：微信扫码登录/绑定 与 邮箱找回密码）
-- 依赖：users(id)（schema）、accounts（用户名密码身份）
-- 说明：identities 是多登录方式统一模型——password 语义仍由 accounts 承载，
--       这里只放第三方身份（wechat 等）；password_reset_tokens 一次性找回令牌。

CREATE TABLE IF NOT EXISTS identities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     text NOT NULL,
  provider_uid text NOT NULL,
  unionid      text,
  nickname     text,
  avatar_url   text,
  meta         jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS idx_identities_user ON identities(user_id);
CREATE INDEX IF NOT EXISTS idx_identities_unionid ON identities(unionid) WHERE unionid IS NOT NULL;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id);
