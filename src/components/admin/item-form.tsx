"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { upsertItemAction, type ItemFormState } from "@/app/admin/items/actions";
import type { Category, Item } from "@/types/database";
import { ITEM_STATUS } from "@/lib/constants";

interface Props {
  categories: Category[];
  item?: Item;
  /** 由 ImageManager 傳入的已上傳圖片 URL，供 AI 以圖識物 */
  uploadedImageUrls?: string[];
}

const initialState: ItemFormState = { ok: false };

/** Radix Select 不支援空字串 value，用 sentinel 代表「未分類」 */
const CATEGORY_NONE = "__none__";

export function ItemForm({ categories, item, uploadedImageUrls = [] }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(upsertItemAction, initialState);
  const [aiDesc, setAiDesc] = useState(item?.ai_description ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [era, setEra] = useState(item?.era ?? "");
  const [material, setMaterial] = useState(item?.material ?? "");
  const [dimensions, setDimensions] = useState(item?.dimensions ?? "");
  const [weight, setWeight] = useState(item?.weight ?? "");
  const [provenance, setProvenance] = useState(item?.provenance ?? "");
  const [status, setStatus] = useState<keyof typeof ITEM_STATUS>(
    (item?.status as keyof typeof ITEM_STATUS) ?? "draft",
  );
  const [priceVisible, setPriceVisible] = useState(item?.price_visible ?? false);
  const [price, setPrice] = useState(item?.price ?? "");
  const [aiLoading, startAi] = useTransition();

  useEffect(() => {
    // 新增成功，跳到編輯頁可繼續上傳圖片
    if (state.ok && state.itemId && !item) {
      router.push(`/admin/items/${state.itemId}/edit`);
    }
  }, [state.ok, state.itemId, item, router]);

  const hasImages = uploadedImageUrls.length > 0;

  function handleAiAssist() {
    if (!title.trim() && !hasImages) {
      toast.error("請先輸入品名或上傳圖片再使用 AI 補述");
      return;
    }
    startAi(async () => {
      try {
        const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null;
        const res = await fetch("/api/ai/describe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "（未命名藏品）",
            summary,
            category: categoryName,
            era,
            material,
            dimensions,
            weight,
            provenance,
            ...(hasImages ? { imageUrls: uploadedImageUrls.slice(0, 4) } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "AI 補述失敗");
          return;
        }
        setAiDesc(data.description ?? "");
        toast.success("AI 已產生介紹，您可再行潤飾。");
      } catch (e) {
        toast.error(`AI 呼叫失敗：${e instanceof Error ? e.message : "未知錯誤"}`);
      }
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {item?.id && <input type="hidden" name="id" value={item.id} />}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">品名 *</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={120}
                placeholder="例如：壽山田黃凍石章料"
              />
              {state.errors?.title && (
                <p className="text-xs text-destructive">{state.errors.title.join(", ")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="category_id">分類</Label>
              <Select
                value={categoryId || CATEGORY_NONE}
                onValueChange={(v) => setCategoryId(v === CATEGORY_NONE ? "" : v)}
              >
                <SelectTrigger id="category_id" aria-label="分類">
                  <SelectValue placeholder="未分類" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_NONE}>未分類</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="category_id" value={categoryId} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">狀態</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as keyof typeof ITEM_STATUS)}
              >
                <SelectTrigger id="status" aria-label="狀態">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="status" value={status} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="era">年代</Label>
              <Input id="era" name="era" value={era} onChange={(e) => setEra(e.target.value)} placeholder="例如：清代 / 民國" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material">材質</Label>
              <Input id="material" name="material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="例如：壽山石、和闐玉" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dimensions">尺寸</Label>
              <Input id="dimensions" name="dimensions" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="例如：高 12cm × 寬 8cm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">重量</Label>
              <Input id="weight" name="weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="例如：320g" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="provenance">來源 / 提供者</Label>
              <Input id="provenance" name="provenance" value={provenance} onChange={(e) => setProvenance(e.target.value)} placeholder="例如：藏家自藏" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="summary">藏家簡述</Label>
              <Textarea
                id="summary"
                name="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="可只寫一兩句重點，AI 會據此擴充介紹文。"
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Switch
              id="price_visible"
              name="price_visible"
              checked={priceVisible}
              onCheckedChange={setPriceVisible}
            />
            <Label htmlFor="price_visible" className="cursor-pointer">公開顯示售價</Label>
            <Input
              name="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="例如：洽詢、NT$120,000"
              disabled={!priceVisible}
              className="max-w-xs"
            />
          </div>
          {/* hidden checkbox to ensure unchecked sends nothing */}
          {!priceVisible && <input type="hidden" name="price_visible" value="" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label htmlFor="ai_description" className="text-base font-display">
              AI 藏品介紹
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAiAssist}
              disabled={aiLoading}
            >
              <Sparkles className="size-4" />
              {aiLoading
                ? "AI 撰寫中…"
                : hasImages
                  ? "以圖片 AI 生成描述"
                  : "AI 一鍵撰寫"}
            </Button>
          </div>
          <Textarea
            id="ai_description"
            name="ai_description"
            value={aiDesc}
            onChange={(e) => setAiDesc(e.target.value)}
            rows={14}
            placeholder="點擊上方「AI 一鍵撰寫」由 POE AI 依品名與其它資訊產生詳細介紹，您可再行潤飾。"
          />
          {item?.ai_generated_at && (
            <p className="text-xs text-muted-foreground">
              上次 AI 生成：{new Date(item.ai_generated_at).toLocaleString("zh-TW")}
            </p>
          )}
        </CardContent>
      </Card>

      {state.message && (
        <p className={state.ok ? "text-emerald-600 text-sm" : "text-destructive text-sm"}>
          {state.message}
        </p>
      )}

      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/85 py-3 backdrop-blur -mx-4 px-4 pointer-events-none">
        <Button type="submit" disabled={isPending} className="pointer-events-auto">
          {isPending ? "儲存中…" : item ? "儲存變更" : "建立藏品"}
        </Button>
      </div>
    </form>
  );
}
