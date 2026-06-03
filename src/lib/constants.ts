export const SITE = {
  name: "藏珍閣",
  tagline: "天王星名藝社 · 藝品古玩典藏",
  description:
    "藏珍閣為天王星名藝社之線上典藏館，珍藏壽山石、雞血石、玉石、石雕、木雕、字畫、瓷器、銅器、蜜蠟等藝品古玩，與藏家共賞風雅。",
  shortName: "藏珍閣",
} as const;

export const DEFAULT_CATEGORIES = [
  { slug: "shoushan-stone", name: "壽山石", description: "福州壽山石章料、印石、雕件" },
  { slug: "chicken-blood-stone", name: "雞血石", description: "昌化、巴林雞血石珍品" },
  { slug: "jade", name: "玉石", description: "和闐玉、翡翠及各式美玉" },
  { slug: "stone-carving", name: "石雕", description: "山子、擺件、文房石器" },
  { slug: "wood-carving", name: "木雕", description: "黃花梨、紫檀及各類木雕" },
  { slug: "calligraphy-painting", name: "字畫", description: "名家書法、水墨字畫" },
  { slug: "porcelain", name: "瓷器", description: "官窯、民窯瓷器精品" },
  { slug: "bronze", name: "銅器", description: "古銅器、銅雕、銅爐" },
  { slug: "amber", name: "蜜蠟", description: "蜜蠟、琥珀、有機寶石" },
  { slug: "others", name: "其他藝品", description: "其他古玩雅趣" },
] as const;

export const ITEM_STATUS = {
  draft: { label: "草稿", color: "bg-zinc-200 text-zinc-700" },
  published: { label: "公開展示", color: "bg-emerald-100 text-emerald-700" },
  reserved: { label: "已預訂", color: "bg-amber-100 text-amber-800" },
  sold: { label: "已釋出", color: "bg-rose-100 text-rose-700" },
} as const;

export type ItemStatus = keyof typeof ITEM_STATUS;

export const DEFAULT_SETTINGS = {
  image_quality: 82,
  image_max_size: 1920,
  thumb_max_size: 600,
  ai_model: "gpt-5.5",
  ai_enable_web_search: true,
  contact_phone: "",
  contact_line: "",
  contact_email: "",
  contact_address: "",
  contact_line_qr_url: "",
  about_html: "",
} as const;

export type AppSettings = typeof DEFAULT_SETTINGS;
