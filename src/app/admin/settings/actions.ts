"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

const SITE_ASSETS_BUCKET = "site-assets";

function storagePathFromQrUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${SITE_ASSETS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function saveSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };

  const newValues: Record<string, unknown> = {
    image_quality: clampInt(formData.get("image_quality"), 30, 100, DEFAULT_SETTINGS.image_quality),
    image_max_size: clampInt(formData.get("image_max_size"), 600, 4000, DEFAULT_SETTINGS.image_max_size),
    thumb_max_size: clampInt(formData.get("thumb_max_size"), 200, 1200, DEFAULT_SETTINGS.thumb_max_size),
    ai_model: String(formData.get("ai_model") ?? DEFAULT_SETTINGS.ai_model).trim() || DEFAULT_SETTINGS.ai_model,
    ai_enable_web_search: formData.get("ai_enable_web_search") === "on",
    contact_phone: String(formData.get("contact_phone") ?? "").trim(),
    contact_line: String(formData.get("contact_line") ?? "").trim(),
    contact_email: String(formData.get("contact_email") ?? "").trim(),
    contact_address: String(formData.get("contact_address") ?? "").trim(),
    about_html: String(formData.get("about_html") ?? "").trim(),
  };

  const supabase = await createSupabaseServerClient();
  const rows = Object.entries(newValues).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  }));

  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/settings");
  revalidatePath("/about");
  return { ok: true };
}

export async function deleteLineQrAction() {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };

  const settings = await getSettings();
  const url = settings.contact_line_qr_url?.trim();
  if (!url) return { ok: true };

  const adminCli = createSupabaseAdminClient();
  const path = storagePathFromQrUrl(url);
  if (path) {
    await adminCli.storage.from(SITE_ASSETS_BUCKET).remove([path]);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("settings").upsert(
    {
      key: "contact_line_qr_url",
      value: "",
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    },
    { onConflict: "key" },
  );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/about");
  return { ok: true };
}
