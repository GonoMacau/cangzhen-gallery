import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "站點設定" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="font-display text-3xl">站點設定</h1>
        <p className="text-sm text-muted-foreground mt-1">
          可調整圖片壓縮參數、AI 模型、聯絡資訊（含地址地圖、LINE QR）與關於頁文字。
        </p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
