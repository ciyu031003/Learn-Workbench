-- 市场分析每日快照（P5 趋势）：每次重算落「当日」快照（每日一次，ON CONFLICT DO NOTHING），
-- 供「本周 vs 上周」环比对比。payload 为当日 MarketAnalysis 聚合结果。
CREATE TABLE IF NOT EXISTS market_stats_history (
  id bigserial PRIMARY KEY,
  snap_date date NOT NULL UNIQUE,            -- 快照日期（每日一根，Y-m-d）
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- 当日市场分析聚合结果
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_market_stats_history_snap_date ON market_stats_history(snap_date DESC);
