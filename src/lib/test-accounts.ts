/**
 * 共用測試帳號（無隱私資料，供 E2E / cron keep-alive / 手動驗證）。
 * 正式環境請在 Supabase 已註冊此 Email 帳號；角色為 guest 即可。
 */
export const TEST_CLIENT_ACCOUNT = {
  email: "eric.chang.1015+tester@gmail.com",
  password: "a1234567",
  displayName: "測試訪客",
} as const;
