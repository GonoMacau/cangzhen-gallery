import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { compressImage, makeThumbnail } from "@/lib/image";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const itemIdRaw = formData.get("item_id");
  const itemId = itemIdRaw ? String(itemIdRaw) : "";
  if (!(file instanceof File) || !itemId) {
    return NextResponse.json({ error: "缺少檔案或藏品 ID" }, { status: 400 });
  }
  if (!UUID_RE.test(itemId)) {
    return NextResponse.json({ error: "藏品 ID 格式無效" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "檔案不可超過 25MB" }, { status: 400 });
  }

  const settings = await getSettings();
  const arrayBuffer = await file.arrayBuffer();
  const inputBuf = Buffer.from(arrayBuffer);

  let main, thumb;
  try {
    [main, thumb] = await Promise.all([
      compressImage(inputBuf, {
        quality: settings.image_quality,
        maxSize: settings.image_max_size,
      }),
      makeThumbnail(inputBuf, settings.thumb_max_size),
    ]);
  } catch (e) {
    return NextResponse.json(
      { error: `圖片處理失敗：${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const adminCli = createSupabaseAdminClient();

  const stamp = Date.now();
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 50);
  const mainPath = `${itemId}/${stamp}_${baseName}.webp`;
  const thumbPath = `${itemId}/${stamp}_${baseName}_thumb.webp`;

  const upMain = await adminCli.storage.from("items").upload(mainPath, main.buffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (upMain.error) {
    return NextResponse.json({ error: upMain.error.message }, { status: 500 });
  }
  const upThumb = await adminCli.storage.from("items").upload(thumbPath, thumb.buffer, {
    contentType: "image/webp",
    upsert: false,
  });
  if (upThumb.error) {
    return NextResponse.json({ error: upThumb.error.message }, { status: 500 });
  }

  const { data: mainPub } = adminCli.storage.from("items").getPublicUrl(mainPath);
  const { data: thumbPub } = adminCli.storage.from("items").getPublicUrl(thumbPath);

  // 取得目前 sort_order 最大值
  const { data: maxRow } = await supabase
    .from("item_images")
    .select("sort_order")
    .eq("item_id", String(itemId))
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: imgRow, error: insertErr } = await supabase
    .from("item_images")
    .insert({
      item_id: String(itemId),
      url: mainPub.publicUrl,
      thumb_url: thumbPub.publicUrl,
      storage_path: mainPath,
      sort_order: nextOrder,
      width: main.width,
      height: main.height,
      bytes: main.bytes,
    })
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // 若 item 尚無封面，自動設為封面
  const { data: item } = await supabase
    .from("items")
    .select("id, cover_image_url, slug")
    .eq("id", String(itemId))
    .maybeSingle();
  if (item && !item.cover_image_url) {
    await supabase
      .from("items")
      .update({ cover_image_url: mainPub.publicUrl })
      .eq("id", item.id);
  }

  return NextResponse.json({ image: imgRow });
}
