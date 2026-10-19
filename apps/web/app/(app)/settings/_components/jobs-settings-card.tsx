"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChipEditor } from "./chip-editor";
import { NewSubscriptionForm } from "./new-subscription-form";
import { Bell, Flower2, Heart, Play, RefreshCw, Save, Trash2 } from "lucide-react";
import type { JobSource } from "@learn-workbench/shared/schemas";
import { allJobCategories, experimentalJobSources, jobCategoryLabels, jobSourceLabels } from "@learn-workbench/shared/labels";
import { formatRelativeTime } from "@learn-workbench/shared/dates";
import type { JobsSettingsApi } from "../_hooks/use-jobs-settings";
import { patchCrawler, toggleListValue } from "../_hooks/use-jobs-settings";

const CATEGORY_BUTTON_ON =
  "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.28)]";
const CATEGORY_BUTTON_OFF =
  "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white/15";

/** 招聘爬虫配置（S6-4：从 settings/page.tsx 抽出，状态由 useJobsSettings 提供） */
export function JobsSettingsCard({ jobs }: { jobs: JobsSettingsApi }) {
  const {
    crawler, setCrawler, crawlerBusy, crawlerRunBusy, jobRuns, jobStats, sources,
    hostsVersion, hostsUpdatedAt, hostsBusy, saveCrawler, toggleCategory, toggleSourceWhitelist,
    updateHosts, runCrawler,
  } = jobs;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flower2 className="size-5 text-emerald-500" />
          <CardTitle>招聘爬虫</CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={runCrawler} disabled={crawlerRunBusy || crawlerBusy}>
            {crawlerRunBusy ? <RefreshCw className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            立即抓取
          </Button>
          <Button size="sm" onClick={saveCrawler} disabled={crawlerBusy}>
            {crawlerBusy ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            保存配置
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">定时抓取开关</p>
            <p className="text-xs text-muted-foreground">关闭后暂停每日自动抓取，不影响手动运行</p>
          </div>
          <Switch
            checked={crawler?.enabled ?? false}
            onCheckedChange={(checked) => setCrawler((prev) => patchCrawler(prev, { enabled: checked }))}
          />
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
          <span className="text-xs font-medium text-muted-foreground">抓取类别（考公考编 / 央国企官方源）</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {allJobCategories.map((cat) => {
              const active = crawler?.categories.includes(cat) ?? false;
              return (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)} className={active ? CATEGORY_BUTTON_ON : CATEGORY_BUTTON_OFF}>
                  {jobCategoryLabels[cat]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <ChipEditor
            label="关键词"
            placeholder="如 网络工程师"
            items={crawler?.keywords ?? []}
            onAdd={(value) => setCrawler((prev) => (prev && !prev.keywords.includes(value) ? patchCrawler(prev, { keywords: [...prev.keywords, value] }) : prev))}
            onRemove={(value) => setCrawler((prev) => (prev ? patchCrawler(prev, { keywords: prev.keywords.filter((item) => item !== value) }) : prev))}
          />
          <ChipEditor
            label="行业"
            placeholder="如 通信"
            items={crawler?.industries ?? []}
            onAdd={(value) => setCrawler((prev) => (prev && !prev.industries.includes(value) ? patchCrawler(prev, { industries: [...prev.industries, value] }) : prev))}
            onRemove={(value) => setCrawler((prev) => (prev ? patchCrawler(prev, { industries: prev.industries.filter((item) => item !== value) }) : prev))}
          />
          <ChipEditor
            label="城市"
            placeholder="如 乌鲁木齐"
            items={crawler?.cities ?? []}
            onAdd={(value) => setCrawler((prev) => (prev && !prev.cities.includes(value) ? patchCrawler(prev, { cities: [...prev.cities, value] }) : prev))}
            onRemove={(value) => setCrawler((prev) => (prev ? patchCrawler(prev, { cities: prev.cities.filter((item) => item !== value) }) : prev))}
          />
        </div>

        <ChipEditor
          label="考编省份（省考 / 省直事业单位，可选）"
          placeholder="如 江苏"
          items={crawler?.provinces ?? []}
          onAdd={(value) => setCrawler((prev) => (prev && !prev.provinces.includes(value) ? patchCrawler(prev, { provinces: [...prev.provinces, value] }) : prev))}
          onRemove={(value) => setCrawler((prev) => (prev ? patchCrawler(prev, { provinces: prev.provinces.filter((item) => item !== value) }) : prev))}
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
            <span className="text-xs font-medium text-muted-foreground">招聘平台</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(jobSourceLabels) as JobSource[]).map((source) => {
                const active = crawler?.platforms.includes(source) ?? false;
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setCrawler((prev) => (prev ? patchCrawler(prev, { platforms: toggleListValue(prev.platforms, source) }) : prev))}
                    className={active ? CATEGORY_BUTTON_ON : CATEGORY_BUTTON_OFF}
                  >
                    {jobSourceLabels[source]}
                    {experimentalJobSources.includes(source) ? <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">实验</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
            <span className="text-xs font-medium text-muted-foreground">每日抓取时间</span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="time"
                value={crawler?.scheduleTime ?? "08:00"}
                onChange={(e) => setCrawler((prev) => patchCrawler(prev, { scheduleTime: e.target.value }))}
                className="h-10 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-foreground outline-none backdrop-blur-md focus:border-emerald-500/60"
              />
              <span className="text-xs text-muted-foreground">每天自动抓取一次</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">信息源（hosts 注册表驱动）</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                v{hostsVersion}
                {hostsUpdatedAt ? " · " + formatRelativeTime(hostsUpdatedAt) : " · 未更新"}
              </span>
              <Button variant="outline" size="sm" onClick={updateHosts} disabled={hostsBusy}>
                <RefreshCw className="size-3.5" />
                更新 hosts
              </Button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {sources.map((src) => {
              const active = crawler?.sources?.length ? crawler.sources.includes(src.id) : src.enabled;
              const rate = Math.round((src.hitRate ?? 1) * 100);
              return (
                <div key={src.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSourceWhitelist(src.id)}
                    aria-label={"切换 " + src.name}
                    className={"flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors " + (active ? "bg-emerald-500" : "bg-white/20")}
                  >
                    <span className={"size-3 rounded-full bg-white transition-transform " + (active ? "translate-x-3" : "")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-foreground">{src.name}</span>
                      <Badge variant={src.risk === "L1" ? "success" : src.risk === "L2" ? "accent" : "muted"} className="text-[9px]">
                        {src.risk === "L3" ? "实验" : "官方"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500" style={{ width: rate + "%" }} />
                      </div>
                      <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{rate}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {sources.length === 0 ? (
              <p className="col-span-full text-center text-xs text-muted-foreground">暂无信息源，请先「更新 hosts」</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur-md">
          <span className="text-muted-foreground">上次运行</span>
          <span className="font-semibold text-foreground">{jobStats?.lastRun ? formatRelativeTime(jobStats.lastRun) : "尚未运行"}</span>
          {jobStats?.lastRunStatus ? (
            <Badge variant={jobStats.lastRunStatus === "failed" ? "muted" : "success"}>{jobStats.lastRunStatus}</Badge>
          ) : null}
          {crawler?.lastRunAt ? (
            <span className="ml-auto text-xs text-muted-foreground">配置最近运行：{formatRelativeTime(crawler.lastRunAt)}</span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-semibold text-muted-foreground">最近运行日志</span>
            <Badge variant="muted">最多 10 条</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-y border-white/10 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">时间</th>
                  <th className="px-4 py-2 font-medium">平台</th>
                  <th className="px-4 py-2 font-medium">抓取</th>
                  <th className="px-4 py-2 font-medium">新增</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {jobRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">暂无运行日志</td>
                  </tr>
                ) : (
                  jobRuns.slice(0, 10).map((run) => {
                    const platformText = Object.entries(run.platformsResult ?? {})
                      .map(([key, count]) => {
                        const label = jobSourceLabels[key as JobSource] ?? key;
                        return `${label} ${count}`;
                      })
                      .join(" / ") || "—";
                    const statusLabel = run.status === "running" ? "运行中" : run.status === "success" ? "成功" : run.status === "partial" ? "部分成功" : "失败";
                    return (
                      <tr key={run.id} className="border-t border-white/5">
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{platformText}</td>
                        <td className="px-4 py-2 tabular-nums text-foreground">{run.fetchedCount}</td>
                        <td className="px-4 py-2 tabular-nums text-emerald-600 dark:text-emerald-300">{run.newCount}</td>
                        <td className="px-4 py-2">
                          <Badge variant={run.status === "failed" ? "muted" : run.status === "running" ? "accent" : "success"}>{statusLabel}</Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 订阅提醒（S6-4：从 settings/page.tsx 抽出） */
export function SubscriptionsCard({ jobs }: { jobs: JobsSettingsApi }) {
  const { subscriptions, removeSubscription, saveSubscription } = jobs;
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Bell className="size-5 text-primary" />
        <CardTitle>订阅提醒</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          按「央国企 × 北京 / 考编 × 计算机类」等条件订阅，抓取到新职位/公告时在招花页铃铛提醒
        </p>
        {subscriptions.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs text-muted-foreground">
            还没有订阅，点击下方按钮创建第一个
          </p>
        ) : (
          subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <Heart className="size-4 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{sub.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {sub.categories.length ? sub.categories.map((c) => jobCategoryLabels[c as never] ?? c).join(" / ") : "全类别"}
                  {sub.cities.length ? " · " + sub.cities.join(" / ") : ""}
                  {sub.keywords.length ? " · 关键词：" + sub.keywords.join("、") : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeSubscription(sub.id)}
                aria-label="删除订阅"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/15 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
        <NewSubscriptionForm
          onSave={async (sub) => {
            await saveSubscription(sub);
          }}
        />
      </CardContent>
    </Card>
  );
}
