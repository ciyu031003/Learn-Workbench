import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { todayISO } from "@learn-workbench/shared";

export interface ManifestEntry {
  file: string;
  remote_url: string;
  copyright: string;
  width: number | null;
  height: number | null;
  md5: string;
}

function findBgDir(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "assets", "backgrounds", "bing");
    if (fs.existsSync(path.join(candidate, "index.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function GET() {
  const today = todayISO();
  const dir = findBgDir();
  if (!dir) return NextResponse.json({ date: today, file: null, exists: false });

  let manifest: Record<string, ManifestEntry> = {};
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf-8"));
  } catch {
    manifest = {};
  }

  const dates = Object.keys(manifest).sort();
  let pick = dates.find((d) => d === today) ?? null;
  if (!pick && dates.length > 0) {
    const past = dates.filter((d) => d < today);
    pick = past.length > 0 ? past[past.length - 1] : dates[dates.length - 1];
  }

  if (!pick) return NextResponse.json({ date: today, file: null, exists: false });

  const entry = manifest[pick];
  const file = path.join(dir, entry.file);
  return NextResponse.json({
    date: pick,
    file: entry.file,
    remoteUrl: entry.remote_url,
    copyright: entry.copyright,
    width: entry.width,
    height: entry.height,
    exists: fs.existsSync(file),
  });
}
