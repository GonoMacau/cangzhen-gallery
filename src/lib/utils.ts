import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** 建立草稿時產生的暫用 slug（例如 draft-s66g95） */
export function isDraftPlaceholderSlug(slug: string): boolean {
  return /^draft-[a-z0-9]{6}$/.test(slug);
}

export function slugify(text: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base ? `${base}-${random}` : random;
}

export function truncate(text: string, max = 120): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

/**
 * 將 AI 輸出的簡易 Markdown 轉為安全 HTML。
 * 僅處理 **粗體**、*斜體*、條列（- / •）與換行，不引入外部套件。
 * 內容來源為 AI 生成（非使用者輸入），XSS 風險極低，但仍先 escape HTML 特殊字元。
 */
export function simpleMarkdown(text: string): string {
  return (
    text
      // escape HTML 特殊字元
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // **粗體**
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // *斜體*
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // 條列符號（- 或 • 開頭的行）→ <li>，再包 <ul>
      .replace(/^[-•]\s+(.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
      // 將連續的 </ul><ul> 合併
      .replace(/<\/ul>\s*<ul>/g, "")
      // 空行 → 段落分隔
      .replace(/\n{2,}/g, "</p><p>")
      // 剩餘單一換行
      .replace(/\n/g, "<br>")
      // 包裹整體段落
      .replace(/^/, "<p>")
      .replace(/$/, "</p>")
      // 修正 <ul> 前後多餘的 <p> 標籤
      .replace(/<p><ul>/g, "<ul>")
      .replace(/<\/ul><\/p>/g, "</ul>")
  );
}
