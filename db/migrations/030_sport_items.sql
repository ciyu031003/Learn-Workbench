-- 030：运动项目注册表（sport_items）——全量目录提前入库，前台按 featured 显示常用子集
-- 与 packages/shared SPORT_CATALOG 同源；新增项目两端同步追加
CREATE TABLE IF NOT EXISTS sport_items (
  key             text PRIMARY KEY,
  name            text NOT NULL,
  type            text NOT NULL,
  met             numeric NOT NULL DEFAULT 4.0,
  default_minutes int NOT NULL DEFAULT 30,
  featured        boolean NOT NULL DEFAULT false,
  sort            int NOT NULL DEFAULT 100,
  enabled         boolean NOT NULL DEFAULT true
);

INSERT INTO sport_items (key, name, type, met, default_minutes, featured, sort) VALUES
  ('basketball', '篮球', 'BALL', 6.5, 30, true, 1),
  ('badminton', '羽毛球', 'BALL', 5.5, 30, true, 2),
  ('volleyball', '排球', 'BALL', 5.0, 30, true, 3),
  ('table-tennis', '乒乓球', 'BALL', 4.0, 30, true, 4),
  ('soccer', '足球', 'BALL', 7.0, 45, false, 5),
  ('tennis', '网球', 'BALL', 5.0, 45, false, 6),
  ('baseball', '棒球', 'BALL', 5.0, 45, false, 7),
  ('run', '跑步', 'AEROBIC', 8.0, 30, true, 10),
  ('walk', '散步', 'AEROBIC', 3.5, 30, true, 11),
  ('brisk-walk', '快走', 'AEROBIC', 5.0, 30, false, 12),
  ('cycling', '骑行', 'AEROBIC', 6.8, 40, true, 13),
  ('rope-jumping', '跳绳', 'AEROBIC', 10.0, 15, true, 14),
  ('swimming', '游泳', 'AEROBIC', 7.0, 40, false, 15),
  ('dancing', '跳舞', 'AEROBIC', 5.0, 30, false, 16),
  ('hiking', '爬山', 'AEROBIC', 6.0, 120, false, 17),
  ('frisbee', '飞盘', 'AEROBIC', 5.5, 40, false, 18),
  ('treadmill', '跑步机', 'AEROBIC', 5.0, 30, false, 19),
  ('boxing', '拳击', 'AEROBIC', 6.0, 30, false, 20),
  ('sit-ups', '仰卧起坐', 'STRENGTH', 3.8, 15, true, 30),
  ('squats', '深蹲', 'STRENGTH', 5.0, 15, true, 31),
  ('push-ups', '俯卧撑', 'STRENGTH', 4.0, 10, false, 32),
  ('plank', '平板支撑', 'STRENGTH', 3.3, 10, false, 33),
  ('dumbbells', '哑铃', 'STRENGTH', 3.5, 20, true, 34),
  ('pull-ups', '引体向上', 'STRENGTH', 8.0, 10, false, 35),
  ('crunches', '卷腹', 'STRENGTH', 3.8, 10, false, 36),
  ('stretching', '拉伸放松', 'STRETCH', 2.3, 10, true, 40),
  ('yoga', '瑜伽', 'STRETCH', 2.5, 30, false, 41),
  ('baduanjin', '八段锦', 'STRETCH', 3.0, 20, false, 42),
  ('tai-chi', '太极', 'STRETCH', 3.0, 30, false, 43),
  ('stairs', '爬楼梯', 'MOVE', 8.0, 10, false, 50),
  ('housework', '家务活动', 'MOVE', 3.3, 20, false, 51)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name, type = EXCLUDED.type, met = EXCLUDED.met,
    default_minutes = EXCLUDED.default_minutes, featured = EXCLUDED.featured, sort = EXCLUDED.sort;

CREATE INDEX IF NOT EXISTS idx_sport_items_sort ON sport_items(sort) WHERE enabled;
