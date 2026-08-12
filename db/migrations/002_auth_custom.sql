-- ============================================================================
-- 002：登录认证 + 自定义学习内容
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id            serial PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,                  -- scrypt: salt:hash
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE content_topics ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_topics_owner ON content_topics(owner_id);

DROP TRIGGER IF EXISTS trg_accounts_updated ON accounts;
CREATE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO users (display_name) VALUES ('yuanabd') ON CONFLICT DO NOTHING;
INSERT INTO accounts (username, password_hash, user_id)
SELECT 'yuanabd',
       '37c6fe5590cdd94dd59fdbb144da1809:bad66e576a7f8ba949035db9407d5b45c54727a07b93bd3a424fe447b03f3d2732649d2fb7f23bd2307643ce92559b5faade6dce2b79e6ea8493609ead888a59',
       id
FROM users WHERE display_name = 'yuanabd'
ON CONFLICT (username) DO NOTHING;
