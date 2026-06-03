"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteLineQrAction } from "@/app/admin/settings/actions";

interface Props {
  initialUrl: string;
}

export function LineQrManager({ initialUrl }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);
  const [, startDelete] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/line-qr", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "上傳失敗");
        return;
      }
      setUrl(data.url as string);
      toast.success("LINE QR Code 已上傳");
      router.refresh();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete() {
    if (!confirm("確認刪除 LINE QR Code？此操作無法復原。")) return;
    startDelete(async () => {
      const res = await deleteLineQrAction();
      if (!res.ok) {
        toast.error(res.message ?? "刪除失敗");
        return;
      }
      setUrl("");
      toast.success("已刪除 LINE QR Code");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">LINE QR Code</p>
      <p className="text-xs text-muted-foreground">
        上傳後會顯示於關於頁聯絡區塊，供訪客掃碼加好友。與上方 LINE ID 文字可並存。
      </p>
      {url ? (
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="relative size-40 rounded-md border bg-background overflow-hidden shrink-0">
            <Image
              src={url}
              alt="LINE QR Code"
              fill
              sizes="160px"
              className="object-contain p-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="size-4 mr-1" />
              更換圖片
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={uploading}
              onClick={handleDelete}
            >
              <Trash2 className="size-4 mr-1" />
              刪除
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">尚未上傳 QR Code。</p>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageUp className="size-4 mr-2" />
            {uploading ? "上傳中…" : "上傳 QR Code"}
          </Button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
    </div>
  );
}
