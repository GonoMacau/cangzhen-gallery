#!/usr/bin/env node
/**
 * 將 supabase/migrations 推送到遠端 Postgres（不需 supabase login）。
 *
 * 用法：node scripts/apply-supabase-migrations.mjs
 *        npm run db:apply
 *
 * 讀取 .env.local：
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - PASSWORD（Supabase Database password，Dashboard → Settings → Database）
 *   - 選填 SUPABASE_DB_URL（自訂連線字串）
 *
 * 選用：--dry-run  僅列出將套用的 migration
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadProjectEnv,
  buildSupabaseDbUrlAsync,
} from "./lib/load-dotenv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = loadProjectEnv(resolve(__dirname, ".."));

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = process.env.PASSWORD;

function fail(msg) {
  console.error(`[db:apply] ${msg}`);
  process.exit(1);
}

if (!url) fail("缺少 NEXT_PUBLIC_SUPABASE_URL（.env.local）");
if (!dbPassword) {
  fail(
    "缺少 PASSWORD（請設為 Supabase Database password，Dashboard → Project Settings → Database）",
  );
}

console.log("[db:apply] 目標：", url.replace(/\/$/, ""));
if (dryRun) console.log("[db:apply] dry-run：僅預覽，不寫入");

const dbUrl = await buildSupabaseDbUrlAsync(url, dbPassword);

try {
  const dryFlag = dryRun ? " --dry-run" : "";
  execSync(`npx supabase db push --db-url ${JSON.stringify(dbUrl)} --yes${dryFlag}`, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: true,
  });
  console.log("[db:apply] migration 已套用");
} catch (e) {
  fail(
    e instanceof Error
      ? `db push 失敗：${e.message}`
      : "db push 失敗（請確認 PASSWORD 為 Database password，且 migration 版本號不重複）",
  );
}
