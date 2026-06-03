"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDraftPlaceholderSlug, slugify } from "@/lib/utils";

const itemSchema = z.object({
  title: z.string().min(1, "請輸入品名").max(120),
  category_id: z.string().uuid().optional().or(z.literal("")),
  summary: z.string().max(2000).optional().or(z.literal("")),
  ai_description: z.string().max(8000).optional().or(z.literal("")),
  era: z.string().max(80).optional().or(z.literal("")),
  material: z.string().max(80).optional().or(z.literal("")),
  dimensions: z.string().max(80).optional().or(z.literal("")),
  weight: z.string().max(80).optional().or(z.literal("")),
  provenance: z.string().max(200).optional().or(z.literal("")),
  price_visible: z.boolean().optional(),
  price: z.string().max(80).optional().or(z.literal("")),
  status: z.enum(["draft", "published", "reserved", "sold"]),
});

export type ItemFormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  itemId?: string;
};

function emptyToNull(v: string | undefined | null) {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function upsertItemAction(
  prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };

  const id = formData.get("id") ? String(formData.get("id")) : null;

  const raw = {
    title: String(formData.get("title") ?? ""),
    category_id: formData.get("category_id") ? String(formData.get("category_id")) : "",
    summary: String(formData.get("summary") ?? ""),
    ai_description: String(formData.get("ai_description") ?? ""),
    era: String(formData.get("era") ?? ""),
    material: String(formData.get("material") ?? ""),
    dimensions: String(formData.get("dimensions") ?? ""),
    weight: String(formData.get("weight") ?? ""),
    provenance: String(formData.get("provenance") ?? ""),
    price_visible: formData.get("price_visible") === "on",
    price: String(formData.get("price") ?? ""),
    status: (formData.get("status") as "draft" | "published" | "reserved" | "sold") ?? "draft",
  };

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "資料驗證失敗",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createSupabaseServerClient();
  const data = parsed.data;

  const payload = {
    title: data.title.trim(),
    category_id: emptyToNull(data.category_id),
    summary: emptyToNull(data.summary),
    ai_description: emptyToNull(data.ai_description),
    era: emptyToNull(data.era),
    material: emptyToNull(data.material),
    dimensions: emptyToNull(data.dimensions),
    weight: emptyToNull(data.weight),
    provenance: emptyToNull(data.provenance),
    price_visible: !!data.price_visible,
    price: emptyToNull(data.price),
    status: data.status,
    published_at:
      data.status === "published" ? new Date().toISOString() : null,
  } as const;

  let resultId = id;
  let previousSlug: string | null = null;
  if (id) {
    const updatePayload: typeof payload & { slug?: string } = { ...payload };
    const { data: existing } = await supabase
      .from("items")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    previousSlug = existing?.slug ?? null;
    const needsAsciiSlug = existing?.slug && /[^\x00-\x7F]/.test(existing.slug);
    const needsPublishSlug =
      existing?.slug &&
      isDraftPlaceholderSlug(existing.slug) &&
      (data.status === "published" || payload.title.trim() !== "（草稿）");
    if (needsAsciiSlug || needsPublishSlug) {
      updatePayload.slug = slugify(payload.title);
    }
    const { error } = await supabase.from("items").update(updatePayload).eq("id", id);
    if (error) return { ok: false, message: error.message };
  } else {
    const slug = slugify(payload.title);
    const { data: inserted, error } = await supabase
      .from("items")
      .insert({ ...payload, slug, created_by: admin.id })
      .select("id, slug")
      .single();
    if (error || !inserted) return { ok: false, message: error?.message ?? "新增失敗" };
    resultId = inserted.id;
  }

  revalidatePath("/admin/items");
  revalidatePath("/items");
  revalidatePath("/");
  if (resultId) {
    const { data: row } = await supabase.from("items").select("slug").eq("id", resultId).maybeSingle();
    if (previousSlug && previousSlug !== row?.slug) {
      revalidatePath(`/items/${previousSlug}`);
    }
    if (row?.slug) revalidatePath(`/items/${row.slug}`);
  }
  return { ok: true, message: "已儲存", itemId: resultId ?? undefined };
}

export async function createDraftItemAction(): Promise<{ ok: boolean; itemId?: string; message?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };
  const supabase = await createSupabaseServerClient();
  const slug = slugify("draft");
  const { data, error } = await supabase
    .from("items")
    .insert({ title: "（草稿）", slug, status: "draft", created_by: admin.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "建立草稿失敗" };
  return { ok: true, itemId: data.id };
}

export async function deleteItemAction(itemId: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };
  const supabase = await createSupabaseServerClient();

  // 先取得圖片紀錄以便清除 storage
  const { data: imgs } = await supabase
    .from("item_images")
    .select("storage_path")
    .eq("item_id", itemId);

  const { error } = await supabase.from("items").delete().eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  if (imgs && imgs.length > 0) {
    const adminCli = createSupabaseAdminClient();
    const paths = imgs.map((i) => i.storage_path).filter(Boolean) as string[];
    if (paths.length) await adminCli.storage.from("items").remove(paths);
  }

  revalidatePath("/admin/items");
  revalidatePath("/items");
  return { ok: true };
}

export async function deleteItemAndRedirectAction(formData: FormData) {
  const id = String(formData.get("id"));
  await deleteItemAction(id);
  redirect("/admin/items");
}

export async function deleteImageAction(imageId: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };
  const supabase = await createSupabaseServerClient();
  const { data: img } = await supabase
    .from("item_images")
    .select("storage_path, item_id")
    .eq("id", imageId)
    .maybeSingle();

  const { error } = await supabase.from("item_images").delete().eq("id", imageId);
  if (error) return { ok: false, message: error.message };

  if (img?.storage_path) {
    const adminCli = createSupabaseAdminClient();
    await adminCli.storage.from("items").remove([img.storage_path]);
  }
  if (img?.item_id) {
    const { data: itemRow } = await supabase
      .from("items")
      .select("slug")
      .eq("id", img.item_id)
      .maybeSingle();
    if (itemRow?.slug) revalidatePath(`/items/${itemRow.slug}`);
  }
  return { ok: true };
}

export async function setCoverFromImageAction(imageId: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "未授權" };
  const supabase = await createSupabaseServerClient();
  const { data: img } = await supabase
    .from("item_images")
    .select("url, item_id")
    .eq("id", imageId)
    .maybeSingle();
  if (!img?.item_id) return { ok: false, message: "圖片不存在" };
  await supabase.from("items").update({ cover_image_url: img.url }).eq("id", img.item_id);

  const { data: itemRow } = await supabase
    .from("items")
    .select("slug")
    .eq("id", img.item_id)
    .maybeSingle();
  if (itemRow?.slug) revalidatePath(`/items/${itemRow.slug}`);
  return { ok: true };
}
