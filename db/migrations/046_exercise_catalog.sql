-- 046：健身房动作字典（exercise_items）—— 训练记录「选择动作」面板的数据源
--
-- 背景（v4 P3 / 决策 D2=B）：原来的训练记录只能手打动作名，没有下拉、没有删除入口。
-- 现有的 sport_items（迁移 030）是"运动/活动"目录（篮球、跑步、深蹲…），
-- 力量类只有 6 项，不足以支撑健身房场景（卧推/硬拉/绳索下压…），因此单开一张字典表。
--
-- 与 packages/shared 的 EXERCISE_CATALOG 同源：迁移做种子入库，代码内置常量做
-- 「库不可用 / 未迁移环境」的回退数据源；两者必须保持一致
-- （apps/web/lib/exercise-catalog.test.ts 会解析本文件逐条比对，防止漂移）。
--
-- 只追加，不修改历史迁移。

CREATE TABLE IF NOT EXISTS exercise_items (
  id            bigserial PRIMARY KEY,
  key           text NOT NULL UNIQUE,               -- 稳定键（客户端提交 exercise_key 用）
  name          text NOT NULL,                      -- 展示名（卧推 / 硬拉）
  muscle_group  text NOT NULL
                CHECK (muscle_group IN ('胸', '背', '腿', '肩', '手臂', '核心', '臀', '全身')),
  category      text NOT NULL
                CHECK (category IN ('BALL', 'AEROBIC', 'STRENGTH', 'STRETCH', 'MOVE', 'OTHER')),
  equipment     text
                CHECK (equipment IS NULL OR equipment IN ('杠铃', '哑铃', '器械', '自重', '绳索', '壶铃')),
  met           numeric CHECK (met IS NULL OR (met >= 0 AND met <= 25)),
  sort          int NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 面板默认按「部位 → 排序」浏览；按分类筛选走第二个索引
CREATE INDEX IF NOT EXISTS idx_exercise_items_group ON exercise_items(muscle_group, sort);
CREATE INDEX IF NOT EXISTS idx_exercise_items_category ON exercise_items(category, sort);

INSERT INTO exercise_items (key, name, muscle_group, category, equipment, met, sort) VALUES
  -- 胸
  ('bench-press',              '卧推',           '胸',   'STRENGTH', '杠铃', 6.0,  11),
  ('incline-bench-press',      '上斜卧推',       '胸',   'STRENGTH', '杠铃', 6.0,  12),
  ('dumbbell-bench-press',     '哑铃卧推',       '胸',   'STRENGTH', '哑铃', 5.5,  13),
  ('dumbbell-fly',             '哑铃飞鸟',       '胸',   'STRENGTH', '哑铃', 4.0,  14),
  ('cable-crossover',          '绳索夹胸',       '胸',   'STRENGTH', '绳索', 4.0,  15),
  ('machine-chest-press',      '器械推胸',       '胸',   'STRENGTH', '器械', 5.0,  16),
  ('push-up',                  '俯卧撑',         '胸',   'STRENGTH', '自重', 4.0,  17),
  ('dips',                     '双杠臂屈伸',     '胸',   'STRENGTH', '自重', 5.0,  18),
  -- 背
  ('deadlift',                 '硬拉',           '背',   'STRENGTH', '杠铃', 6.0,  21),
  ('romanian-deadlift',        '罗马尼亚硬拉',   '背',   'STRENGTH', '杠铃', 6.0,  22),
  ('pull-up',                  '引体向上',       '背',   'STRENGTH', '自重', 8.0,  23),
  ('lat-pulldown',             '高位下拉',       '背',   'STRENGTH', '器械', 5.0,  24),
  ('barbell-row',              '杠铃划船',       '背',   'STRENGTH', '杠铃', 6.0,  25),
  ('seated-cable-row',         '坐姿划船',       '背',   'STRENGTH', '绳索', 5.0,  26),
  ('one-arm-dumbbell-row',     '单臂哑铃划船',   '背',   'STRENGTH', '哑铃', 5.0,  27),
  ('face-pull',                '面拉',           '背',   'STRENGTH', '绳索', 4.0,  28),
  ('reverse-fly',              '反向飞鸟',       '背',   'STRENGTH', '哑铃', 4.0,  29),
  ('t-bar-row',                'T 杠划船',       '背',   'STRENGTH', '杠铃', 5.5,  30),
  -- 腿
  ('squat',                    '深蹲',           '腿',   'STRENGTH', '杠铃', 6.0,  31),
  ('front-squat',              '前蹲',           '腿',   'STRENGTH', '杠铃', 6.0,  32),
  ('hack-squat',               '哈克深蹲',       '腿',   'STRENGTH', '器械', 5.5,  33),
  ('goblet-squat',             '高脚杯深蹲',     '腿',   'STRENGTH', '哑铃', 5.0,  34),
  ('bulgarian-split-squat',    '保加利亚分腿蹲', '腿',   'STRENGTH', '哑铃', 5.0,  35),
  ('lunge',                    '箭步蹲',         '腿',   'STRENGTH', '哑铃', 5.0,  36),
  ('leg-press',                '腿举',           '腿',   'STRENGTH', '器械', 5.0,  37),
  ('leg-extension',            '腿屈伸',         '腿',   'STRENGTH', '器械', 4.0,  38),
  ('leg-curl',                 '腿弯举',         '腿',   'STRENGTH', '器械', 4.0,  39),
  ('standing-calf-raise',      '站姿提踵',       '腿',   'STRENGTH', '器械', 3.5,  40),
  -- 肩
  ('overhead-press',           '推举',           '肩',   'STRENGTH', '杠铃', 6.0,  41),
  ('dumbbell-shoulder-press',  '哑铃推举',       '肩',   'STRENGTH', '哑铃', 5.0,  42),
  ('arnold-press',             '阿诺德推举',     '肩',   'STRENGTH', '哑铃', 5.0,  43),
  ('lateral-raise',            '哑铃侧平举',     '肩',   'STRENGTH', '哑铃', 3.5,  44),
  ('front-raise',              '前平举',         '肩',   'STRENGTH', '哑铃', 3.5,  45),
  ('reverse-pec-deck',         '反向蝴蝶机',     '肩',   'STRENGTH', '器械', 4.0,  46),
  ('upright-row',              '直立划船',       '肩',   'STRENGTH', '杠铃', 5.0,  47),
  ('shrug',                    '耸肩',           '肩',   'STRENGTH', '哑铃', 3.5,  48),
  -- 手臂
  ('barbell-curl',             '杠铃弯举',       '手臂', 'STRENGTH', '杠铃', 4.0,  51),
  ('dumbbell-curl',            '哑铃弯举',       '手臂', 'STRENGTH', '哑铃', 3.5,  52),
  ('hammer-curl',              '锤式弯举',       '手臂', 'STRENGTH', '哑铃', 3.5,  53),
  ('concentration-curl',       '集中弯举',       '手臂', 'STRENGTH', '哑铃', 3.5,  54),
  ('preacher-curl',            '牧师凳弯举',     '手臂', 'STRENGTH', '器械', 4.0,  55),
  ('triceps-pushdown',         '绳索下压',       '手臂', 'STRENGTH', '绳索', 3.5,  56),
  ('close-grip-bench-press',   '窄距卧推',       '手臂', 'STRENGTH', '杠铃', 5.5,  57),
  ('lying-triceps-extension',  '仰卧臂屈伸',     '手臂', 'STRENGTH', '杠铃', 4.0,  58),
  ('overhead-triceps-ext',     '过顶臂屈伸',     '手臂', 'STRENGTH', '哑铃', 4.0,  59),
  ('wrist-curl',               '腕弯举',         '手臂', 'STRENGTH', '哑铃', 3.0,  60),
  -- 核心
  ('plank',                    '平板支撑',       '核心', 'STRENGTH', '自重', 3.3,  61),
  ('side-plank',               '侧平板支撑',     '核心', 'STRENGTH', '自重', 3.3,  62),
  ('crunch',                   '卷腹',           '核心', 'STRENGTH', '自重', 3.8,  63),
  ('sit-up',                   '仰卧起坐',       '核心', 'STRENGTH', '自重', 3.8,  64),
  ('hanging-leg-raise',        '悬垂举腿',       '核心', 'STRENGTH', '自重', 4.5,  65),
  ('russian-twist',            '俄罗斯转体',     '核心', 'STRENGTH', '自重', 4.0,  66),
  ('cable-crunch',             '绳索卷腹',       '核心', 'STRENGTH', '绳索', 4.5,  67),
  ('ab-wheel',                 '健腹轮',         '核心', 'STRENGTH', '器械', 4.5,  68),
  -- 臀
  ('glute-bridge',             '臀桥',           '臀',   'STRENGTH', '自重', 3.5,  71),
  ('hip-thrust',               '臀冲',           '臀',   'STRENGTH', '杠铃', 5.0,  72),
  ('hip-abduction',            '髋外展',         '臀',   'STRENGTH', '器械', 3.5,  73),
  ('cable-kickback',           '绳索后踢',       '臀',   'STRENGTH', '绳索', 4.0,  74),
  ('sumo-deadlift',            '相扑硬拉',       '臀',   'STRENGTH', '杠铃', 6.0,  75),
  -- 全身（力量 / 有氧 / 拉伸）
  ('farmer-walk',              '农夫行走',       '全身', 'STRENGTH', '哑铃', 6.0,  81),
  ('kettlebell-swing',         '壶铃摆荡',       '全身', 'STRENGTH', '壶铃', 8.0,  82),
  ('burpee',                   '波比跳',         '全身', 'STRENGTH', '自重', 8.0,  83),
  ('rowing-machine',           '划船机',         '全身', 'AEROBIC',  '器械', 7.0,  84),
  ('battle-rope',              '战绳',           '全身', 'AEROBIC',  '器械', 8.0,  85),
  ('jump-rope',                '跳绳',           '全身', 'AEROBIC',  '自重', 10.0, 86),
  ('treadmill-run',            '跑步机',         '全身', 'AEROBIC',  '器械', 8.0,  87),
  ('stair-climber',            '爬楼机',         '腿',   'AEROBIC',  '器械', 9.0,  88),
  ('spin-bike',                '动感单车',       '腿',   'AEROBIC',  '器械', 8.5,  89),
  ('foam-roll',                '泡沫轴放松',     '全身', 'STRETCH',  '自重', 2.5,  90),
  ('stretch-cooldown',         '训练后拉伸',     '全身', 'STRETCH',  '自重', 2.3,  91),
  ('yoga-flow',                '瑜伽流',         '全身', 'STRETCH',  '自重', 2.8,  92)
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_exercise_items_updated ON exercise_items;
CREATE TRIGGER trg_exercise_items_updated BEFORE UPDATE ON exercise_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
