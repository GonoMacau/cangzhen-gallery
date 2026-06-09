import type { Metadata } from "next";

export interface OgImageInput {
  url: string;
  width?: number | null;
  height?: number | null;
  alt?: string;
}

/** 組出 Facebook / LINE 等爬蟲需要的 og:image（含建議的寬高欄位）。 */
export function buildOgImages(image?: OgImageInput | null): NonNullable<Metadata["openGraph"]>["images"] {
  if (!image?.url) return undefined;
  return [
    {
      url: image.url,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
      ...(image.alt ? { alt: image.alt } : {}),
    },
  ];
}
