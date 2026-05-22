#!/usr/bin/env node
/**
 * 一鍵在 Supabase 建立 / 更新 LINE Custom OAuth Provider（OAuth2 類型）
 *
 * 用法：
 *   LINE_CHANNEL_ID=xxxx \
 *   LINE_CHANNEL_SECRET=xxxx \
 *   node scripts/setup-line-provider.mjs
 *
 * 會自動從 .env.local 讀取：
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * 注意：請勿把 service role key 提交到 git。
 *
 * 為何選 OAuth2 而非 OIDC：
 *   LINE Web 登入的 ID Token 簽章演算法是 HS256，
 *   而 Supabase Custom OIDC Provider 只支援 ES256/RS256，
 *   走 OIDC 會 500 (Error getting user profile from external provider)。
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
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

loadDotEnv(resolve(projectRoot, ".env.local"));
loadDotEnv(resolve(projectRoot, ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const IDENTIFIER = "custom:line";

function fail(msg) {
  console.error(`[setup-line-provider] ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("缺少 NEXT_PUBLIC_SUPABASE_URL（請設於 .env.local）");
if (!SERVICE_ROLE_KEY) fail("缺少 SUPABASE_SERVICE_ROLE_KEY（請設於 .env.local）");
if (!LINE_CHANNEL_ID) fail("缺少 LINE_CHANNEL_ID 環境變數");
if (!LINE_CHANNEL_SECRET) fail("缺少 LINE_CHANNEL_SECRET 環境變數");

const BASE = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/custom-providers`;
const HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const providerPayload = {
  provider_type: "oauth2",
  identifier: IDENTIFIER,
  name: "LINE",
  client_id: LINE_CHANNEL_ID,
  client_secret: LINE_CHANNEL_SECRET,
  authorization_url: "https://access.line.me/oauth2/v2.1/authorize",
  token_url: "https://api.line.me/oauth2/v2.1/token",
  userinfo_url: "https://api.line.me/oauth2/v2.1/userinfo",
  // LINE 的 /oauth2/v2.1/userinfo 是 OIDC userinfo 端點，必須帶 `openid` scope 才能存取，
  // 沒有 openid 會在 callback 階段拿到 "Error getting user profile from external provider"。
  // 即使是 OAuth2（非 OIDC）provider type，Supabase 不會去驗 ID Token 簽章，只用 access token
  // 呼叫 userinfo_url，所以加上 openid 並不會觸發 HS256 簽章驗證問題。
  scopes: ["openid", "profile"],
  email_optional: true,
  enabled: true,
  pkce_enabled: true,
};

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

// Supabase 期待 URL path 內的 identifier 保留字面字串（含冒號），
// 不能用 encodeURIComponent（會把 ':' 變成 '%3A' 導致 validation_failed）。
// 因為 identifier 規格為 `custom:` + [a-z0-9-]+，沒有需要 percent-encode 的字元，
// 直接拼字串即可。
const ITEM_URL = `${BASE}/${IDENTIFIER}`;

async function main() {
  console.log(`[setup-line-provider] 目標：${SUPABASE_URL}`);
  console.log(`[setup-line-provider] 檢查 ${IDENTIFIER} 是否存在…`);

  const get = await request("GET", ITEM_URL);

  if (get.status === 404) {
    console.log("[setup-line-provider] 未發現 → 執行建立");
    const created = await request("POST", BASE, providerPayload);
    if (!created.ok) {
      fail(`建立失敗 (HTTP ${created.status})：${JSON.stringify(created.data)}`);
    }
    console.log("[setup-line-provider] ✅ 建立成功");
    return;
  }

  if (!get.ok) {
    fail(`查詢失敗 (HTTP ${get.status})：${JSON.stringify(get.data)}`);
  }

  console.log("[setup-line-provider] 已存在 → 執行更新");
  const updated = await request("PUT", ITEM_URL, providerPayload);
  if (!updated.ok) {
    fail(`更新失敗 (HTTP ${updated.status})：${JSON.stringify(updated.data)}`);
  }
  console.log("[setup-line-provider] ✅ 更新成功");
}

main().catch((err) => {
  console.error("[setup-line-provider] 非預期錯誤：", err);
  process.exit(1);
});
