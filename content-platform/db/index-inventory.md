# 索引 / 约束 / 审计列覆盖清单（组三 H1）

> **本文件由脚本生成，请勿手改**：`node scripts/db-index-inventory.mjs`。
> 事实源是 `db/schema.sql` + `db/migrations/*.sql` 的 DDL 文本，非人工估算；
> CI 门禁 `node scripts/db-index-inventory.mjs --check` 会在漂移时失败。

- 表：92
- 显式索引（CREATE INDEX）：322
- 显式约束（CONSTRAINT / CHECK / UNIQUE / PK / FK）：140

## 1. 列覆盖总览

| 关注点 | 列 | 覆盖表数 |
|---|---|---|
| 审计列 | `updated_at` | 54 |
| 审计列 | `created_at` | 64 |
| 审计列 | `created_by` | 5 |
| 审计列 | `updated_by` | 4 |
| 软删除 | `deleted_at` | 25 |
| 乐观锁 | `version` | 5 |

缺失清单（用于判断哪些表还需要补齐，不含纯日志/追加型表）：

- 缺 `created_at`（28）：app_meta, careers, content_checkpoints, content_import_batch, content_practices, content_projects, content_resources, content_topics, food_import_runs, interview_crawl_runs, interview_questions, job_applications, job_clusters, job_crawler_runs, job_exam_events, job_postings, job_skill_links, knowledge_note_tags, knowledge_read_state, learning_review_cards, market_stats, resume_assets, settings, skill_content_links, sport_items, topic_progress, user_skills, xp_events
- 缺 `updated_at`（38）：audit_log, auth_attempts, background_images, careers, content_checkpoints, content_import_batch, content_import_item, content_practices, content_projects, content_resources, food_import_runs, identities, interview_crawl_runs, job_crawler_runs, job_exam_events, job_favorites, job_notifications, job_postings, job_skill_links, job_source_health, knowledge_links, knowledge_note_tags, knowledge_prerequisite, knowledge_relation, knowledge_tags, learning_attempts, market_dimension_snapshots, market_stats, market_stats_history, password_reset_tokens, question_knowledge_point, sessions, skill_content_links, skill_taxonomy, sport_items, sync_changes, uploads, xp_events
- 缺 `created_by`（87）：accounts, app_meta, audit_log, auth_attempts, background_images, break_sessions, careers, certificates, checkins, content_checkpoints, content_import_item, content_practices, content_projects, content_resources, content_topic_items, daily_tasks, domain_trackers, energy_logs, equipment_items, exercise_goals, exercise_items, exercise_logs, focus_sessions, food_import_runs, food_items, foods, habit_logs, habits, hydration_goals, hydration_logs, identities, interview_attempts, interview_crawl_runs, interview_questions, job_applications, job_clusters, job_crawler_configs, job_crawler_runs, job_crawler_sources, job_exam_events, job_favorites, job_notifications, job_postings, job_skill_links, job_source_health, job_subscriptions, knowledge_favorites, knowledge_links, knowledge_note_tags, knowledge_notes, knowledge_prerequisite, knowledge_read_state, knowledge_relation, knowledge_tags, learning_attempts, learning_review_cards, log_entries, market_dimension_snapshots, market_saved_views, market_stats, market_stats_history, meal_entries, password_reset_tokens, question_knowledge_point, resume_assets, resume_documents, resume_files, sessions, settings, skill_content_links, skill_taxonomy, sport_items, sports_profiles, sync_changes, sync_devices, task_runs, topic_progress, tracker_logs, uploads, user_settings, user_skills, users, weight_logs, wellbeing_reminders, workout_items, workouts, xp_events
- 缺 `updated_by`（88）：accounts, app_meta, audit_log, auth_attempts, background_images, break_sessions, careers, certificates, checkins, content_checkpoints, content_import_batch, content_import_item, content_practices, content_projects, content_resources, content_topic_items, daily_tasks, domain_trackers, energy_logs, equipment_items, exercise_goals, exercise_items, exercise_logs, focus_sessions, food_import_runs, food_items, foods, habit_logs, habits, hydration_goals, hydration_logs, identities, interview_attempts, interview_crawl_runs, interview_questions, job_applications, job_clusters, job_crawler_configs, job_crawler_runs, job_crawler_sources, job_exam_events, job_favorites, job_notifications, job_postings, job_skill_links, job_source_health, job_subscriptions, knowledge_favorites, knowledge_links, knowledge_note_tags, knowledge_notes, knowledge_prerequisite, knowledge_read_state, knowledge_relation, knowledge_tags, learning_attempts, learning_review_cards, log_entries, market_dimension_snapshots, market_saved_views, market_stats, market_stats_history, meal_entries, password_reset_tokens, question_knowledge_point, resume_assets, resume_documents, resume_files, sessions, settings, skill_content_links, skill_taxonomy, sport_items, sports_profiles, sync_changes, sync_devices, task_runs, topic_progress, tracker_logs, uploads, user_settings, user_skills, users, weight_logs, wellbeing_reminders, workout_items, workouts, xp_events
- 缺 `deleted_at`（67）：accounts, app_meta, audit_log, auth_attempts, background_images, careers, content_checkpoints, content_import_batch, content_import_item, content_phases, content_practices, content_projects, content_resources, content_source, content_topic_items, equipment_items, exercise_goals, exercise_items, food_import_runs, food_items, foods, habit_logs, hydration_goals, identities, interview_attempts, interview_crawl_runs, interview_questions, job_applications, job_clusters, job_crawler_configs, job_crawler_runs, job_crawler_sources, job_exam_events, job_favorites, job_notifications, job_postings, job_skill_links, job_source_health, job_subscriptions, knowledge_links, knowledge_note_tags, knowledge_prerequisite, knowledge_read_state, knowledge_relation, knowledge_tags, learning_attempts, learning_review_cards, market_dimension_snapshots, market_saved_views, market_stats, market_stats_history, password_reset_tokens, question_knowledge_point, sessions, settings, skill_content_links, skill_taxonomy, sport_items, sync_changes, sync_devices, task_runs, tracker_logs, user_settings, user_skills, users, workout_items, xp_events
- 缺 `version`（87）：accounts, app_meta, audit_log, auth_attempts, background_images, break_sessions, careers, certificates, checkins, content_checkpoints, content_import_batch, content_import_item, content_practices, content_projects, content_resources, content_topic_items, daily_tasks, domain_trackers, energy_logs, equipment_items, exercise_goals, exercise_items, exercise_logs, focus_sessions, food_import_runs, food_items, foods, habit_logs, habits, hydration_goals, hydration_logs, identities, interview_attempts, interview_crawl_runs, interview_questions, job_applications, job_clusters, job_crawler_configs, job_crawler_runs, job_crawler_sources, job_exam_events, job_favorites, job_notifications, job_postings, job_skill_links, job_source_health, job_subscriptions, knowledge_favorites, knowledge_links, knowledge_note_tags, knowledge_notes, knowledge_prerequisite, knowledge_read_state, knowledge_relation, knowledge_tags, learning_attempts, learning_review_cards, log_entries, market_dimension_snapshots, market_saved_views, market_stats, market_stats_history, meal_entries, password_reset_tokens, question_knowledge_point, resume_assets, resume_documents, resume_files, sessions, settings, skill_content_links, skill_taxonomy, sport_items, sports_profiles, sync_devices, task_runs, topic_progress, tracker_logs, uploads, user_settings, user_skills, users, weight_logs, wellbeing_reminders, workout_items, workouts, xp_events

## 2. 全量索引清单

| 表 | 索引 | 唯一 | 列 | 部分索引条件 |
|---|---|---|---|---|
| `accounts` | `idx_accounts_user` | 否 | `user_id` | - |
| `accounts` | `idx_accounts_user` | 否 | `user_id` | - |
| `audit_log` | `idx_audit_log_action` | 否 | `action, created_at DESC` | - |
| `audit_log` | `idx_audit_log_action` | 否 | `action, created_at DESC` | - |
| `audit_log` | `idx_audit_log_actor` | 否 | `actor_id, created_at DESC` | - |
| `audit_log` | `idx_audit_log_actor` | 否 | `actor_id, created_at DESC` | - |
| `audit_log` | `idx_audit_log_created` | 否 | `created_at DESC` | - |
| `audit_log` | `idx_audit_log_created` | 否 | `created_at DESC` | - |
| `audit_log` | `idx_audit_log_target` | 否 | `target_type, target_id` | - |
| `audit_log` | `idx_audit_log_target` | 否 | `target_type, target_id` | - |
| `auth_attempts` | `idx_auth_attempts_created_at` | 否 | `created_at` | - |
| `auth_attempts` | `idx_auth_attempts_ip` | 否 | `ip, created_at DESC` | - |
| `auth_attempts` | `idx_auth_attempts_lookup` | 否 | `username, created_at DESC` | - |
| `background_images` | `idx_bg_date` | 否 | `image_date` | - |
| `break_sessions` | `idx_breaks_user_day` | 否 | `user_id, started_at` | `deleted_at IS NULL` |
| `break_sessions` | `uq_breaks_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `careers` | `idx_careers_kind` | 否 | `kind` | - |
| `careers` | `idx_careers_owner` | 否 | `owner_id` | - |
| `certificates` | `idx_certs_expiry` | 否 | `expiry_date` | `deleted_at IS NULL AND expiry_date IS NOT NULL` |
| `certificates` | `idx_certs_user` | 否 | `user_id` | - |
| `certificates` | `idx_certs_user_alive` | 否 | `user_id` | `deleted_at IS NULL` |
| `certificates` | `uq_certificates_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `checkins` | `idx_checkins_user_date` | 否 | `user_id, checkin_date` | - |
| `checkins` | `uq_checkins_anon` | 是 | `checkin_date` | `user_id IS NULL` |
| `checkins` | `uq_checkins_anon` | 是 | `checkin_date` | `user_id IS NULL` |
| `checkins` | `uq_checkins_anon` | 是 | `anon_id, checkin_date` | `anon_id IS NOT NULL` |
| `checkins` | `uq_checkins_user` | 是 | `user_id, checkin_date` | `user_id IS NOT NULL` |
| `checkins` | `uq_checkins_user` | 是 | `user_id, checkin_date` | `user_id IS NOT NULL` |
| `content_checkpoints` | `idx_checkpoints_topic` | 否 | `topic_id` | - |
| `content_import_batch` | `idx_content_import_batch_source` | 否 | `source_key, started_at DESC` | - |
| `content_import_batch` | `idx_content_import_batch_source` | 否 | `source_key, started_at DESC` | - |
| `content_import_item` | `idx_content_import_item_batch` | 否 | `batch_id, action` | - |
| `content_import_item` | `idx_content_import_item_batch` | 否 | `batch_id, action` | - |
| `content_import_item` | `uq_content_import_item` | 是 | `batch_id, kind, external_key` | - |
| `content_import_item` | `uq_content_import_item` | 是 | `batch_id, kind, external_key` | - |
| `content_phases` | `idx_content_phases_batch` | 否 | `import_batch_id` | `import_batch_id IS NOT NULL` |
| `content_phases` | `idx_phases_career` | 否 | `career_key` | - |
| `content_phases` | `idx_phases_career` | 否 | `career_key` | - |
| `content_phases` | `idx_phases_career_owner` | 否 | `career_key, owner_id` | - |
| `content_phases` | `idx_phases_owner` | 否 | `owner_id` | - |
| `content_phases` | `uq_content_phases_slug` | 是 | `slug` | - |
| `content_practices` | `idx_practices_topic` | 否 | `topic_id` | - |
| `content_projects` | `idx_projects_topic` | 否 | `topic_id` | - |
| `content_resources` | `idx_resources_topic` | 否 | `topic_id` | - |
| `content_source` | `idx_content_source_status` | 否 | `status, usage` | - |
| `content_source` | `idx_content_source_status` | 否 | `status, usage` | - |
| `content_topic_items` | `idx_topic_items_topic` | 否 | `topic_id, sort_order` | - |
| `content_topic_items` | `idx_topic_items_topic` | 否 | `topic_id, sort_order` | - |
| `content_topics` | `idx_content_topics_batch` | 否 | `import_batch_id` | `import_batch_id IS NOT NULL` |
| `content_topics` | `idx_topics_owner` | 否 | `owner_id` | - |
| `content_topics` | `idx_topics_owner` | 否 | `owner_id` | - |
| `content_topics` | `idx_topics_phase` | 否 | `phase_id` | - |
| `content_topics` | `idx_topics_status` | 否 | `status, sort_order` | - |
| `content_topics` | `idx_topics_status` | 否 | `status, sort_order` | - |
| `content_topics` | `uq_content_topics_client` | 是 | `owner_id, client_id` | `owner_id IS NOT NULL AND client_id IS NOT NULL` |
| `content_topics` | `uq_content_topics_client` | 是 | `owner_id, client_id` | `owner_id IS NOT NULL AND client_id IS NOT NULL` |
| `content_topics` | `uq_content_topics_slug` | 是 | `slug` | - |
| `daily_tasks` | `idx_daily_tasks_career` | 否 | `career_key` | - |
| `daily_tasks` | `idx_daily_tasks_phase` | 否 | `phase_id` | - |
| `daily_tasks` | `idx_daily_tasks_phase` | 否 | `phase_id` | - |
| `daily_tasks` | `idx_daily_tasks_topic` | 否 | `topic_id` | - |
| `daily_tasks` | `idx_daily_tasks_topic` | 否 | `topic_id` | - |
| `daily_tasks` | `idx_tasks_date` | 否 | `task_date` | - |
| `daily_tasks` | `idx_tasks_domain` | 否 | `career_key` | - |
| `daily_tasks` | `idx_tasks_user` | 否 | `user_id` | - |
| `daily_tasks` | `uq_daily_tasks_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `daily_tasks` | `uq_daily_tasks_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `domain_trackers` | `idx_domain_trackers_domain` | 否 | `domain_key` | - |
| `domain_trackers` | `idx_domain_trackers_user` | 否 | `user_id` | - |
| `domain_trackers` | `idx_trackers_domain` | 否 | `domain_key` | - |
| `energy_logs` | `idx_energy_user_day` | 否 | `user_id, recorded_at` | `deleted_at IS NULL` |
| `energy_logs` | `uq_energy_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `equipment_items` | `idx_equipment_items_brand` | 否 | `brand` | - |
| `equipment_items` | `idx_equipment_items_brand` | 否 | `brand` | - |
| `equipment_items` | `idx_equipment_items_category` | 否 | `category` | `is_listed = true` |
| `equipment_items` | `idx_equipment_items_category` | 否 | `category` | `is_listed = true` |
| `equipment_items` | `uq_equipment_items` | 是 | `category, brand, model` | - |
| `equipment_items` | `uq_equipment_items` | 是 | `category, brand, model` | - |
| `exercise_goals` | `idx_exercise_goal_user` | 否 | `user_id` | - |
| `exercise_goals` | `idx_exercise_goal_user` | 否 | `user_id` | - |
| `exercise_items` | `idx_exercise_items_category` | 否 | `category, sort` | - |
| `exercise_items` | `idx_exercise_items_category` | 否 | `category, sort` | - |
| `exercise_items` | `idx_exercise_items_group` | 否 | `muscle_group, sort` | - |
| `exercise_items` | `idx_exercise_items_group` | 否 | `muscle_group, sort` | - |
| `exercise_logs` | `idx_exercise_anon` | 否 | `anon_id` | - |
| `exercise_logs` | `idx_exercise_anon` | 否 | `anon_id` | - |
| `exercise_logs` | `idx_exercise_started` | 否 | `started_at` | - |
| `exercise_logs` | `idx_exercise_started` | 否 | `started_at` | - |
| `exercise_logs` | `idx_exercise_user` | 否 | `user_id` | - |
| `exercise_logs` | `idx_exercise_user` | 否 | `user_id` | - |
| `exercise_logs` | `uq_exercise_logs_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `exercise_logs` | `uq_exercise_logs_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `exercise_logs` | `uq_exercise_logs_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `exercise_logs` | `uq_exercise_logs_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `exercise_logs` | `uq_exercise_logs_client_anon` | 是 | `anon_id, client_id` | `anon_id IS NOT NULL AND client_id IS NOT NULL` |
| `exercise_logs` | `uq_exercise_logs_client_anon` | 是 | `anon_id, client_id` | `anon_id IS NOT NULL AND client_id IS NOT NULL` |
| `focus_sessions` | `idx_focus_sessions_task` | 否 | `task_id` | - |
| `focus_sessions` | `idx_focus_sessions_task` | 否 | `task_id` | - |
| `focus_sessions` | `idx_sessions_start` | 否 | `started_at` | - |
| `focus_sessions` | `idx_sessions_user` | 否 | `user_id` | - |
| `focus_sessions` | `uq_focus_sessions_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `focus_sessions` | `uq_focus_sessions_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `focus_sessions` | `uq_focus_sessions_client_anon` | 是 | `anon_id, client_id` | `anon_id IS NOT NULL AND client_id IS NOT NULL` |
| `focus_sessions` | `uq_focus_sessions_client_anon` | 是 | `anon_id, client_id` | `anon_id IS NOT NULL AND client_id IS NOT NULL` |
| `food_items` | `idx_food_items_category` | 否 | `category` | - |
| `food_items` | `idx_food_items_category` | 否 | `category` | - |
| `foods` | `uq_foods_global_name` | 是 | `lower(name` | `user_id IS NULL` |
| `foods` | `uq_foods_global_name` | 是 | `lower(name` | `user_id IS NULL` |
| `foods` | `uq_foods_user_name` | 是 | `user_id, lower(name` | `user_id IS NOT NULL` |
| `foods` | `uq_foods_user_name` | 是 | `user_id, lower(name` | `user_id IS NOT NULL` |
| `habit_logs` | `idx_habit_logs_habit` | 否 | `habit_id, log_date` | - |
| `habit_logs` | `idx_habit_logs_habit` | 否 | `habit_id, log_date` | - |
| `habit_logs` | `idx_habit_logs_user_date` | 否 | `user_id, log_date` | - |
| `habit_logs` | `idx_habit_logs_user_date` | 否 | `user_id, log_date` | - |
| `habits` | `idx_habits_anon` | 否 | `anon_id` | `deleted_at IS NULL AND user_id IS NULL` |
| `habits` | `idx_habits_anon` | 否 | `anon_id` | `deleted_at IS NULL AND user_id IS NULL` |
| `habits` | `idx_habits_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `habits` | `idx_habits_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `habits` | `uq_habits_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `habits` | `uq_habits_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `habits` | `uq_habits_user_name` | 是 | `user_id, lower(name` | `deleted_at IS NULL AND user_id IS NOT NULL` |
| `habits` | `uq_habits_user_name` | 是 | `user_id, lower(name` | `deleted_at IS NULL AND user_id IS NOT NULL` |
| `hydration_goals` | `idx_hydration_goals_user` | 否 | `user_id, effective_from DESC` | - |
| `hydration_logs` | `idx_hydration_user_day` | 否 | `user_id, recorded_at` | `deleted_at IS NULL` |
| `hydration_logs` | `uq_hydration_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `identities` | `idx_identities_unionid` | 否 | `unionid` | `unionid IS NOT NULL` |
| `identities` | `idx_identities_user` | 否 | `user_id` | - |
| `interview_attempts` | `idx_interview_attempt_application` | 否 | `application_id` | - |
| `interview_attempts` | `idx_interview_attempt_application` | 否 | `application_id` | - |
| `interview_attempts` | `idx_interview_attempt_question` | 否 | `question_id` | - |
| `interview_attempts` | `idx_interview_attempt_question` | 否 | `question_id` | - |
| `interview_attempts` | `idx_interview_attempt_user` | 否 | `user_id` | - |
| `interview_attempts` | `idx_interview_attempt_user` | 否 | `user_id` | - |
| `interview_attempts` | `idx_interview_attempts_phase` | 否 | `phase_id` | - |
| `interview_attempts` | `idx_interview_attempts_phase` | 否 | `phase_id` | - |
| `interview_crawl_runs` | `idx_interview_runs_started` | 否 | `started_at DESC` | - |
| `interview_crawl_runs` | `idx_interview_runs_started` | 否 | `started_at DESC` | - |
| `interview_questions` | `idx_interview_questions_listed` | 否 | `module` | `is_listed = true` |
| `interview_questions` | `idx_interview_questions_listed` | 否 | `module` | `is_listed = true` |
| `interview_questions` | `idx_questions_module` | 否 | `module` | - |
| `interview_questions` | `uq_interview_questions_external` | 是 | `external_key` | `external_key IS NOT NULL` |
| `interview_questions` | `uq_interview_questions_external` | 是 | `external_key` | `external_key IS NOT NULL` |
| `job_applications` | `idx_job_app_job` | 否 | `job_id` | - |
| `job_applications` | `idx_job_app_user` | 否 | `user_id, stage` | - |
| `job_clusters` | `idx_job_clusters_dedup` | 否 | `dedup_key` | - |
| `job_crawler_runs` | `idx_runs_started` | 否 | `started_at DESC` | - |
| `job_crawler_sources` | `idx_job_sources_category` | 否 | `category` | - |
| `job_crawler_sources` | `idx_job_sources_enabled` | 否 | `enabled` | - |
| `job_exam_events` | `idx_exam_events` | 否 | `event_at` | - |
| `job_exam_events` | `idx_exam_job` | 否 | `job_id` | - |
| `job_favorites` | `idx_fav_job` | 否 | `job_id` | - |
| `job_notifications` | `idx_job_notif_user` | 否 | `user_id, read_at, created_at DESC` | - |
| `job_notifications` | `idx_job_notifications_job` | 否 | `job_id` | - |
| `job_notifications` | `idx_job_notifications_job` | 否 | `job_id` | - |
| `job_notifications` | `idx_job_notifications_sub` | 否 | `subscription_id` | - |
| `job_notifications` | `idx_job_notifications_sub` | 否 | `subscription_id` | - |
| `job_postings` | `idx_jobs_category` | 否 | `category, fetched_at DESC` | - |
| `job_postings` | `idx_jobs_channel` | 否 | `channel` | - |
| `job_postings` | `idx_jobs_city` | 否 | `city` | - |
| `job_postings` | `idx_jobs_content_hash` | 否 | `source, content_hash` | - |
| `job_postings` | `idx_jobs_deadline` | 否 | `deadline_at` | - |
| `job_postings` | `idx_jobs_fetched` | 否 | `fetched_at DESC` | - |
| `job_postings` | `idx_jobs_market_band` | 否 | `salary_band` | `salary_band <> ''` |
| `job_postings` | `idx_jobs_market_function` | 否 | `function_key` | `function_key <> ''` |
| `job_postings` | `idx_jobs_market_industry` | 否 | `industry_sector, industry_subsector` | `industry_sector <> ''` |
| `job_postings` | `idx_jobs_market_seniority` | 否 | `seniority_bucket` | `seniority_bucket <> ''` |
| `job_postings` | `idx_jobs_published` | 否 | `published_at DESC` | - |
| `job_postings` | `idx_jobs_salary` | 否 | `salary_max DESC` | - |
| `job_postings` | `idx_jobs_source` | 否 | `source` | - |
| `job_postings` | `idx_jobs_title` | 否 | `title` | - |
| `job_skill_links` | `idx_job_skill_job` | 否 | `job_id` | - |
| `job_skill_links` | `idx_job_skill_links_skill` | 否 | `skill_id` | - |
| `job_skill_links` | `idx_job_skill_links_skill` | 否 | `skill_id` | - |
| `job_source_health` | `idx_source_health` | 否 | `source, created_at DESC` | - |
| `job_subscriptions` | `idx_job_sub_user` | 否 | `user_id` | - |
| `knowledge_favorites` | `idx_knowledge_favorites_recent` | 否 | `user_id, created_at DESC` | `deleted_at IS NULL` |
| `knowledge_favorites` | `idx_knowledge_favorites_recent` | 否 | `user_id, created_at DESC` | `deleted_at IS NULL` |
| `knowledge_favorites` | `uq_knowledge_favorites_active` | 是 | `user_id, point_key` | `deleted_at IS NULL` |
| `knowledge_favorites` | `uq_knowledge_favorites_active` | 是 | `user_id, point_key` | `deleted_at IS NULL` |
| `knowledge_links` | `idx_knowledge_links_source` | 否 | `source_note_id` | - |
| `knowledge_links` | `idx_knowledge_links_source` | 否 | `source_note_id` | - |
| `knowledge_links` | `idx_knowledge_links_target` | 否 | `target_note_id` | - |
| `knowledge_links` | `idx_knowledge_links_target` | 否 | `target_note_id` | - |
| `knowledge_note_tags` | `idx_knowledge_note_tags_tag` | 否 | `tag_id` | - |
| `knowledge_note_tags` | `idx_knowledge_note_tags_tag` | 否 | `tag_id` | - |
| `knowledge_notes` | `idx_knowledge_notes_topic` | 否 | `topic_id` | - |
| `knowledge_notes` | `idx_knowledge_notes_topic` | 否 | `topic_id` | - |
| `knowledge_notes` | `idx_knowledge_notes_type` | 否 | `type` | - |
| `knowledge_notes` | `idx_knowledge_notes_type` | 否 | `type` | - |
| `knowledge_notes` | `idx_knowledge_notes_user` | 否 | `user_id` | - |
| `knowledge_notes` | `idx_knowledge_notes_user` | 否 | `user_id` | - |
| `knowledge_notes` | `uq_knowledge_notes_anon` | 是 | `slug` | `user_id IS NULL` |
| `knowledge_notes` | `uq_knowledge_notes_anon` | 是 | `slug` | `user_id IS NULL` |
| `knowledge_notes` | `uq_knowledge_notes_user` | 是 | `user_id, slug` | `user_id IS NOT NULL` |
| `knowledge_notes` | `uq_knowledge_notes_user` | 是 | `user_id, slug` | `user_id IS NOT NULL` |
| `knowledge_points` | `idx_knowledge_points_stage` | 否 | `track_slug, stage_key, topic_order` | - |
| `knowledge_points` | `idx_knowledge_points_stage` | 否 | `track_slug, stage_key, topic_order` | - |
| `knowledge_points` | `idx_knowledge_points_stale` | 否 | `stale_after` | `stale_after IS NOT NULL` |
| `knowledge_points` | `idx_knowledge_points_stale` | 否 | `stale_after` | `stale_after IS NOT NULL` |
| `knowledge_points` | `idx_knowledge_points_status` | 否 | `status, quality_level` | - |
| `knowledge_points` | `idx_knowledge_points_status` | 否 | `status, quality_level` | - |
| `knowledge_points` | `idx_knowledge_points_track` | 否 | `track_slug, sort_order` | - |
| `knowledge_points` | `idx_knowledge_points_track` | 否 | `track_slug, sort_order` | - |
| `knowledge_prerequisite` | `idx_knowledge_prereq_of` | 否 | `prerequisite_key` | - |
| `knowledge_prerequisite` | `idx_knowledge_prereq_of` | 否 | `prerequisite_key` | - |
| `knowledge_read_state` | `idx_knowledge_read_recent` | 否 | `user_id, last_read_at DESC` | - |
| `knowledge_read_state` | `idx_knowledge_read_recent` | 否 | `user_id, last_read_at DESC` | - |
| `knowledge_read_state` | `idx_knowledge_read_track` | 否 | `user_id, track_slug, stage_key` | - |
| `knowledge_read_state` | `idx_knowledge_read_track` | 否 | `user_id, track_slug, stage_key` | - |
| `knowledge_relation` | `idx_knowledge_relation_to` | 否 | `to_key, kind` | - |
| `knowledge_relation` | `idx_knowledge_relation_to` | 否 | `to_key, kind` | - |
| `knowledge_tags` | `uq_knowledge_tags_anon` | 是 | `slug` | `user_id IS NULL` |
| `knowledge_tags` | `uq_knowledge_tags_anon` | 是 | `slug` | `user_id IS NULL` |
| `knowledge_tags` | `uq_knowledge_tags_user` | 是 | `user_id, slug` | `user_id IS NOT NULL` |
| `knowledge_tags` | `uq_knowledge_tags_user` | 是 | `user_id, slug` | `user_id IS NOT NULL` |
| `learning_attempts` | `idx_learning_attempts_track` | 否 | `user_id, track_slug, created_at DESC` | - |
| `learning_attempts` | `idx_learning_attempts_track` | 否 | `user_id, track_slug, created_at DESC` | - |
| `learning_attempts` | `idx_learning_attempts_user_created` | 否 | `user_id, created_at DESC` | - |
| `learning_attempts` | `idx_learning_attempts_user_created` | 否 | `user_id, created_at DESC` | - |
| `learning_attempts` | `idx_learning_attempts_user_question` | 否 | `user_id, question_key, created_at DESC` | - |
| `learning_attempts` | `idx_learning_attempts_user_question` | 否 | `user_id, question_key, created_at DESC` | - |
| `learning_review_cards` | `idx_learning_review_due` | 否 | `user_id, due_at` | - |
| `learning_review_cards` | `idx_learning_review_due` | 否 | `user_id, due_at` | - |
| `learning_review_cards` | `idx_learning_review_track` | 否 | `user_id, track_slug` | - |
| `learning_review_cards` | `idx_learning_review_track` | 否 | `user_id, track_slug` | - |
| `log_entries` | `idx_log_entries_career` | 否 | `career_key` | - |
| `log_entries` | `idx_logs_user` | 否 | `user_id` | - |
| `log_entries` | `uq_log_entries_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `log_entries` | `uq_log_entries_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `market_dimension_snapshots` | `idx_market_dimension_snapshot_lookup` | 否 | `snap_date DESC, dimension, dimension_key` | - |
| `market_dimension_snapshots` | `idx_market_dimension_snapshot_lookup` | 否 | `snap_date DESC, dimension, dimension_key` | - |
| `market_saved_views` | `idx_market_saved_views_user` | 否 | `user_id, updated_at DESC` | - |
| `market_saved_views` | `idx_market_saved_views_user` | 否 | `user_id, updated_at DESC` | - |
| `market_stats_history` | `idx_market_stats_history_snap_date` | 否 | `snap_date DESC` | - |
| `market_stats_history` | `idx_market_stats_history_snap_date` | 否 | `snap_date DESC` | - |
| `meal_entries` | `idx_meal_entries_anon` | 否 | `anon_id, log_date` | `deleted_at IS NULL AND user_id IS NULL` |
| `meal_entries` | `idx_meal_entries_anon` | 否 | `anon_id, log_date` | `deleted_at IS NULL AND user_id IS NULL` |
| `meal_entries` | `idx_meal_entries_food` | 否 | `food_id` | - |
| `meal_entries` | `idx_meal_entries_food` | 否 | `food_id` | - |
| `meal_entries` | `idx_meal_entries_user_date` | 否 | `user_id, log_date` | `deleted_at IS NULL` |
| `meal_entries` | `idx_meal_entries_user_date` | 否 | `user_id, log_date` | `deleted_at IS NULL` |
| `meal_entries` | `uq_meal_entries_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `meal_entries` | `uq_meal_entries_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `password_reset_tokens` | `idx_prt_expires_at` | 否 | `expires_at` | - |
| `password_reset_tokens` | `idx_prt_user` | 否 | `user_id` | - |
| `question_knowledge_point` | `idx_qkp_point` | 否 | `knowledge_point_key` | - |
| `question_knowledge_point` | `idx_qkp_point` | 否 | `knowledge_point_key` | - |
| `question_knowledge_point` | `idx_qkp_stage` | 否 | `track_slug, stage_key` | - |
| `question_knowledge_point` | `idx_qkp_stage` | 否 | `track_slug, stage_key` | - |
| `resume_assets` | `idx_resume_user` | 否 | `user_id` | - |
| `resume_assets` | `uq_resume_assets_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `resume_assets` | `uq_resume_assets_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `resume_documents` | `idx_resume_docs_anon` | 否 | `anon_id` | `deleted_at IS NULL AND user_id IS NULL` |
| `resume_documents` | `idx_resume_docs_anon` | 否 | `anon_id` | `deleted_at IS NULL AND user_id IS NULL` |
| `resume_documents` | `idx_resume_docs_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `resume_documents` | `idx_resume_docs_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `resume_documents` | `uq_resume_documents_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `resume_documents` | `uq_resume_documents_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `resume_files` | `idx_resume_files_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `resume_files` | `idx_resume_files_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `sessions` | `idx_sessions_expires_at` | 否 | `expires_at` | - |
| `sessions` | `idx_sessions_user` | 否 | `user_id` | - |
| `sessions` | `idx_sessions_user_id` | 否 | `user_id` | - |
| `sessions` | `uq_sessions_token_hash` | 是 | `token_hash` | `token_hash IS NOT NULL` |
| `skill_content_links` | `idx_skill_content_links_topic` | 否 | `topic_id` | - |
| `skill_content_links` | `idx_skill_content_links_topic` | 否 | `topic_id` | - |
| `skill_content_links` | `idx_skill_content_skill` | 否 | `skill_id` | - |
| `sport_items` | `idx_sport_items_sort` | 否 | `sort` | `enabled` |
| `sports_profiles` | `idx_sports_profiles_public` | 否 | `is_public` | `deleted_at IS NULL AND is_public = true` |
| `sports_profiles` | `idx_sports_profiles_public` | 否 | `is_public` | `deleted_at IS NULL AND is_public = true` |
| `sports_profiles` | `uq_sports_profiles_user_sport` | 是 | `user_id, sport_key` | `deleted_at IS NULL` |
| `sports_profiles` | `uq_sports_profiles_user_sport` | 是 | `user_id, sport_key` | `deleted_at IS NULL` |
| `sync_changes` | `idx_sync_changes_synced` | 否 | `synced_at` | - |
| `sync_changes` | `idx_sync_changes_synced` | 否 | `synced_at` | - |
| `sync_changes` | `idx_sync_changes_user` | 否 | `user_id` | - |
| `sync_changes` | `idx_sync_changes_user` | 否 | `user_id` | - |
| `sync_changes` | `uq_sync_changes_user_change` | 是 | `user_id, change_id` | `change_id IS NOT NULL` |
| `sync_devices` | `idx_sync_devices_user` | 否 | `user_id` | - |
| `sync_devices` | `idx_sync_devices_user` | 否 | `user_id` | - |
| `topic_progress` | `idx_progress_topic` | 否 | `topic_id` | - |
| `topic_progress` | `idx_progress_user` | 否 | `user_id` | - |
| `topic_progress` | `uq_topic_progress_anon` | 是 | `topic_id` | `user_id IS NULL` |
| `topic_progress` | `uq_topic_progress_anon` | 是 | `topic_id` | `user_id IS NULL` |
| `topic_progress` | `uq_topic_progress_anon` | 是 | `anon_id, topic_id` | `anon_id IS NOT NULL` |
| `topic_progress` | `uq_topic_progress_user` | 是 | `user_id, topic_id` | `user_id IS NOT NULL` |
| `topic_progress` | `uq_topic_progress_user` | 是 | `user_id, topic_id` | `user_id IS NOT NULL` |
| `tracker_logs` | `idx_tracker_logs_tracker` | 否 | `tracker_id` | - |
| `tracker_logs` | `idx_tracker_logs_user` | 否 | `user_id` | - |
| `tracker_logs` | `idx_tracker_logs_user` | 否 | `user_id` | - |
| `uploads` | `idx_uploads_user` | 否 | `user_id, created_at DESC` | `deleted_at IS NULL` |
| `uploads` | `idx_uploads_user` | 否 | `user_id, created_at DESC` | `deleted_at IS NULL` |
| `uploads` | `uq_uploads_path` | 是 | `path` | - |
| `uploads` | `uq_uploads_path` | 是 | `path` | - |
| `uploads` | `uq_uploads_user_client` | 是 | `user_id, client_id` | `client_id IS NOT NULL AND deleted_at IS NULL` |
| `uploads` | `uq_uploads_user_client` | 是 | `user_id, client_id` | `client_id IS NOT NULL AND deleted_at IS NULL` |
| `user_settings` | `uq_user_settings_anon` | 是 | `anon_id` | `user_id IS NULL AND anon_id IS NOT NULL` |
| `user_settings` | `uq_user_settings_anon` | 是 | `anon_id` | `user_id IS NULL AND anon_id IS NOT NULL` |
| `user_settings` | `uq_user_settings_user` | 是 | `user_id` | `user_id IS NOT NULL` |
| `user_settings` | `uq_user_settings_user` | 是 | `user_id` | `user_id IS NOT NULL` |
| `user_skills` | `idx_user_skills_skill` | 否 | `skill_id` | - |
| `user_skills` | `idx_user_skills_skill` | 否 | `skill_id` | - |
| `user_skills` | `idx_user_skills_user` | 否 | `user_id` | - |
| `weight_logs` | `idx_weight_logs_anon_date` | 否 | `anon_id, log_date DESC` | `deleted_at IS NULL AND user_id IS NULL` |
| `weight_logs` | `idx_weight_logs_user_date` | 否 | `user_id, log_date DESC` | `deleted_at IS NULL` |
| `weight_logs` | `idx_weight_logs_user_date` | 否 | `user_id, log_date DESC` | `deleted_at IS NULL` |
| `weight_logs` | `uq_weight_logs_anon_date` | 是 | `anon_id, log_date` | `deleted_at IS NULL AND user_id IS NULL AND anon_id IS NOT NULL` |
| `weight_logs` | `uq_weight_logs_anon_date` | 是 | `anon_id, log_date` | `deleted_at IS NULL AND user_id IS NULL AND anon_id IS NOT NULL` |
| `weight_logs` | `uq_weight_logs_user_date` | 是 | `user_id, log_date` | `deleted_at IS NULL AND user_id IS NOT NULL` |
| `weight_logs` | `uq_weight_logs_user_date` | 是 | `user_id, log_date` | `deleted_at IS NULL AND user_id IS NOT NULL` |
| `wellbeing_reminders` | `idx_wb_reminders_user` | 否 | `user_id` | `deleted_at IS NULL` |
| `wellbeing_reminders` | `uq_wb_reminders_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `workout_items` | `idx_workout_items_user` | 否 | `user_id` | - |
| `workout_items` | `idx_workout_items_user` | 否 | `user_id` | - |
| `workout_items` | `idx_workout_items_workout` | 否 | `workout_id, sort_order` | - |
| `workout_items` | `idx_workout_items_workout` | 否 | `workout_id, sort_order` | - |
| `workouts` | `idx_workouts_anon` | 否 | `anon_id, exercised_on DESC` | `deleted_at IS NULL AND user_id IS NULL` |
| `workouts` | `idx_workouts_anon` | 否 | `anon_id, exercised_on DESC` | `deleted_at IS NULL AND user_id IS NULL` |
| `workouts` | `idx_workouts_user_date` | 否 | `user_id, exercised_on DESC` | `deleted_at IS NULL` |
| `workouts` | `idx_workouts_user_date` | 否 | `user_id, exercised_on DESC` | `deleted_at IS NULL` |
| `workouts` | `uq_workouts_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `workouts` | `uq_workouts_client` | 是 | `user_id, client_id` | `user_id IS NOT NULL AND client_id IS NOT NULL` |
| `xp_events` | `idx_xp_user` | 否 | `user_id` | - |

## 3. 每表约束

| 表 | 约束 |
|---|---|
| `accounts` | - |
| `app_meta` | - |
| `audit_log` | `CONSTRAINT ck_audit_log_actor_type CHECK (actor_type IN ('user','system','cron','cli','anon'))`<br>`CONSTRAINT ck_audit_log_actor_type CHECK (actor_type IN ('user','system','cron','cli','anon'))` |
| `auth_attempts` | - |
| `background_images` | `UNIQUE (source, image_date)` |
| `break_sessions` | - |
| `careers` | `careers_kind_check CHECK (kind IN ('career','language','sports','hobby','life','custom'))`<br>`careers_owner_scope_check CHECK (kind <> 'custom' OR owner_id IS NOT NULL)` |
| `certificates` | `CHECK (status IN ('planned','preparing','achieved'))` |
| `checkins` | `UNIQUE (user_id, checkin_date)` |
| `content_checkpoints` | - |
| `content_import_batch` | `CONSTRAINT ck_content_import_mode CHECK (mode IN ('dry-run','apply'))`<br>`CONSTRAINT ck_content_import_status CHECK (status IN ('running','success','partial','failed','rolled-back'))`<br>`CONSTRAINT ck_content_import_mode CHECK (mode IN ('dry-run','apply'))`<br>`CONSTRAINT ck_content_import_status CHECK (status IN ('running','success','partial','failed','rolled-back'))` |
| `content_import_item` | `CONSTRAINT ck_content_import_item_kind CHECK (kind IN ('knowledge-point','question'))`<br>`CONSTRAINT ck_content_import_item_action CHECK (action IN ('new','update','skip','conflict','failed'))`<br>`CONSTRAINT ck_content_import_item_kind CHECK (kind IN ('knowledge-point','question'))`<br>`CONSTRAINT ck_content_import_item_action CHECK (action IN ('new','update','skip','conflict','failed'))` |
| `content_phases` | `CONSTRAINT ck_content_phases_status CHECK (status IN ('draft','review','published','archived'))`<br>`UNIQUE (career_key, track, sort_order)`<br>`CONSTRAINT uq_content_phases_slug UNIQUE (slug)`<br>`content_phases_career_track_sort UNIQUE (career_key, track, sort_order)`<br>`ck_content_phases_status CHECK (status IN ('draft','review','published','archived'))`<br>`ck_content_phases_version CHECK (version > 0)` |
| `content_practices` | - |
| `content_projects` | - |
| `content_resources` | - |
| `content_source` | `CONSTRAINT ck_content_source_usage CHECK (usage IN ('import','reference'))`<br>`CONSTRAINT ck_content_source_status CHECK (status IN ('active','paused','retired'))`<br>`CONSTRAINT ck_content_source_usage CHECK (usage IN ('import','reference'))`<br>`CONSTRAINT ck_content_source_status CHECK (status IN ('active','paused','retired'))`<br>`ck_content_source_version CHECK (version > 0)` |
| `content_topic_items` | - |
| `content_topics` | `CONSTRAINT ck_content_topics_status CHECK (status IN ('draft','review','published','archived'))`<br>`CONSTRAINT ck_content_topics_difficulty CHECK (difficulty IN ('easy','medium','hard'))`<br>`CONSTRAINT ck_content_topics_quality CHECK (quality_level IN ('L0','L1','L2','L3','L4'))`<br>`CONSTRAINT uq_content_topics_slug UNIQUE (slug)`<br>`ck_content_topics_status CHECK (status IN ('draft','review','published','archived'))`<br>`ck_content_topics_quality CHECK (quality_level IN ('L0','L1','L2','L3','L4'))`<br>`ck_content_topics_difficulty CHECK (difficulty IN ('easy','medium','hard'))`<br>`ck_content_topics_version CHECK (version > 0)` |
| `daily_tasks` | `CHECK (task_type IN ('study','agent','output','review','exam'))` |
| `domain_trackers` | `UNIQUE (user_id, domain_key, name)`<br>`UNIQUE (user_id, domain_key, name)` |
| `energy_logs` | - |
| `equipment_items` | - |
| `exercise_goals` | - |
| `exercise_items` | `CHECK (muscle_group IN ('胸', '背', '腿', '肩', '手臂', '核心', '臀', '全身'))`<br>`CHECK (category IN ('BALL', 'AEROBIC', 'STRENGTH', 'STRETCH', 'MOVE', 'OTHER'))`<br>`CHECK (equipment IS NULL OR equipment IN ('杠铃', '哑铃', '器械', '自重', '绳索', '壶铃'))`<br>`CHECK (muscle_group IN ('胸', '背', '腿', '肩', '手臂', '核心', '臀', '全身'))`<br>`CHECK (category IN ('BALL', 'AEROBIC', 'STRENGTH', 'STRETCH', 'MOVE', 'OTHER'))`<br>`CHECK (equipment IS NULL OR equipment IN ('杠铃', '哑铃', '器械', '自重', '绳索', '壶铃'))` |
| `exercise_logs` | `CHECK (type IN ('BALL','AEROBIC','STRENGTH','STRETCH','MOVE','OTHER'))`<br>`CHECK (source IN ('MANUAL','FOCUS','BREAK'))`<br>`CHECK (type IN ('BALL','AEROBIC','STRENGTH','STRETCH','MOVE','OTHER'))`<br>`CHECK (source IN ('MANUAL','FOCUS','BREAK'))` |
| `focus_sessions` | - |
| `food_import_runs` | - |
| `food_items` | `UNIQUE (source, source_id)`<br>`UNIQUE (source, source_id)` |
| `foods` | - |
| `habit_logs` | `UNIQUE (user_id, habit_id, log_date)`<br>`UNIQUE (user_id, habit_id, log_date)` |
| `habits` | `habits_remind_start_fmt CHECK (remind_start IS NULL OR remind_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`<br>`habits_remind_end_fmt CHECK (remind_end IS NULL OR remind_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')` |
| `hydration_goals` | - |
| `hydration_logs` | - |
| `identities` | `UNIQUE (provider, provider_uid)`<br>`UNIQUE (provider, provider_uid)` |
| `interview_attempts` | `CHECK (mode IN ('quiz','mock','interview'))`<br>`CHECK (mode IN ('quiz','mock','interview'))` |
| `interview_crawl_runs` | - |
| `interview_questions` | - |
| `job_applications` | `CHECK (stage IN ('favorite','ready','applied','online_test','interview1','interview2','offer','hired','closed'))`<br>`UNIQUE (user_id, job_id)`<br>`CHECK (stage IN ('favorite','ready','applied','online_test','interview1','interview2','offer','hired','closed'))`<br>`UNIQUE (user_id, job_id)` |
| `job_clusters` | `UNIQUE (dedup_key)`<br>`UNIQUE (dedup_key)` |
| `job_crawler_configs` | - |
| `job_crawler_runs` | - |
| `job_crawler_sources` | - |
| `job_exam_events` | `UNIQUE (job_id, kind, event_at)`<br>`UNIQUE (job_id, kind, event_at)` |
| `job_favorites` | `PRIMARY KEY (user_id, job_id)`<br>`PRIMARY KEY (user_id, job_id)` |
| `job_notifications` | - |
| `job_postings` | `UNIQUE (source, source_job_id)`<br>`UNIQUE (source, source_job_id)` |
| `job_skill_links` | `PRIMARY KEY (job_id, skill_id)`<br>`PRIMARY KEY (job_id, skill_id)` |
| `job_source_health` | - |
| `job_subscriptions` | - |
| `knowledge_favorites` | - |
| `knowledge_links` | `CHECK (type IN ('RELATED','PREREQUISITE','REFERENCE','DERIVED'))`<br>`CHECK (source_note_id <> target_note_id)`<br>`CHECK (type IN ('RELATED','PREREQUISITE','REFERENCE','DERIVED'))`<br>`CHECK (source_note_id <> target_note_id)` |
| `knowledge_note_tags` | `PRIMARY KEY (note_id, tag_id)`<br>`PRIMARY KEY (note_id, tag_id)` |
| `knowledge_notes` | `CHECK (type IN ('NOTE','TUTORIAL','REFERENCE','MINDMAP','REVIEW','PROJECT_NOTE'))`<br>`CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED'))`<br>`CHECK (type IN ('NOTE','TUTORIAL','REFERENCE','MINDMAP','REVIEW','PROJECT_NOTE'))`<br>`CHECK (status IN ('DRAFT','ACTIVE','ARCHIVED'))` |
| `knowledge_points` | `CONSTRAINT ck_knowledge_points_status CHECK (status IN ('draft','review','published','archived'))`<br>`CONSTRAINT ck_knowledge_points_quality CHECK (quality_level IN ('L0','L1','L2','L3','L4'))`<br>`CONSTRAINT ck_knowledge_points_level CHECK (difficulty IN ('easy','medium','hard'))`<br>`CONSTRAINT ck_knowledge_points_status CHECK (status IN ('draft','review','published','archived'))`<br>`CONSTRAINT ck_knowledge_points_quality CHECK (quality_level IN ('L0','L1','L2','L3','L4'))`<br>`CONSTRAINT ck_knowledge_points_level CHECK (difficulty IN ('easy','medium','hard'))`<br>`ck_knowledge_points_version CHECK (version > 0)` |
| `knowledge_prerequisite` | `CONSTRAINT ck_knowledge_prereq_source CHECK (relation_source IN ('derived','curated'))`<br>`PRIMARY KEY (knowledge_point_key, prerequisite_key)`<br>`CONSTRAINT ck_knowledge_prereq_not_self CHECK (knowledge_point_key <> prerequisite_key)`<br>`PRIMARY KEY (knowledge_point_key, prerequisite_key)`<br>`CONSTRAINT ck_knowledge_prereq_not_self CHECK (knowledge_point_key <> prerequisite_key)`<br>`CONSTRAINT ck_knowledge_prereq_source CHECK (relation_source IN ('derived','curated'))` |
| `knowledge_read_state` | `PRIMARY KEY (user_id, point_key)`<br>`PRIMARY KEY (user_id, point_key)` |
| `knowledge_relation` | `CONSTRAINT ck_knowledge_relation_kind CHECK (kind IN ('next','related'))`<br>`CONSTRAINT ck_knowledge_relation_source CHECK (relation_source IN ('derived','curated'))`<br>`PRIMARY KEY (from_key, to_key, kind)`<br>`CONSTRAINT ck_knowledge_relation_not_self CHECK (from_key <> to_key)`<br>`PRIMARY KEY (from_key, to_key, kind)`<br>`CONSTRAINT ck_knowledge_relation_kind CHECK (kind IN ('next','related'))`<br>`CONSTRAINT ck_knowledge_relation_source CHECK (relation_source IN ('derived','curated'))`<br>`CONSTRAINT ck_knowledge_relation_not_self CHECK (from_key <> to_key)` |
| `knowledge_tags` | - |
| `learning_attempts` | - |
| `learning_review_cards` | `CHECK (status IN ('learning', 'review', 'mastered'))`<br>`PRIMARY KEY (user_id, question_key)`<br>`CHECK (status IN ('learning', 'review', 'mastered'))`<br>`PRIMARY KEY (user_id, question_key)` |
| `log_entries` | - |
| `market_dimension_snapshots` | `UNIQUE (snap_date, dimension, dimension_key, metric_name)`<br>`UNIQUE (snap_date, dimension, dimension_key, metric_name)` |
| `market_saved_views` | `UNIQUE (user_id, name)`<br>`UNIQUE (user_id, name)` |
| `market_stats` | - |
| `market_stats_history` | - |
| `meal_entries` | `CHECK (meal IN ('breakfast','lunch','dinner','snack'))` |
| `password_reset_tokens` | - |
| `question_knowledge_point` | `CONSTRAINT ck_qkp_link_source CHECK (link_source IN ('explicit','stage-fallback','curated'))`<br>`PRIMARY KEY (question_key, knowledge_point_key)`<br>`PRIMARY KEY (question_key, knowledge_point_key)`<br>`CONSTRAINT ck_qkp_link_source CHECK (link_source IN ('explicit','stage-fallback','curated'))` |
| `resume_assets` | - |
| `resume_documents` | - |
| `resume_files` | - |
| `sessions` | - |
| `settings` | `UNIQUE (user_id, key)` |
| `skill_content_links` | `PRIMARY KEY (skill_id, topic_id)`<br>`PRIMARY KEY (skill_id, topic_id)` |
| `skill_taxonomy` | - |
| `sport_items` | - |
| `sports_profiles` | `sports_profiles_record_nonneg CHECK (matches_played >= 0 AND wins >= 0 AND losses >= 0)`<br>`sports_profiles_tension_range CHECK (tension_lbs IS NULL OR (tension_lbs > 0 AND tension_lbs <= 40))`<br>`sports_profiles_record_nonneg CHECK (matches_played >= 0 AND wins >= 0 AND losses >= 0)`<br>`sports_profiles_tension_range CHECK (tension_lbs IS NULL OR (tension_lbs > 0 AND tension_lbs <= 40))` |
| `sync_changes` | - |
| `sync_devices` | `UNIQUE (user_id, device_id)`<br>`UNIQUE (user_id, device_id)` |
| `task_runs` | `CHECK (status IN ('idle','running','finished','failed'))`<br>`CHECK (status IN ('idle','running','finished','failed'))` |
| `topic_progress` | `UNIQUE (user_id, topic_id)` |
| `tracker_logs` | `UNIQUE (user_id, tracker_id, log_date)`<br>`UNIQUE (user_id, tracker_id, log_date)` |
| `uploads` | - |
| `user_settings` | `user_settings_height_cm_range CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 250))`<br>`user_settings_birth_year_range CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100))`<br>`user_settings_sex_values CHECK (sex IS NULL OR sex IN ('male', 'female'))`<br>`user_settings_activity_values CHECK (activity_level IS NULL OR activity_level IN ('sedentary', 'light', 'moderate', 'high'))`<br>`user_settings_target_kcal_range CHECK (nutrition_target_kcal IS NULL OR (nutrition_target_kcal BETWEEN 800 AND 6000))` |
| `user_skills` | `PRIMARY KEY (user_id, skill_id)`<br>`PRIMARY KEY (user_id, skill_id)` |
| `users` | `ck_users_role CHECK (role IN ('learner','editor','reviewer','admin'))`<br>`ck_users_role CHECK (role IN ('learner','editor','reviewer','admin'))` |
| `weight_logs` | - |
| `wellbeing_reminders` | - |
| `workout_items` | - |
| `workouts` | - |
| `xp_events` | - |
