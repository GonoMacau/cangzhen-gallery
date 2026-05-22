"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#06C755"
        d="M12 2C6.48 2 2 5.82 2 10.5c0 4.21 3.74 7.74 8.79 8.4.34.07.81.23.93.52.1.27.07.68.03.95l-.15.91c-.05.27-.21 1.07.94.58 1.15-.48 6.2-3.65 8.46-6.25C22.88 13.52 22 12.07 22 10.5 22 5.82 17.52 2 12 2zm-3.19 11.3H6.73a.53.53 0 0 1-.53-.53V8.53c0-.3.24-.53.53-.53.3 0 .53.24.53.53v3.72h1.55c.3 0 .53.24.53.53 0 .3-.24.53-.53.53zm1.84-.53a.53.53 0 0 1-1.06 0V8.53a.53.53 0 0 1 1.06 0v4.24zm4.56 0c0 .22-.13.41-.33.49a.53.53 0 0 1-.58-.11l-2.12-2.89v2.51a.53.53 0 0 1-1.06 0V8.53c0-.22.13-.41.33-.49a.53.53 0 0 1 .58.11l2.12 2.89V8.53a.53.53 0 0 1 1.06 0v4.24zm3.06-2.67a.53.53 0 0 1 0 1.06H16.9v1.08h1.37a.53.53 0 0 1 0 1.06H16.37a.53.53 0 0 1-.53-.53V8.53c0-.3.24-.53.53-.53h1.9a.53.53 0 0 1 0 1.06H16.9v1.04h1.37z"
      />
    </svg>
  );
}

type Mode = "signin" | "signup";

function translateAuthError(error: string | null, errorCode: string | null): string | null {
  if (!error && !errorCode) return null;
  const raw = error ?? errorCode ?? "";
  const lower = raw.toLowerCase();

  if (lower.includes("error getting user profile from external provider")) {
    return "外部登入失敗：無法取得 LINE 帳號資料。請聯絡網站管理員，確認 Supabase 內的 LINE Provider 已設為「OAuth2」類型並啟用「Allow users without email」。";
  }
  if (lower.includes("user already registered")) {
    return "此 Email 已註冊過，請改用登入。";
  }
  if (lower.includes("invalid login credentials")) {
    return "帳號或密碼錯誤，請重新確認。";
  }
  if (lower.includes("email not confirmed")) {
    return "Email 尚未驗證，請至信箱完成驗證後再登入。";
  }
  if (lower.includes("provider is not enabled")) {
    return "該登入方式尚未啟用，請聯絡網站管理員。";
  }
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const authError = translateAuthError(
    searchParams.get("error"),
    searchParams.get("error_code"),
  );
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      toast.error(`Google 登入失敗：${error.message}`);
      setGoogleLoading(false);
    }
  }

  async function handleLine() {
    setLineLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "custom:line" as "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      toast.error(`LINE 登入失敗：${error.message}`);
      setLineLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error(`登入失敗：${error.message}`);
        return;
      }
      toast.success("登入成功");
      router.push(redirectTo);
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split("@")[0] },
        },
      });
      setLoading(false);
      if (error) {
        toast.error(`註冊失敗：${error.message}`);
        return;
      }
      toast.success("註冊成功！若 Supabase 開啟 Email 驗證，請至信箱完成驗證後再登入。");
      setMode("signin");
    }
  }

  return (
    <div className="space-y-4">
      {authError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {authError}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <GoogleIcon />
        {googleLoading ? "跳轉中…" : "使用 Google 帳號登入"}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={handleLine}
        disabled={lineLoading}
      >
        <LineIcon />
        {lineLoading ? "跳轉中…" : "使用 LINE 帳號登入"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-background px-2">或使用 Email</span>
        </div>
      </div>

    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-1 rounded-md border p-1 bg-muted/30 text-sm">
        <button
          type="button"
          className={`flex-1 py-1.5 rounded ${mode === "signin" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          onClick={() => setMode("signin")}
        >
          登入
        </button>
        <button
          type="button"
          className={`flex-1 py-1.5 rounded ${mode === "signup" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
          onClick={() => setMode("signup")}
        >
          註冊
        </button>
      </div>

      {mode === "signup" && (
        <div className="space-y-2">
          <Label htmlFor="displayName">顯示名稱</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="您的名字"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密碼</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "處理中…" : mode === "signin" ? "登入" : "建立帳號"}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        登入即代表您同意藏珍閣使用您的 Email 提供站內訊息與留言服務。
      </p>
    </form>
    </div>
  );
}
