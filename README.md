# 藏珍閣 · 天王星名藝社


> 古玩藝品線上典藏網站。Next.js 16 + Supabase + POE AI。

## 功能總覽

### 公開區（任何訪客可瀏覽）
- 首頁精選藏品 + 分類入口
- 藏品總覽（搜尋、分類篩選、排序）
- 單品詳情頁（多圖瀏覽、SEO/OG 分享卡）
- 分類列表與分類詳情

### 會員區（登入後）
- 登入方式：**Google**、**LINE**、或 **Email** 註冊／登入
- 留言（即時、Supabase Realtime）
- 私訊藏家（訊息中心）

### 後台（管理員 admin）
- 儀表板（藏品/未讀訊息統計）
- 藏品 CRUD：含品名 / 分類 / 年代 / 材質 / 尺寸 / 重量 / 售價 / 草稿狀態
- 多張圖片上傳，自動以 `sharp` 壓縮為 webp + 縮圖（後台可調品質與尺寸）
- **AI 一鍵補述**：呼叫 POE AI（預設 `gpt-5.5`）依品名與藏家簡述產生詳細介紹
- 分類管理
- 訊息收件匣（即時）
- 使用者管理（角色調整、禁言）
- 站點設定（圖片壓縮、AI 模型、聯絡資訊、關於頁文字）

## 技術棧

- **Next.js 16 / React 19**（App Router、Server Actions）
- **TypeScript** 全程型別安全
- **Tailwind CSS v4** + 自製 shadcn 風格元件
- **Supabase**：Postgres、Auth、Storage、Realtime
- **sharp**：圖片壓縮（webp）
- **OpenAI SDK**：透過 `https://api.poe.com/v1` 呼叫 POE AI
- 部署目標：**Vercel Hobby**

## 一、首次啟動

### 1. 環境變數

複製 `.env.example` 為 `.env.local`：

```bash
cp .env.example .env.local
```

需填入：

| 變數 | 取得位置 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | 開發 `http://localhost:3000`，正式 `https://your-domain` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上（anon public；或改用新版 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`） |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上（service_role，**只能放 server**） |
| `POE_API_KEY` | https://poe.com/api_key |
| `POE_BASE_URL` | 預設 `https://api.poe.com/v1` 即可 |

### 2. Supabase 資料庫初始化

到 Supabase Dashboard → SQL Editor，依序貼上執行：

1. `supabase/migrations/0001_init.sql`（建表、RLS、Storage bucket、種子資料）
2. `supabase/migrations/0002_promote_admin_helper.sql`（建立提升 admin 用的 function）
3. `supabase/migrations/0003_user_ban.sql`（使用者禁言欄位與留言 policy）
4. `supabase/migrations/0004_profile_relations.sql`（PostgREST 關聯至 profiles）
5. `supabase/migrations/0005_oauth_metadata_fallback.sql`（LINE/Google OAuth 暱稱與頭像回填）

### 3. 將父親的帳號設定為管理員

1. 父親到網站 `/login` 用 **Email** 註冊一次（若使用 LINE/Google 登入且無 email，請改在 Supabase Dashboard 手動將該使用者的 `profiles.role` 設為 `admin`）。
2. 在 Supabase SQL Editor 執行：
   ```sql
   select public.promote_to_admin('your_dad_email@example.com');
   ```
3. 父親重新整理頁面，右上角會出現「後台」按鈕。

### 4. 本機啟動

```bash
npm install
npm run dev
```

打開 http://localhost:3000

## 二、部署到 Vercel

1. 將本專案推上 GitHub。
2. 進入 https://vercel.com/new 連結 GitHub repo。
3. 在 Vercel Project → Settings → Environment Variables 設定上述全部變數。
4. Deploy。
5. 部署完成後，進入 Supabase Dashboard → Authentication → URL Configuration，把 `Site URL` 設為您的正式網址，並把該網址加入 `Redirect URLs`。

### Supabase 定期喚醒（Vercel Cron）

免費版 Supabase 若超過約 7 日無 API 活動可能暫停專案。本專案已設定 **每日** cron 呼叫 `GET /api/cron/keep-alive`，以測試帳號登入並查詢資料庫，維持專案活躍。

1. 在 Vercel → Environment Variables 新增 **`CRON_SECRET`**（建議 32 字元以上隨機字串）。
2. 確認測試帳號已在網站註冊過一次（見下方「測試帳號」）。
3. 重新 Deploy 後，於 Vercel → Project → Cron Jobs 確認排程為每日 03:00 UTC。

排程定義於根目錄 `vercel.json`（Hobby 方案每日最多觸發一次，已符合需求）。

### 測試帳號（訪客 / cron）

| Email | 密碼 |
|---|---|
| `eric.chang.1015+tester@gmail.com` | `a1234567` |

用途：手動測試留言、私訊、cron 喚醒；**非管理員**。常數見 `src/lib/test-accounts.ts`。

### LINE 登入設定

LINE 登入需要在 Supabase 內建立 **Custom OAuth Provider**（型別必須為 `OAuth2` 而非 OIDC，
否則會出現「Error getting user profile from external provider」錯誤）。

詳細逐步設定請見：[docs/line-login-setup.md](./docs/line-login-setup.md)

或一鍵透過腳本建立：

```bash
LINE_CHANNEL_ID=xxxx LINE_CHANNEL_SECRET=xxxx \
  node scripts/setup-line-provider.mjs
```

## 三、日常維護

### 父親要新增一件藏品
1. 右上角頭像 → 進入後台
2. `藏品管理` → `新增藏品`
3. 填品名（最少必填）+ 自選分類、年代、材質、尺寸、簡述
4. 點「建立藏品」→ 跳到編輯頁
5. 拖拉上傳藏品照片（系統自動壓縮、第一張自動成為封面）
6. 點「AI 一鍵撰寫」→ POE AI 會自動產生 350~600 字的介紹
7. 視需要編輯潤飾；點「分類」「狀態」欄位（會展開網頁內選單，非系統原生滾輪）→ 狀態改為「公開展示」→ 儲存

### 調整圖片壓縮品質
- 後台 → 站點設定 → 圖片壓縮，可調主圖品質、長邊像素、縮圖長邊。

## 四、目錄結構

```
supabase/migrations/        Supabase SQL 腳本
src/
  app/
    (site)/                 公開頁面（含 layout）
    admin/                  後台頁面
    api/                    Route Handlers
      cron/keep-alive/      Vercel Cron 喚醒 Supabase
      ai/describe/          POE AI 補述
      upload/               圖片上傳壓縮
    auth/callback/          Supabase Auth callback
    sitemap.ts / robots.ts  SEO
  components/
    ui/                     shadcn 風格基礎元件
    site/                   公開頁面元件
    admin/                  後台元件
  lib/
    supabase/               browser/server/admin client + middleware
    poe.ts                  POE AI client
    image.ts                sharp 壓縮
    auth.ts                 取得 profile / requireAdmin
    settings.ts             讀取站點設定
    queries.ts              藏品/分類查詢 helper
    constants.ts            分類預設值與設定 schema
    utils.ts                cn / slugify / formatDate
  proxy.ts                  Next.js middleware（Supabase session refresh）
```

另見 `docs/line-login-setup.md` 與 `scripts/setup-line-provider.mjs`（LINE Custom OAuth2 Provider 設定）。

## 五、常見問題

- **AI 一直失敗？** 確認 `POE_API_KEY` 環境變數已設定，且 POE 帳號餘額充足。POE 模型名稱可在後台「站點設定 → AI 模型」更換。
- **圖片上傳 401？** 該操作會檢查您是否為 admin（`profiles.role = 'admin'`），請依「將父親的帳號設定為管理員」處理。
- **看不到自己 draft 中的藏品？** 公開頁面只顯示 published；admin 從 `/admin/items` 進入即可看到所有狀態。
- **手機（尤其部分 Android）點分類／狀態沒反應？** 編輯藏品頁已改用 Radix Select（按鈕式下拉，選單掛在 `body`），並移除後台 `overflow-x-hidden`、修正底部儲存列攔截觸控。請清除瀏覽器快取或強制重新整理後再試；若仍異常，請記下手機品牌、瀏覽器名稱（Chrome／三星瀏覽器／微信內建等）以便排查。
