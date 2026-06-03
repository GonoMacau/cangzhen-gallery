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

export function buildSupabaseDbUrl(supabaseUrl, dbPassword) {
  const ref = getSupabaseProjectRef(supabaseUrl);
  const encoded = encodeURIComponent(dbPassword);
  return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
}
