import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { env, requireSupabaseEnv } from "@/lib/env";
import { TEST_CLIENT_ACCOUNT } from "@/lib/test-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron 定期喚醒 Supabase（Auth + Postgres），避免免費專案因逾 7 日未使用而暫停。
 * 僅接受帶 CRON_SECRET 的 Authorization: Bearer 請求（Vercel Cron 會自動附加）。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET 未設定" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    requireSupabaseEnv();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Supabase 環境變數未設定";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_CLIENT_ACCOUNT.email,
    password: TEST_CLIENT_ACCOUNT.password,
  });
  if (authError) {
    return NextResponse.json(
      { error: `測試帳號登入失敗：${authError.message}` },
      { status: 500 },
    );
  }

  const { error: dbError } = await supabase.from("settings").select("key").limit(1);
  if (dbError) {
    return NextResponse.json(
      { error: `資料庫查詢失敗：${dbError.message}` },
      { status: 500 },
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({
    ok: true,
    userId: authData.user?.id ?? null,
    at: new Date().toISOString(),
  });
}
