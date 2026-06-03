import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const SITE_ASSETS_BUCKET = "site-assets";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "檔案不可超過 2MB" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "僅支援 PNG、JPEG、WebP" }, { status: 400 });
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());
  let buffer: Buffer;
  let contentType: string;
  let ext: string;

  try {
    if (file.type === "image/png") {
      buffer = await sharp(inputBuf).png().toBuffer();
      contentType = "image/png";
      ext = "png";
    } else if (file.type === "image/jpeg") {
      buffer = await sharp(inputBuf).jpeg({ quality: 95 }).toBuffer();
      contentType = "image/jpeg";
      ext = "jpg";
    } else {
      buffer = await sharp(inputBuf).webp({ quality: 95 }).toBuffer();
      contentType = "image/webp";
      ext = "webp";
    }
  } catch (e) {
    return NextResponse.json(
      { error: `圖片處理失敗：${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 },
    );
  }

  const storagePath = `site/line-qr.${ext}`;
  const adminCli = createSupabaseAdminClient();

  const { error: uploadErr } = await adminCli.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: pub } = adminCli.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(storagePath);
  const url = pub.publicUrl;

  const supabase = await createSupabaseServerClient();
  const { error: settingsErr } = await supabase.from("settings").upsert(
    {
      key: "contact_line_qr_url",
      value: url,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    },
    { onConflict: "key" },
  );
  if (settingsErr) {
    return NextResponse.json({ error: settingsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url });
}
