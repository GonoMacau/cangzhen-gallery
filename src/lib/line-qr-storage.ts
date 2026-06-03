/** LINE QR 存於既有 `items` bucket（與 0001 相同），無需額外建立 site-assets。 */
export const LINE_QR_STORAGE_BUCKET = "items";

export function lineQrStoragePath(ext: string): string {
  return `site/line-qr.${ext}`;
}

/** 刪除時相容舊版 site-assets URL 與新版 items URL。 */
export function parseLineQrStorageUrl(url: string): { bucket: string; path: string } | null {
  for (const bucket of ["items", "site-assets"]) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return { bucket, path: decodeURIComponent(url.slice(idx + marker.length)) };
    }
  }
  return null;
}
