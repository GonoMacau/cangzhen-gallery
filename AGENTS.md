# 藏珍閣 (Cangzhen Gallery) — AI Agent 速查指南

> 本檔案為 AI Agent 在「新 thread」時的入口文件。讀完此檔即可掌握 80% 專案資訊，
> 無需在 codebase 中盲目搜尋。任何不確定處，再依「快速定位表」精準讀檔。

---

## 1. 專案一句話定位

**藏珍閣 / 天王星名藝社** — 古玩藝品線上典藏網站。
父親（單一管理員）上架藏品、AI 自動補述、訪客可瀏覽 / 留言 / 私訊。

部署目標：**Vercel Hobby**（免費方案，注意 serverless 限制）。

---

## 2. 技術棧（鎖死，不要建議遷移）

| 項目 | 版本 / 工具 | 備註 |
|---|---|---|
| Framework | **Next.js 16** (App Router, Server Actions) | `next.config.ts` |
| React | **19.2** | RSC 為主、必要時才 `"use client"` |
| Language | **TypeScript** strict | path alias `@/* → src/*` |
| Style | **Tailwind CSS v4** + 自製 shadcn 風元件 | `src/components/ui/` |
| BaaS | **Supabase**（Postgres / Auth / Storage / Realtime）| `@supabase/ssr` |
| Image | **sharp** → webp | server only，已加入 `serverExternalPackages` |
| AI | **OpenAI SDK** 對接 `https://api.poe.com/v1`（POE）| 預設模型 `gpt-5.5` |
| Form / Validation | `react-hook-form` + `zod` | Server Action 也用 zod |
| Icon | `lucide-react` | |
| Toast | `sonner` | `<Toaster />` 已掛 root layout |
| Realtime | Supabase Realtime（comments、messages） | |

---

## 3. 目錄結構（精華版）

```
src/
├── proxy.ts                      ← Next.js middleware（更新 Supabase session）
├── app/
│   ├── layout.tsx                ← 根 layout、字型、Toaster、metadata
│   ├── globals.css               ← Tailwind v4 + 自訂主題色（古玩風）
│   ├── sitemap.ts / robots.ts    ← SEO
│   ├── (site)/                   ← 公開頁面 group（含 SiteHeader/Footer layout）
│   │   ├── page.tsx              ← 首頁（精選藏品 + 分類）
│   │   ├── items/                ← 藏品列表 + 詳情頁
│   │   ├── categories/           ← 分類頁
│   │   ├── login/                ← 登入頁
│   │   ├── messages/             ← 訪客訊息中心
│   │   └── about/                ← 關於頁
│   ├── admin/                    ← 後台（layout 內守門 requireAdmin）
│   │   ├── page.tsx              ← 儀表板
│   │   ├── items/                ← 藏品 CRUD（actions.ts 為 Server Actions）
│   │   ├── categories/           ← 分類管理
│   │   ├── messages/             ← 收件匣
│   │   ├── users/                ← 使用者 / 禁言管理
│   │   └── settings/             ← 站點設定（圖片品質、AI 模型、聯絡資訊）
│   ├── api/
│   │   ├── ai/describe/          ← POE AI 補述（POST，admin only）
│   │   └── upload/               ← 圖片上傳壓縮（POST，admin only）
│   └── auth/callback/            ← Supabase Auth OAuth callback
├── components/
│   ├── ui/                       ← shadcn 風基礎元件（button、dialog…）
│   ├── site/                     ← 公開頁專用元件（chat-room、comment-section…）
│   └── admin/                    ← 後台專用元件（item-form、image-manager…）
├── lib/
│   ├── env.ts                    ← 環境變數集中讀取（⚠️ 見 §6 陷阱）
│   ├── auth.ts                   ← getCurrentUser / getCurrentProfile / requireAdmin
│   ├── constants.ts              ← SITE / DEFAULT_CATEGORIES / DEFAULT_SETTINGS
│   ├── queries.ts                ← items / categories 讀取 helper
│   ├── settings.ts               ← 讀取 settings 表（圖片壓縮、AI 模型…）
│   ├── poe.ts                    ← POE AI client + prompt 組裝
│   ├── image.ts                  ← sharp 壓縮 / 縮圖
│   ├── utils.ts                  ← cn / formatDate / slugify / truncate
│   ├── actions/comments.ts       ← 留言 Server Actions
│   └── supabase/
│       ├── client.ts             ← Browser client（"use client"）
│       ├── server.ts             ← Server client（RSC / Action / Route Handler）
│       ├── admin.ts              ← Service role client（繞過 RLS，僅 server）
│       └── middleware.ts         ← session refresh（被 src/proxy.ts 呼叫）
└── types/database.ts             ← 全部資料表 TS 型別（Profile / Item / ...）

supabase/migrations/
├── 0001_init.sql                 ← 全 schema、RLS、Storage bucket、種子資料
├── 0002_promote_admin_helper.sql ← promote_to_admin(email) function
└── 0003_user_ban.sql             ← profiles.is_banned 欄位 + 留言 policy 更新
```

---

## 4. 資料模型（重點欄位）

| Table | 用途 | 重點 |
|---|---|---|
| `profiles` | 使用者資料 | `role: 'admin' \| 'guest'`、`is_banned` |
| `categories` | 分類 | `slug` unique、`sort_order` |
| `items` | 藏品 | `status: draft\|published\|reserved\|sold`、`cover_image_url` |
| `item_images` | 藏品多圖 | `sort_order`、`storage_path`（用於刪 storage） |
| `comments` | 留言 | `status: visible\|hidden`、被禁言不能 insert |
| `conversations` | 訪客 ↔ admin 對話 | 每位 guest 唯一一個（`unique(guest_id)`） |
| `messages` | 對話訊息 | trigger 自動更新 `last_message_at` 與未讀數 |
| `settings` | KV 設定 | 公開可讀、僅 admin 可寫 |

**Enums**：`user_role`、`item_status`、`comment_status` — 對應於 `src/types/database.ts`。

**RLS 心法**（請務必遵守，新增 table 也要照做）：
- 公開資料（categories、settings、published items / images）→ `select using (true)` 或附條件公開
- 寫入 → 一律 `using (public.is_admin(auth.uid()))`
- 使用者私有（comments insert / conversations / messages）→ 比對 `auth.uid()`

---

## 5. 三種 Supabase Client 使用時機（必背）

| Client | 檔案 | 何時使用 | 注意 |
|---|---|---|---|
| **Browser** | `lib/supabase/client.ts` | `"use client"` 元件、Realtime 訂閱 | 受 RLS 限制 |
| **Server** | `lib/supabase/server.ts` | RSC、Server Action、Route Handler（一般情境） | 帶 user cookie、受 RLS 限制 |
| **Admin** | `lib/supabase/admin.ts` | 必須繞過 RLS 的 server 操作（如刪除 storage 檔） | **絕不可** import 進 `"use client"` |

**驗權慣例**：所有 admin 操作（Server Action / Route Handler）開頭一定先：
```ts
const admin = await requireAdmin();
if (!admin) return { ok: false, message: "未授權" };
// 或 NextResponse.json({ error: "未授權" }, { status: 401 })
```

---

## 6. ⚠️ 已知陷阱 / 重要慣例

1. **環境變數一定用直接屬性存取**（見 `lib/env.ts` 註解）：
   - ✅ `process.env.NEXT_PUBLIC_SUPABASE_URL`
   - ❌ `process.env[key]` — Turbopack 不會在 client bundle 替換
2. **Next.js middleware 寫在 `src/proxy.ts`**（不是 `middleware.ts`），透過 `export const config.matcher` 套用範圍。修改時不要重複命名。
3. **圖片上傳走 `/api/upload`**，不要直接在前端用 anon key 上傳。route 內：
   - 先 `requireAdmin()` 檢查
   - 用 `sharp` 壓 main + thumb webp
   - 用 **service role** 寫入 storage（bucket: `items`）
   - 用 **server client** 寫入 `item_images` 並自動補 `cover_image_url`
4. **AI 補述走 `/api/ai/describe`**，模型名讀自 `settings.ai_model`，圖片最多帶 4 張（vision 模式）。
5. **slug 生成**：`slugify(title)` 會去除非 ASCII 並補 6 碼隨機字串；中文標題的舊 slug 在更新時會被自動重產（見 `admin/items/actions.ts`）。
6. **revalidatePath 慣例**：每個寫入 Server Action 後務必 `revalidatePath`：
   - 藏品 → `/admin/items`、`/items`、`/`、`/items/${slug}`
   - 留言 → `/items/${slug}`
   - 使用者 → `/admin/users`
7. **Realtime**：留言 / 訊息以 `supabase.channel(...)` 訂閱 `postgres_changes`；元件 unmount 時 `supabase.removeChannel(channel)` 必須清理。
8. **`export const dynamic = "force-dynamic"`** 已用於 `(site)/layout.tsx` 與 `admin/layout.tsx`，避免快取使用者 cookie 內容。
9. **不要新增 ORM**（無 Prisma/Drizzle）。所有查詢直接走 `@supabase/supabase-js` query builder。
10. **不要把 `SUPABASE_SERVICE_ROLE_KEY` 或 `POE_API_KEY` 放在 `NEXT_PUBLIC_*`**。

---

## 7. 常見任務的快速定位表

| 我想做… | 直接看這裡 |
|---|---|
| 新增一個前台頁面 | `src/app/(site)/<route>/page.tsx`（已自動套 SiteHeader/Footer） |
| 新增一個後台頁面 | `src/app/admin/<route>/page.tsx`（layout 已守門 admin） |
| 新增一個 Server Action | 同目錄建 `actions.ts`，第一行 `"use server"`，務必 `requireAdmin()` + `revalidatePath()` |
| 新增 / 修改資料表 | 在 `supabase/migrations/` 新增 `000X_*.sql`，**同步更新** `src/types/database.ts` |
| 新增 RLS 規則 | 在新 migration 內 `enable row level security` + `create policy`，公開或 `is_admin()` 二選一 |
| 改 AI prompt | `src/lib/poe.ts` 的 `buildAiPrompt` |
| 改 AI 模型 | 後台 → 站點設定 → AI 模型；或改 `DEFAULT_SETTINGS.ai_model` |
| 改圖片壓縮 | 後台 → 站點設定；或改 `DEFAULT_SETTINGS.image_*` |
| 增加聯絡 / 關於頁文字 | 後台 → 站點設定 → 聯絡資訊 / about_html |
| 新增藝品分類 | 後台 → 分類管理；或編輯 `DEFAULT_CATEGORIES` 並 reseed |
| 新增 UI 基礎元件 | `src/components/ui/<name>.tsx`（仿其他檔案的 cva 寫法） |
| 修改全域樣式 / 主題色 | `src/app/globals.css`（Tailwind v4 用 `@theme`） |

---

## 8. 開發指令

```bash
npm run dev        # next dev（Turbopack）
npm run build      # production build
npm run start      # 啟動 production server
npm run lint       # eslint（next-config）
npm run typecheck  # tsc --noEmit
```

部署：push 到 GitHub → Vercel 自動 build。**Vercel 環境變數務必設齊**（同 `.env.example`）。

---

## 9. 第一次接手前的必讀清單（共 7 個檔，照順序）

1. `README.md` — 使用者層面的功能與部署
2. `AGENTS.md`（本檔）— Agent 速查
3. `src/lib/env.ts` — 環境變數陷阱
4. `src/lib/auth.ts` + `src/lib/supabase/{client,server,admin}.ts` — 三種 client
5. `src/types/database.ts` — 資料模型
6. `supabase/migrations/0001_init.sql` — Schema + RLS（最關鍵的單一檔）
7. `src/app/admin/items/actions.ts` — Server Action 範本

讀完這 7 檔即可承接 95% 開發任務，其他細節再依「§7 快速定位表」按需查。

---

## Cursor Cloud specific instructions

### 環境需求

- **Node.js 18.18+**（VM 已預裝 v22）
- 套件管理器：`npm`（lockfile 為 `package-lock.json`）
- 更新腳本已設定 `npm install`，每次啟動會自動安裝依賴

### 啟動 Dev Server

```bash
npm run dev   # Next.js 16 + Turbopack，localhost:3000
```

### 必要環境變數（Secrets）

應用程式需要以下 secrets 才能正常提供頁面（不設時 dev server 仍會啟動，但所有頁面回傳 500）：

| Secret 名稱 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理員操作（上傳、刪除 storage） |
| `POE_API_KEY`（可選） | AI 補述功能 |

設定方式：在 `.env.local` 中填入，或透過 Cursor Cloud Agent Secrets 注入。

### 重要注意事項

- **沒有本地資料庫**：專案使用託管 Supabase（無 docker-compose、無 supabase CLI config），所有資料操作都依賴遠端 Supabase 實例。
- **沒有自動化測試框架**：`package.json` 中無 Jest / Vitest / Playwright，驗證方式為 `npm run lint` + `npm run typecheck` + 手動測試。
- **Build 驗證**：`npm run build` 可完整編譯所有路由，作為部署前的最終檢查。
- **Middleware 位置**：Next.js middleware 在 `src/proxy.ts`（非標準的 `middleware.ts`），不要重複建立。
