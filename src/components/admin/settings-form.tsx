"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveSettingsAction } from "@/app/admin/settings/actions";
import { LineQrManager } from "@/components/admin/line-qr-manager";
import { AddressMap } from "@/components/site/address-map";
import type { AppSettings } from "@/lib/constants";

interface Props {
  settings: AppSettings;
}

export function SettingsForm({ settings }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [aiSearch, setAiSearch] = useState<boolean>(!!settings.ai_enable_web_search);
  const [addressPreview, setAddressPreview] = useState<string>(settings.contact_address ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveSettingsAction(fd);
      if (!res.ok) {
        toast.error(res.message ?? "儲存失敗");
        return;
      }
      toast.success("設定已儲存");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>圖片壓縮</CardTitle>
          <CardDescription>所有上傳的藏品圖片將以下列參數轉成 webp 儲存。</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="image_quality">主圖品質 (30-100)</Label>
            <Input
              id="image_quality"
              name="image_quality"
              type="number"
              min={30}
              max={100}
              defaultValue={settings.image_quality}
            />
            <p className="text-xs text-muted-foreground">建議 78 ~ 88</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="image_max_size">主圖長邊像素</Label>
            <Input
              id="image_max_size"
              name="image_max_size"
              type="number"
              min={600}
              max={4000}
              defaultValue={settings.image_max_size}
            />
            <p className="text-xs text-muted-foreground">建議 1600 ~ 2400</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="thumb_max_size">縮圖長邊像素</Label>
            <Input
              id="thumb_max_size"
              name="thumb_max_size"
              type="number"
              min={200}
              max={1200}
              defaultValue={settings.thumb_max_size}
            />
            <p className="text-xs text-muted-foreground">建議 400 ~ 800</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 設定</CardTitle>
          <CardDescription>POE AI API Key 由環境變數 POE_API_KEY 提供。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai_model">AI 模型名稱</Label>
            <Input
              id="ai_model"
              name="ai_model"
              defaultValue={settings.ai_model}
              placeholder="gpt-5.5"
            />
            <p className="text-xs text-muted-foreground">
              填寫 POE 上可用的模型 ID，如 gpt-5.5、claude-3.5-sonnet 等。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="ai_enable_web_search"
              name="ai_enable_web_search"
              checked={aiSearch}
              onCheckedChange={setAiSearch}
            />
            <Label htmlFor="ai_enable_web_search" className="cursor-pointer">
              允許 AI 援引網路常識（提示詞層面）
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>聯絡資訊</CardTitle>
          <CardDescription>顯示於關於頁與站尾。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_phone">電話</Label>
              <Input id="contact_phone" name="contact_phone" defaultValue={settings.contact_phone ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_line">LINE ID</Label>
              <Input id="contact_line" name="contact_line" defaultValue={settings.contact_line ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input id="contact_email" name="contact_email" type="email" defaultValue={settings.contact_email ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_address">地址</Label>
            <Input
              id="contact_address"
              name="contact_address"
              defaultValue={settings.contact_address ?? ""}
              placeholder="例：台北市信義區…"
              onChange={(e) => setAddressPreview(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">儲存後會顯示於關於頁，並嵌入 Google 地圖。</p>
            {addressPreview.trim() ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-muted-foreground">地圖預覽</p>
                <AddressMap address={addressPreview} />
              </div>
            ) : null}
          </div>
          <LineQrManager initialUrl={settings.contact_line_qr_url ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>關於頁文字</CardTitle>
          <CardDescription>會顯示在 /about 頁面。可使用換行；留空則使用預設文案。</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            name="about_html"
            rows={8}
            defaultValue={settings.about_html ?? ""}
            placeholder="關於藏珍閣的介紹..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "儲存中…" : "儲存設定"}
        </Button>
      </div>
    </form>
  );
}
