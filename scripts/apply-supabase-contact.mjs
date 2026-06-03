#!/usr/bin/env node
/**
 * 對遠端 Supabase 套用關於頁聯絡設定種子，並確認 Storage bucket。
 *
 * 用法：node scripts/apply-supabase-contact.mjs
 * 讀取 .env.local：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./lib/load-dotenv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadProjectEnv(resolve(__dirname, ".."));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error(`[apply-supabase-contact] ${msg}`);
  process.exit(1);
}

if (!url) fail("缺少 NEXT_PUBLIC_SUPABASE_URL");
if (!serviceKey) fail("缺少 SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SETTINGS_KEYS = [
  { key: "contact_address", value: "" },
  { key: "contact_line_qr_url", value: "" },
];

async function main() {
  console.log("[apply-supabase-contact] 目標專案：", url);

  const { data: existing, error: readErr } = await supabase
    .from("settings")
    .select("key")
    .in("key", SETTINGS_KEYS.map((s) => s.key));
  if (readErr) fail(`讀取 settings 失敗：${readErr.message}`);

  const have = new Set((existing ?? []).map((r) => r.key));
  const toInsert = SETTINGS_KEYS.filter((s) => !have.has(s.key));

  if (toInsert.length === 0) {
    console.log("[apply-supabase-contact] settings 種子已存在，略過插入");
  } else {
    const { error: insertErr } = await supabase.from("settings").insert(
      toInsert.map((s) => ({
        key: s.key,
        value: s.value,
        updated_at: new Date().toISOString(),
      })),
    );
    if (insertErr) fail(`插入 settings 失敗：${insertErr.message}`);
    console.log("[apply-supabase-contact] 已新增 settings：", toInsert.map((s) => s.key).join(", "));
  }

  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) fail(`列出 Storage bucket 失敗：${bucketErr.message}`);

  const names = (buckets ?? []).map((b) => b.id);
  console.log("[apply-supabase-contact] Storage buckets：", names.join(", ") || "(無)");

  if (!names.includes("items")) {
    fail('缺少 "items" bucket，請在 Supabase Dashboard 執行 migrations/0001_init.sql');
  }

  console.log("[apply-supabase-contact] LINE QR 使用 items/site/line-qr.*（無需 site-assets）");

  const { data: final, error: finalErr } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", SETTINGS_KEYS.map((s) => s.key));
  if (finalErr) fail(`確認 settings 失敗：${finalErr.message}`);
  for (const row of final ?? []) {
    console.log(`[apply-supabase-contact]   ${row.key}: ${JSON.stringify(row.value)}`);
  }

  console.log("[apply-supabase-contact] 完成");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
