import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadProjectEnv(projectRoot = resolve(__dirname, "../..")) {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(projectRoot, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let [, key, value] = m;
      if (process.env[key] !== undefined) continue;
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
  return projectRoot;
}

export function getSupabaseProjectRef(url) {
  return new URL(url.replace(/\/$/, "")).hostname.split(".")[0];
}

/**
 * 建構 Postgres 連線字串（供 supabase db push / query）。
 * 優先 SUPABASE_DB_URL；否則走 Session pooler（IPv4）。
 * 區域 / 編號可用 SUPABASE_DB_POOLER_REGION、SUPABASE_DB_POOLER_INDEX 覆寫。
 */
export async function buildSupabaseDbUrlAsync(supabaseUrl, dbPassword) {
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }
  const ref = getSupabaseProjectRef(supabaseUrl);
  const encoded = encodeURIComponent(dbPassword);
  const region = process.env.SUPABASE_DB_POOLER_REGION ?? "ap-southeast-1";
  const poolerIndex = process.env.SUPABASE_DB_POOLER_INDEX ?? "1";
  return `postgresql://postgres.${ref}:${encoded}@aws-${poolerIndex}-${region}.pooler.supabase.com:5432/postgres`;
}

/** @deprecated 請改用 buildSupabaseDbUrlAsync */
export function buildSupabaseDbUrl(supabaseUrl, dbPassword) {
  const ref = getSupabaseProjectRef(supabaseUrl);
  const encoded = encodeURIComponent(dbPassword);
  const region = process.env.SUPABASE_DB_POOLER_REGION ?? "ap-southeast-1";
  const poolerIndex = process.env.SUPABASE_DB_POOLER_INDEX ?? "1";
  return `postgresql://postgres.${ref}:${encoded}@aws-${poolerIndex}-${region}.pooler.supabase.com:5432/postgres`;
}
