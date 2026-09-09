-- 035: Recompute salary bands after normalizing salary units to K.
UPDATE job_postings
   SET salary_band = ''
 WHERE market_enriched_at IS NOT NULL
   AND salary_band <> '';
