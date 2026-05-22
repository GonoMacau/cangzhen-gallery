# LINE 登入設定指南

> 解決「Error getting user profile from external provider」錯誤。

## 為什麼會出錯？

前端使用 `supabase.auth.signInWithOAuth({ provider: "custom:line" })` 觸發
LINE 登入，整段流程如下：

```
1. 瀏覽器 → access.line.me（使用者登入＋同意授權）
2. LINE → <SUPABASE_URL>/auth/v1/callback（帶 authorization code）
3. Supabase 用 code 換 token、再呼叫 LINE userinfo 取得使用者資料
4. Supabase → <SITE_URL>/auth/callback（種好 session 後返回）
```

第 3 步失敗時，Supabase 會帶以下 query string 返回：

```
?error=server_error
&error_code=unexpected_failure
&error_description=Error+getting+user+profile+from+external+provider
```

### 根本原因

LINE Web 登入回傳的 **ID Token 使用 HS256 對稱簽章**（用 channel secret 簽），
而 Supabase 的 **Custom OIDC Provider 只支援 ES256 / RS256 等非對稱演算法**，
所以若把 `custom:line` 設為 **OIDC** 類型，Supabase 在驗證 ID Token 時就會 500。

**解法**：把 `custom:line` 重設為 **OAuth2** 類型（不走 OIDC ID Token 驗證，
改用 LINE 的 userinfo 端點抓使用者資料），並開啟 `email_optional`
（LINE 帳號不見得有綁 Email）。

---

## 步驟 1：在 LINE Developers Console 取得 Channel

1. 進入 <https://developers.line.biz/console/>
2. 建立（或選擇現有的）Provider → 在其底下建立 **LINE Login channel**
3. 進到 channel 的 **LINE Login 分頁**：
   - **Callback URL** 填：
     ```
     <SUPABASE_URL>/auth/v1/callback
     ```
     （`<SUPABASE_URL>` 即 `NEXT_PUBLIC_SUPABASE_URL` 的值，例如
     `https://xxxxxxxx.supabase.co`）
   - **OpenID Connect** → 勾選啟用
   - **Email address permission** → 申請啟用（若要拿到 Email；申請通過後
     scope 內加入 `email`）
4. 進到 channel 的 **Basic settings 分頁**：
   - 抄下 **Channel ID** 與 **Channel secret**

---

## 步驟 2：在 Supabase 建立 / 重建 Custom OAuth Provider

> 若之前已建過名為 `custom:line` 的 provider，**請先刪除**再重新建立，
> 因為 provider 類型（OIDC ↔ OAuth2）建立後無法直接切換。

### 方法 A：透過 Supabase Dashboard（推薦）

1. Supabase Dashboard → **Authentication → Sign In / Providers**
2. 捲到 **Custom Providers** 區塊 → 點 **New Provider**
3. **Configuration method** 選 **Manual configuration**
4. 依下表填寫：

   | 欄位 | 值 |
   |---|---|
   | Provider type | **OAuth2**（不是 OIDC！） |
   | Identifier | `custom:line` |
   | Display name | `LINE` |
   | Client ID | LINE channel 的 **Channel ID** |
   | Client Secret | LINE channel 的 **Channel secret** |
   | Authorization URL | `https://access.line.me/oauth2/v2.1/authorize` |
   | Token URL | `https://api.line.me/oauth2/v2.1/token` |
   | UserInfo URL | `https://api.line.me/oauth2/v2.1/userinfo` |
   | Scopes | `openid profile`（若已申請通過 Email 權限可加 `email`）。**`openid` 必填**，因為 LINE 的 `oauth2/v2.1/userinfo` 是 OIDC userinfo 端點，沒有 `openid` access token 無權呼叫，會導致 `Error getting user profile from external provider` |
   | Allow users without email (`email_optional`) | **ON** |
   | PKCE | **ON**（與前端 `signInWithOAuth` 行為一致） |

5. 按 **Create** → 確認 provider 是 **Enabled** 狀態

### 方法 B：用 Auth Admin API（給有寫腳本需求的人）

專案內提供了 `scripts/setup-line-provider.mjs`，會用 service role key 呼叫
`/auth/v1/admin/custom-providers` 把 provider 建好或更新到正確設定：

```bash
LINE_CHANNEL_ID=<your-channel-id> \
LINE_CHANNEL_SECRET=<your-channel-secret> \
  node scripts/setup-line-provider.mjs
```

需要 `.env.local` 內已設定：

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

執行成功後到 Dashboard 確認 provider 狀態為 Enabled 即可。

---

## 步驟 3：Supabase Redirect URLs 補上前端網址

Supabase Dashboard → **Authentication → URL Configuration**：

- **Site URL**：本機填本地 dev server 網址，正式環境填你的網域
- **Additional Redirect URLs** 加入本地與正式環境的 `/auth/callback` 路徑

---

## 步驟 4：驗證

1. 重啟 dev server（`npm run dev`）
2. 走 `/login` → 點「使用 LINE 帳號登入」
3. 完成 LINE 授權後應該回到首頁並登入成功
4. 失敗時前端會顯示繁中錯誤提示；同時可到
   Supabase Dashboard → **Logs → Auth Logs** 看詳細原因

---

## 常見錯誤對照

| 訊息 | 原因 | 解法 |
|---|---|---|
| `Error getting user profile from external provider` | (a) provider 設為 OIDC，ID Token HS256 無法驗證；(b) scope 沒帶 `openid`，access token 無權打 `oauth2/v2.1/userinfo`；(c) Email scope 要求但 LINE 沒回傳 | 改 OAuth2 類型 + scopes 含 `openid profile` + 開 `email_optional` |
| `redirect_uri does not match` | LINE channel 沒設正確 callback URL | 加入 `<SUPABASE_URL>/auth/v1/callback` |
| `invalid_client` | Channel ID / Secret 錯誤 | 重新從 LINE Console 複製 |
| `provider is not enabled` | Supabase 那邊還沒按 Enable | 進 Dashboard 啟用 |

---

## 參考資料

- [Supabase Custom OAuth/OIDC Providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [LINE Login v2.1 API reference](https://developers.line.biz/en/reference/line-login/)
- 中文踩雷紀錄：<https://zenn.dev/sasatech/articles/02b8fb72b45cdd>
