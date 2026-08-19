#!/usr/bin/env node
/**
 * 直接執行 0006 / 0007 安全 migration（略過 schema_migrations 版本衝突）
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadProjectEnv, buildSupabaseDbUrlAsync } from "./lib/load-dotenv.mjs";

const root = loadProjectEnv(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const dbUrl = await buildSupabaseDbUrlAsync(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PASSWORD,
);

const files = [
  "supabase/migrations/0006_security_hardening.sql",
  "supabase/migrations/0007_security_rpc_lockdown.sql",
];

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

try {
  for (const file of files) {
    const sql = readFileSync(resolve(root, file), "utf8");
    console.log(`[security-apply] 執行 ${file} …`);
    await client.query(sql);
    console.log(`[security-apply] ${file} 完成`);
  }
} finally {
  await client.end();
}

console.log("[security-apply] 全部完成");
