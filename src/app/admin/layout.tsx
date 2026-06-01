import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderTree,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "儀表板", icon: LayoutDashboard, exact: true },
  { href: "/admin/items", label: "藏品管理", icon: ImageIcon },
  { href: "/admin/categories", label: "分類管理", icon: FolderTree },
  { href: "/admin/messages", label: "訊息收件匣", icon: MessageCircle, key: "messages" as const },
  { href: "/admin/users", label: "使用者管理", icon: Users },
  { href: "/admin/settings", label: "站點設定", icon: Settings },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?redirect=/admin");
  if (profile.role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-3xl">無權限</h1>
        <p className="text-muted-foreground">此頁面僅供管理員存取。</p>
        <Button asChild>
          <Link href="/">回首頁</Link>
        </Button>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: unreadRows } = await supabase
    .from("conversations")
    .select("unread_for_admin")
    .gt("unread_for_admin", 0);
  const totalUnread = (unreadRows ?? []).reduce(
    (sum, r) => sum + (r.unread_for_admin ?? 0),
    0,
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex flex-col w-60 border-r bg-card/40">
        <div className="p-4 border-b">
          <Logo size="sm" showTagline={false} />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors"
            >
              <n.icon className="size-4" />
              <span className="flex-1">{n.label}</span>
              {n.key === "messages" && totalUnread > 0 && (
                <Badge variant="destructive" className="px-1.5 py-0 h-5 min-w-5 justify-center">
                  {totalUnread}
                </Badge>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3" /> 回到前台
          </Link>
          <p className="mt-2">登入身份：{profile.display_name ?? "管理員"}</p>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b p-3 flex items-center justify-between bg-card">
          <Logo size="sm" showTagline={false} />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">前台</Link>
          </Button>
        </header>
        <nav className="md:hidden flex overflow-x-auto gap-1 border-b bg-card px-2 py-2 text-xs">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="px-3 py-1.5 rounded-md hover:bg-accent whitespace-nowrap inline-flex items-center gap-1"
            >
              <n.icon className="size-3" />
              {n.label}
              {n.key === "messages" && totalUnread > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 h-4 min-w-4 justify-center text-[10px]">
                  {totalUnread}
                </Badge>
              )}
            </Link>
          ))}
        </nav>
        <main className="flex-1 min-w-0 p-4 md:p-8 bg-background">{children}</main>
      </div>
    </div>
  );
}
