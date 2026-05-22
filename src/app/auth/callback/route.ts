import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", errorDescription || error);
    if (errorCode) loginUrl.searchParams.set("error_code", errorCode);
    return NextResponse.redirect(loginUrl.toString());
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", sessionError.message);
      return NextResponse.redirect(loginUrl.toString());
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
