# 藏珍閣安全審計報告

> 審計日期：2026-08-19  
> 背景：姊妹專案 Mada Graphite UAT 遭自動化探測，利用 `handle_new_user()` 信任 `user_metadata.role` 取得 `super_admin`。本報告為 cangzhen-gallery 全面檢查與硬化結果。

---

## Executive Summary

| 項目 | 結論 |
|---|---|
| Graphite 同款 metadata 提權 | **不存在** — `handle_new_user()` 寫死 `role = 'guest'` |
| 本專案 P0 | **已修** — `promote_to_admin` 公開 RPC 可被 anon/authenticated 濫用 |
| 本專案 P1 | **已修** — 使用者可自改 `profiles.role` / `is_banned` |
| 額外發現 | **已修** — 私訊 `sender_role` 偽造、禁言繞過私訊、conversation 未讀計數篡改 |
| 部署狀態 | 見下方「驗證證據」章節 |

---

## 發現清單

| ID | 嚴重度 | 狀態 | 位置 | 攻擊路徑 / 影響 | 修復 |
|---|---|---|---|---|---|
| P0 | Critical | 🔧 已修 | `0002` `promote_to_admin` | PostgREST `/rest/v1/rpc/promote_to_admin` → 任意 email 升 admin | `0006` REVOKE EXECUTE |
| P1 | Critical | 🔧 已修 | `0001` `profiles update own` | `PATCH profiles SET role='admin'` | `0006` trigger `protect_profile_privileged_columns` |
| P1a | High | 🔧 已修 | 同上 | 自改 `is_banned` / `banned_reason` 解禁 | 同上 trigger |
| P1b | High | 🔧 已修 | `messages` | 客戶端寫 `sender_role=admin` 偽裝藏家 | `0006` trigger `enforce_message_sender` |
| P2 | Medium | 🔧 已修 | comments/messages | 禁言只擋留言，仍可私訊 | RLS + trigger 雙重檢查 |
| P2b | Medium | 🔧 已修 | `conversations` | 訪客改 `unread_for_admin` 干擾後台徽章 | `0006` trigger（`pg_trigger_depth()>1` 放行 `handle_new_message`） |
| P2c | Medium | 🔧 已修 | `comments` update | 使用者可 update 自己留言 | 僅 admin 可 update |
| A1 | — | ✅ 安全 | `handle_new_user` | metadata.role 不被讀取 | 無需變更 |
| D1 | — | ✅ 安全 | `/api/upload` 等 | 皆有 `requireAdmin()` | 上傳加 UUID 驗證 |
| D2 | — | ✅ 安全 | `/api/cron/keep-alive` | `CRON_SECRET` Bearer 驗證 | 無需變更 |
| F1 | — | ✅ 安全 | `env.ts` / `admin.ts` | service role 非 NEXT_PUBLIC | 無需變更 |
| G1 | — | ⚠️ 殘餘 | 公開 signup | bot 可大量註冊 | 建議 Dashboard 開 Email 確認 |
| G2 | — | ⚠️ 殘餘 | AI / 留言 / 私訊 | 無 rate limit / CAPTCHA | 單管理員站可接受 |
| G3 | — | ⚠️ 殘餘 | Storage `items` | public bucket，知 path 可讀 draft 圖 | 架構取捨，未改 |

---

## 與 Graphite 漏洞對照

| 項目 | Mada Graphite（遭攻） | cangzhen-gallery |
|---|---|---|
| `handle_new_user` 讀 metadata.role | 是 → `super_admin` | **否，寫死 `guest`** ✅ |
| 未驗證 email 即有特權 | 是 | 否（guest，無後台） ✅ |
| 公開 RPC 升權 | 無此函式 | **`promote_to_admin` P0** → 🔧 已 REVOKE |
| 自改 `profiles.role` | 035 migration 修復 | P1 → 🔧 trigger 已加 |
| OAuth metadata 影響 role | 是 | 僅 display_name / avatar ✅ |

---

## 審計清單（A–G）

### A. Auth & 註冊

| 檢查項 | 結果 |
|---|---|
| `handle_new_user` 不信任 metadata.role | ✅ |
| signUp / OAuth 不傳特權欄位 | ✅（僅 `display_name`） |
| 未驗證 email 能否登入 | ⚠️ 依 Supabase Dashboard「Confirm email」設定 |
| OAuth metadata 濫用 role | ✅ 無影響 |

### B. 權限升級

| 檢查項 | 結果 |
|---|---|
| profiles RLS | 🔧 trigger 補強特權欄位 |
| SECURITY DEFINER 公開 RPC | 🔧 promote_to_admin 已 REVOKE |
| Server Actions requireAdmin | ✅ 四個 admin actions + comments |
| client 直接改 role | 🔧 已擋 |

### C. RLS 全表

| 表 | anon | guest | admin |
|---|---|---|---|
| profiles | 無 | 讀寫自己（特權欄位 trigger 擋） | 全權 |
| categories | 讀 | 讀 | 寫 |
| items | 讀 published | 讀 published | 全權 |
| item_images | 讀 published | 讀 published | 全權 |
| comments | 讀 visible | insert；update 僅 admin | 全權 |
| conversations | 無 | 讀寫自己（欄位 trigger 限縮） | 全權 |
| messages | 無 | 讀寫參與對話（sender_role DB 覆寫） | 全權 |
| settings | 讀 | 讀 | 寫 |
| storage.items | 讀 | 讀 | 寫 |

### D. API & Server

| 端點 | 結果 |
|---|---|
| `/api/upload` | ✅ requireAdmin + UUID item_id |
| `/api/upload/line-qr` | ✅ requireAdmin + 類型/大小限制 |
| `/api/ai/describe` | ✅ requireAdmin |
| `/api/cron/keep-alive` | ✅ CRON_SECRET |

### E. 前端 & 路由

| 檢查項 | 結果 |
|---|---|
| `admin/layout.tsx` | ✅ role !== admin 顯示無權限 |
| 非 admin 打 Server Action | ✅ requireAdmin 回未授權 |
| CSRF | ✅ Supabase cookie session（SameSite） |

### F. Secrets

| 檢查項 | 結果 |
|---|---|
| `.env.example` 無真實 secret | ✅ |
| client import server-only | ✅ admin.ts 僅 server |
| anon key 暴露 | ✅ 可接受（RLS 正確時） |

### G. 濫用防護

| 檢查項 | 結果 |
|---|---|
| 公開 signup | ⚠️ 開放（功能需要） |
| rate limit / CAPTCHA | ⚠️ 無 |
| is_banned 全路徑 | 🔧 留言 + 私訊 + conversation insert |

---

## 修復內容

### Migration

- [`supabase/migrations/0006_security_hardening.sql`](../supabase/migrations/0006_security_hardening.sql)
- [`supabase/migrations/0007_security_rpc_lockdown.sql`](../supabase/migrations/0007_security_rpc_lockdown.sql)

### 應用層

- [`src/app/api/upload/route.ts`](../src/app/api/upload/route.ts) — `item_id` UUID 驗證

### 腳本

- `npm run db:apply-security` — 略過版本衝突，直接套用 0006/0007
- `npm run security:proof` — anon key 實測升權路徑

### 文件

- 本報告、[`README.md`](../README.md) admin 設定、`AGENTS.md`、`.cursor/rules/database-schema.mdc`

---

## 管理員設定方式（0006 之後）

**禁止**從瀏覽器或 anon key 呼叫 `promote_to_admin`。

1. 父親先在 `/login` 註冊（Email / Google / LINE）。
2. 在 Supabase Dashboard → **SQL Editor**（以 postgres 身份）執行：
   ```sql
   select public.promote_to_admin('your_dad_email@example.com');
   ```
3. 或：Table Editor → `profiles` → 將該使用者 `role` 改為 `admin`。

若 `npm run db:apply` 因 `0003` 版本衝突失敗，改跑 `npm run db:apply-security`。

---

## 驗證證據

### 套用 migration

```bash
npm run db:apply-security
```

### 自動化 proof（anon key）

```bash
npm run security:proof
```

預期輸出（0006/0007 套用後）：

- `[PASS] RPC 已被拒絕`
- `[PASS] 自改 role 失敗`
- `[PASS] 訪客正常私訊成功`
- `[PASS] sender_role 已由 DB 覆寫為 guest`（或 insert 被拒）
- `[PASS] 篡改未讀數被拒`

### Build

```bash
npm run build
```

---

## 執行紀錄

| 命令 | 結果 |
|---|---|
| `node scripts/apply-security-migrations.mjs` | exit 0（0006 + 0007 已套用遠端） |
| `npm run security:proof` | **5/5 通過** |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 1（既有 `line-qr-manager.tsx` react-hooks 警告，非本次引入） |
| `npm run build` | exit 0 |

### proof 腳本輸出摘要（0006/0007 套用後）

```
[PASS] RPC 已被拒絕（HTTP 401）：permission denied for function promote_to_admin
[PASS] 自改 role 失敗（HTTP 400），目前 role=guest
[PASS] 訪客正常私訊成功，sender_role=guest
[PASS] sender_role 已由 DB 覆寫為 guest
[PASS] 篡改未讀數被拒（HTTP 400）
=== 完成：5/5 通過 ===
```

驗證前若測試帳號曾被 RPC 升權，請先執行 `node scripts/reset-test-user-role.mjs`。

### db:apply 備註

- 修正 Windows 下 `execSync("npx", [...])` 未真正執行的 bug（改為 `shell: true` 單行命令）。
- 連線改走 Session pooler：`aws-1-{region}.pooler.supabase.com`（見 `scripts/lib/load-dotenv.mjs`）。
- 完整 `db push` 因兩個 `0003_*.sql` 版本號衝突可能中斷；安全硬化請用 `apply-security-migrations.mjs`。

---

## 殘餘風險建議（未實作）

1. Supabase Dashboard → Authentication → 開啟 **Confirm email**（正式站）。
2. 考慮 Supabase Auth rate limiting 或 Cloudflare Turnstile（若遭 bot 刷爆）。
3. AI route 可加 per-admin 每日配額（POE 費用控管）。
4. Draft 藏品圖片若需保密，需改 Storage 為 signed URL（會增加複雜度）。
