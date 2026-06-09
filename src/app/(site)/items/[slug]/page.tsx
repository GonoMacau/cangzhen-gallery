import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft, MessageCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ImageGallery } from "@/components/site/image-gallery";
import { ShareButton } from "@/components/site/share-button";
import { CommentSection } from "@/components/site/comment-section";
import { ContactAdminButton } from "@/components/site/contact-admin-button";
import { getItemBySlug } from "@/lib/queries";
import { ITEM_STATUS, SITE } from "@/lib/constants";
import { env } from "@/lib/env";
import { buildOgImages } from "@/lib/metadata";
import { formatDate, simpleMarkdown } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/auth";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) return { title: "藏品" };
  const coverImage = item.images?.[0];
  const coverUrl = coverImage?.url || item.cover_image_url || undefined;
  const desc = item.summary || item.ai_description?.slice(0, 100) || `${SITE.name}藏品：${item.title}`;
  const ogTitle = `${item.title} · ${SITE.name}`;
  const ogImages = buildOgImages(
    coverUrl
      ? {
          url: coverUrl,
          width: coverImage?.width,
          height: coverImage?.height,
          alt: item.title,
        }
      : null,
  );

  return {
    title: item.title,
    description: desc,
    alternates: { canonical: `/items/${slug}` },
    openGraph: {
      title: ogTitle,
      description: desc,
      type: "article",
      url: `/items/${slug}`,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: desc,
      images: coverUrl ? [coverUrl] : undefined,
    },
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) notFound();

  const profile = await getCurrentProfile();
  const status = ITEM_STATUS[item.status];
  const isAdmin = profile?.role === "admin";

  if (item.status !== "published" && !isAdmin) {
    notFound();
  }

  const shareUrl = `${env.siteUrl}/items/${item.slug}`;

  return (
    <article className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          href="/items"
          className="text-sm text-muted-foreground inline-flex items-center hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> 回到藏品總覽
        </Link>
        <div className="flex items-center gap-2">
          <ShareButton title={item.title} text={item.summary ?? ""} url={shareUrl} />
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/items/${item.id}/edit`}>編輯</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
        <ImageGallery images={item.images} title={item.title} />

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {item.category?.name && (
                <Badge variant="secondary">
                  <Link href={`/categories/${item.category.slug}`}>{item.category.name}</Link>
                </Badge>
              )}
              <Badge className={status.color} variant="outline">
                {status.label}
              </Badge>
            </div>
            <h1 className="font-display text-3xl md:text-4xl leading-snug">{item.title}</h1>
            {item.summary && (
              <p className="text-muted-foreground leading-7 mt-2">{item.summary}</p>
            )}
          </div>

          <Separator />

          <dl className="grid grid-cols-3 gap-y-3 text-sm">
            {item.era && (
              <>
                <dt className="text-muted-foreground">年代</dt>
                <dd className="col-span-2">{item.era}</dd>
              </>
            )}
            {item.material && (
              <>
                <dt className="text-muted-foreground">材質</dt>
                <dd className="col-span-2">{item.material}</dd>
              </>
            )}
            {item.dimensions && (
              <>
                <dt className="text-muted-foreground">尺寸</dt>
                <dd className="col-span-2">{item.dimensions}</dd>
              </>
            )}
            {item.weight && (
              <>
                <dt className="text-muted-foreground">重量</dt>
                <dd className="col-span-2">{item.weight}</dd>
              </>
            )}
            {item.provenance && (
              <>
                <dt className="text-muted-foreground">來源</dt>
                <dd className="col-span-2">{item.provenance}</dd>
              </>
            )}
            {item.price_visible && item.price && (
              <>
                <dt className="text-muted-foreground">售價</dt>
                <dd className="col-span-2 text-primary font-medium">{item.price}</dd>
              </>
            )}
            {item.published_at && (
              <>
                <dt className="text-muted-foreground">上架日</dt>
                <dd className="col-span-2">{formatDate(item.published_at)}</dd>
              </>
            )}
          </dl>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <ContactAdminButton itemTitle={item.title} loggedIn={!!profile} />
          </div>
        </div>
      </div>

      {item.ai_description && (
        <section className="space-y-3 max-w-4xl">
          <h2 className="font-display text-xl flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> 藏品介紹
          </h2>
          <div
            className="prose prose-zinc max-w-none text-foreground/90 leading-8 text-base"
            dangerouslySetInnerHTML={{ __html: simpleMarkdown(item.ai_description) }}
          />
        </section>
      )}

      <Separator />

      <section className="max-w-4xl space-y-4">
        <h2 className="font-display text-xl flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" /> 藏家留言
        </h2>
        <CommentSection itemId={item.id} loggedIn={!!profile} isAdmin={isAdmin} />
      </section>
    </article>
  );
}
