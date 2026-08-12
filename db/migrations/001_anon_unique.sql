-- 本地匿名模式（user_id IS NULL）下保证每个 topic / 每个打卡日唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_topic_progress_anon ON topic_progress(topic_id) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_topic_progress_user ON topic_progress(user_id, topic_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_anon ON checkins(checkin_date) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_user ON checkins(user_id, checkin_date) WHERE user_id IS NOT NULL;
