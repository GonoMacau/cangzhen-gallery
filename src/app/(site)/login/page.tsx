import { Suspense } from "react";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "@/components/site/login-form";

export const metadata = { title: "登入 / 註冊" };

export default function LoginPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="text-center mb-8">
        <Logo size="md" />
      </div>
      <div className="rounded-lg border bg-card p-8 shadow-sm space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-2xl">登入藏珍閣</h1>
          <p className="text-sm text-muted-foreground">
            登入後可留言、與藏家私訊。可使用 Google、LINE 或 Email 註冊／登入。
          </p>
        </div>
        <Suspense fallback={<div className="text-sm text-muted-foreground">載入中…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
