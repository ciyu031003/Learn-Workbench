# API 路由台账（组三 · H2）

> **本文件由脚本生成，请勿手改**：`node scripts/api-inventory.mjs`。
> 门槛：新增路由必须有同名测试、`api/internal/**` 必须限流、契约范围内必须有 OpenAPI 条目。
> 契约范围：`/api/internal/content/**`、`/api/learning/**`；欠账登记在 `api/test-exceptions.json`。

## 1. 总览

| 指标 | 数值 |
|---|---|
| 路由总数 | 135 |
| 有同名单测 | 135 / 135 |
| 已限流 | 15 / 135 |
| 内部接口（`api/internal/**`） | 6（已限流 6） |
| 已有 OpenAPI 条目 | 9 / 135 |

## 2. 未文档化清单（H2 跟进，不阻断）

共 126 个：`/api/ai/tip`、`/api/auth/account`、`/api/auth/forgot`、`/api/auth/identities`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/me`、`/api/auth/password`、`/api/auth/register`、`/api/auth/reset`、`/api/auth/wechat/bind`、`/api/auth/wechat/callback`、`/api/auth/wechat/qrcode`、`/api/auth/wechat/status`、`/api/background`、`/api/background/img`、`/api/background/refresh`、`/api/careers`、`/api/certificates`、`/api/checkin`、`/api/daily`、`/api/dashboard`、`/api/diagnostics`、`/api/domains`、`/api/domains/[key]/duplicate`、`/api/domains/overview`、`/api/equipment`、`/api/exercises`、`/api/export`、`/api/focus`、`/api/focus/daily`、`/api/focus/stats`、`/api/foods/search`、`/api/github`、`/api/habits`、`/api/habits/[id]`、`/api/habits/logs`、`/api/import`、`/api/internal/cron`、`/api/internal/equipment/import`、`/api/internal/interview/import`、`/api/internal/metrics`、`/api/jobs`、`/api/jobs/[id]`、`/api/jobs/[id]/favorite`、`/api/jobs/[id]/gaps`、`/api/jobs/[id]/match`、`/api/jobs/[id]/plan`、`/api/jobs/applications`、`/api/jobs/applications/[id]`、`/api/jobs/calendar`、`/api/jobs/cluster`、`/api/jobs/config`、`/api/jobs/favorites`、`/api/jobs/gaps/enroll`、`/api/jobs/health`、`/api/jobs/hosts/update`、`/api/jobs/notifications`、`/api/jobs/notifications/read`、`/api/jobs/radar`、`/api/jobs/run`、`/api/jobs/runs`、`/api/jobs/skills`、`/api/jobs/sources`、`/api/jobs/stats`、`/api/jobs/subscriptions`、`/api/jobs/subscriptions/[id]`、`/api/logs`、`/api/market`、`/api/market/decision`、`/api/market/intelligence`、`/api/market/personal`、`/api/market/views`、`/api/market/views/[id]`、`/api/notes`、`/api/nutrition`、`/api/nutrition/foods`、`/api/nutrition/stickers`、`/api/nutrition/summary`、`/api/nutrition/target`、`/api/phases`、`/api/profile/info`、`/api/profile/readiness`、`/api/profile/skills`、`/api/progress`、`/api/public/stats`、`/api/questions`、`/api/questions/answers`、`/api/questions/attempt`、`/api/questions/attempts`、`/api/resume-assets`、`/api/resume-files`、`/api/resume-files/[id]`、`/api/resumes`、`/api/resumes/[id]`、`/api/roadmap`、`/api/roadmap/custom`、`/api/roadmap/import`、`/api/roadmap/phases`、`/api/roadmap/reorder`、`/api/settings/career`、`/api/skills/gaps`、`/api/skills/recommend`、`/api/sports`、`/api/sports/profiles`、`/api/sports/profiles/[id]`、`/api/sports/share/[id]`、`/api/summary`、`/api/sync/pull`、`/api/sync/push`、`/api/tasks`、`/api/trackers`、`/api/trackers/logs`、`/api/uploads`、`/api/wellbeing/breaks`、`/api/wellbeing/energy`、`/api/wellbeing/exercise`、`/api/wellbeing/exercise/goal`、`/api/wellbeing/goal`、`/api/wellbeing/hydration`、`/api/wellbeing/profile`、`/api/wellbeing/reminders`、`/api/wellbeing/today`、`/api/wellbeing/weight`、`/api/workouts`、`/api/workouts/[id]`

## 3. 全量台账

| 路由 | 方法 | 鉴权 | 限流 | 单测 | 文档 |
|---|---|---|---|---|---|
| `/api/ai/tip` | GET | 公开 | ✅ | ✅ | — |
| `/api/auth/account` | DELETE | 登录 | — | ✅ | — |
| `/api/auth/forgot` | POST | 公开 | ✅ | ✅ | — |
| `/api/auth/identities` | GET | 登录 | — | ✅ | — |
| `/api/auth/login` | POST | 公开 | ✅ | ✅ | — |
| `/api/auth/logout` | POST | 公开 | — | ✅ | — |
| `/api/auth/me` | GET | 公开 | — | ✅ | — |
| `/api/auth/password` | POST | 登录 | — | ✅ | — |
| `/api/auth/register` | POST | 公开 | ✅ | ✅ | — |
| `/api/auth/reset` | POST | 公开 | ✅ | ✅ | — |
| `/api/auth/wechat/bind` | POST DELETE | 登录 | — | ✅ | — |
| `/api/auth/wechat/callback` | POST | 公开 | — | ✅ | — |
| `/api/auth/wechat/qrcode` | GET | 公开 | — | ✅ | — |
| `/api/auth/wechat/status` | GET | 公开 | — | ✅ | — |
| `/api/background` | GET | 公开 | — | ✅ | — |
| `/api/background/img` | GET | 公开 | — | ✅ | — |
| `/api/background/refresh` | POST | 登录 | ✅ | ✅ | — |
| `/api/careers` | GET | 登录 | — | ✅ | — |
| `/api/certificates` | GET POST PATCH DELETE | 公开 | — | ✅ | — |
| `/api/checkin` | POST | 登录 | — | ✅ | — |
| `/api/daily` | GET | 登录 | — | ✅ | — |
| `/api/dashboard` | GET | 登录 | — | ✅ | — |
| `/api/diagnostics` | POST | 登录 | ✅ | ✅ | — |
| `/api/domains` | GET POST PATCH DELETE | 登录 | — | ✅ | — |
| `/api/domains/[key]/duplicate` | POST | 登录 | — | ✅ | — |
| `/api/domains/overview` | GET | 登录 | — | ✅ | — |
| `/api/equipment` | GET | 公开 | — | ✅ | — |
| `/api/exercises` | GET | 公开 | — | ✅ | — |
| `/api/export` | GET | 登录 | — | ✅ | — |
| `/api/focus` | POST | 登录 | — | ✅ | — |
| `/api/focus/daily` | GET | 登录 | — | ✅ | — |
| `/api/focus/stats` | GET | 登录 | — | ✅ | — |
| `/api/foods/search` | GET | 公开 | — | ✅ | — |
| `/api/github` | GET POST DELETE | 登录 | — | ✅ | — |
| `/api/habits` | GET POST | 公开 | — | ✅ | — |
| `/api/habits/[id]` | PATCH DELETE | 公开 | — | ✅ | — |
| `/api/habits/logs` | GET POST DELETE | 公开 | — | ✅ | — |
| `/api/import` | POST | 登录 | — | ✅ | — |
| `/api/internal/content/import` | POST | 内部密钥 | ✅ | ✅ | ✅ |
| `/api/internal/content/sync` | POST | 内部密钥 | ✅ | ✅ | ✅ |
| `/api/internal/cron` | POST | 内部密钥 | ✅ | ✅ | — |
| `/api/internal/equipment/import` | POST | 内部密钥 | ✅ | ✅ | — |
| `/api/internal/interview/import` | POST | 内部密钥 | ✅ | ✅ | — |
| `/api/internal/metrics` | GET | 公开 | ✅ | ✅ | — |
| `/api/jobs` | GET | 登录 | — | ✅ | — |
| `/api/jobs/[id]` | GET | 登录 | — | ✅ | — |
| `/api/jobs/[id]/favorite` | POST | 登录 | — | ✅ | — |
| `/api/jobs/[id]/gaps` | GET | 登录 | — | ✅ | — |
| `/api/jobs/[id]/match` | GET | 登录 | — | ✅ | — |
| `/api/jobs/[id]/plan` | GET | 登录 | — | ✅ | — |
| `/api/jobs/applications` | GET POST | 登录 | — | ✅ | — |
| `/api/jobs/applications/[id]` | PUT DELETE | 登录 | — | ✅ | — |
| `/api/jobs/calendar` | GET | 登录 | — | ✅ | — |
| `/api/jobs/cluster` | POST | 登录 | — | ✅ | — |
| `/api/jobs/config` | GET PUT | 登录 | — | ✅ | — |
| `/api/jobs/favorites` | GET | 登录 | — | ✅ | — |
| `/api/jobs/gaps/enroll` | POST | 登录 | — | ✅ | — |
| `/api/jobs/health` | GET | 登录 | — | ✅ | — |
| `/api/jobs/hosts/update` | POST | 登录 | ✅ | ✅ | — |
| `/api/jobs/notifications` | GET | 登录 | — | ✅ | — |
| `/api/jobs/notifications/read` | POST | 登录 | — | ✅ | — |
| `/api/jobs/radar` | GET | 登录 | — | ✅ | — |
| `/api/jobs/run` | POST | 登录 | ✅ | ✅ | — |
| `/api/jobs/runs` | GET | 登录 | — | ✅ | — |
| `/api/jobs/skills` | GET | 公开 | — | ✅ | — |
| `/api/jobs/sources` | GET | 登录 | — | ✅ | — |
| `/api/jobs/stats` | GET | 登录 | — | ✅ | — |
| `/api/jobs/subscriptions` | GET POST | 登录 | — | ✅ | — |
| `/api/jobs/subscriptions/[id]` | DELETE | 登录 | — | ✅ | — |
| `/api/learning/attempt` | POST | 登录 | — | ✅ | ✅ |
| `/api/learning/catalog` | GET | 公开 | — | ✅ | ✅ |
| `/api/learning/favorite` | POST | 登录 | — | ✅ | ✅ |
| `/api/learning/library-state` | GET | 登录 | — | ✅ | ✅ |
| `/api/learning/progress` | GET | 登录 | — | ✅ | ✅ |
| `/api/learning/read` | POST | 登录 | — | ✅ | ✅ |
| `/api/learning/review` | GET | 登录 | — | ✅ | ✅ |
| `/api/logs` | GET POST | 登录 | — | ✅ | — |
| `/api/market` | GET | 公开 | — | ✅ | — |
| `/api/market/decision` | GET | 登录 | — | ✅ | — |
| `/api/market/intelligence` | GET | 公开 | — | ✅ | — |
| `/api/market/personal` | GET | 登录 | — | ✅ | — |
| `/api/market/views` | GET POST | 登录 | — | ✅ | — |
| `/api/market/views/[id]` | PATCH DELETE | 登录 | — | ✅ | — |
| `/api/notes` | GET | 公开 | — | ✅ | — |
| `/api/nutrition` | GET POST PATCH DELETE | 公开 | — | ✅ | — |
| `/api/nutrition/foods` | GET POST | 公开 | — | ✅ | — |
| `/api/nutrition/stickers` | GET | 公开 | — | ✅ | — |
| `/api/nutrition/summary` | GET | 公开 | — | ✅ | — |
| `/api/nutrition/target` | GET PUT | 公开 | — | ✅ | — |
| `/api/phases` | GET | 登录 | — | ✅ | — |
| `/api/profile/info` | GET PUT | 公开 | — | ✅ | — |
| `/api/profile/readiness` | GET | 登录 | — | ✅ | — |
| `/api/profile/skills` | GET POST DELETE | 登录 | — | ✅ | — |
| `/api/progress` | POST | 登录 | — | ✅ | — |
| `/api/public/stats` | GET | 公开 | — | ✅ | — |
| `/api/questions` | GET | 登录 | — | ✅ | — |
| `/api/questions/answers` | GET | 登录 | — | ✅ | — |
| `/api/questions/attempt` | POST | 登录 | — | ✅ | — |
| `/api/questions/attempts` | GET | 登录 | — | ✅ | — |
| `/api/resume-assets` | GET POST PATCH DELETE | 公开 | — | ✅ | — |
| `/api/resume-files` | GET POST | 登录 | — | ✅ | — |
| `/api/resume-files/[id]` | GET DELETE | 登录 | — | ✅ | — |
| `/api/resumes` | GET POST | 公开 | — | ✅ | — |
| `/api/resumes/[id]` | GET PATCH DELETE | 公开 | — | ✅ | — |
| `/api/roadmap` | GET | 登录 | — | ✅ | — |
| `/api/roadmap/custom` | POST DELETE | 登录 | — | ✅ | — |
| `/api/roadmap/import` | POST | 登录 | — | ✅ | — |
| `/api/roadmap/phases` | POST PATCH DELETE | 登录 | — | ✅ | — |
| `/api/roadmap/reorder` | POST | 登录 | — | ✅ | — |
| `/api/settings/career` | GET PUT | 登录 | — | ✅ | — |
| `/api/skills/gaps` | GET | 登录 | — | ✅ | — |
| `/api/skills/recommend` | GET | 登录 | — | ✅ | — |
| `/api/sports` | GET | 公开 | — | ✅ | — |
| `/api/sports/profiles` | GET POST | 登录 | — | ✅ | — |
| `/api/sports/profiles/[id]` | PATCH DELETE | 登录 | — | ✅ | — |
| `/api/sports/share/[id]` | GET | 公开 | — | ✅ | — |
| `/api/summary` | GET | 登录 | — | ✅ | — |
| `/api/sync/pull` | GET | 登录 | — | ✅ | — |
| `/api/sync/push` | POST | 登录 | — | ✅ | — |
| `/api/tasks` | GET POST PATCH | 登录 | — | ✅ | — |
| `/api/trackers` | GET POST PATCH DELETE | 登录 | — | ✅ | — |
| `/api/trackers/logs` | GET POST | 登录 | — | ✅ | — |
| `/api/uploads` | POST DELETE | 登录 | — | ✅ | — |
| `/api/wellbeing/breaks` | GET POST | 公开 | — | ✅ | — |
| `/api/wellbeing/energy` | GET POST | 公开 | — | ✅ | — |
| `/api/wellbeing/exercise` | GET POST DELETE | 公开 | — | ✅ | — |
| `/api/wellbeing/exercise/goal` | GET PUT | 公开 | — | ✅ | — |
| `/api/wellbeing/goal` | GET PUT | 公开 | — | ✅ | — |
| `/api/wellbeing/hydration` | GET POST DELETE | 公开 | — | ✅ | — |
| `/api/wellbeing/profile` | GET PUT | 公开 | — | ✅ | — |
| `/api/wellbeing/reminders` | GET POST PATCH DELETE | 公开 | — | ✅ | — |
| `/api/wellbeing/today` | GET | 公开 | — | ✅ | — |
| `/api/wellbeing/weight` | GET POST DELETE | 公开 | — | ✅ | — |
| `/api/workouts` | GET POST | 公开 | — | ✅ | — |
| `/api/workouts/[id]` | PATCH DELETE | 公开 | — | ✅ | — |
