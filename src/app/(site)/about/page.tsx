import Image from "next/image";
import { SITE } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { AddressMap } from "@/components/site/address-map";

export const metadata = { title: "關於藏珍閣" };
export const revalidate = 300;

export default async function AboutPage() {
  const settings = await getSettings();
  const hasContact =
    !!settings.contact_phone ||
    !!settings.contact_line ||
    !!settings.contact_email ||
    !!settings.contact_address?.trim() ||
    !!settings.contact_line_qr_url?.trim();

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
      <header className="text-center space-y-3">
        <h1 className="font-display text-4xl md:text-5xl">{SITE.name}</h1>
        <p className="text-muted-foreground tracking-[0.2em]">{SITE.tagline}</p>
      </header>

      <div className="prose prose-zinc max-w-none whitespace-pre-line leading-8">
        {settings.about_html?.trim() ? (
          settings.about_html
        ) : (
          <>
            藏珍閣為「天王星名藝社」之線上典藏館，承襲多年古玩經營經驗，
            以壽山石、雞血石、玉石、石雕、木雕、字畫、瓷器、銅器、蜜蠟為主要收藏領域。

            我們相信，每一件藝品古玩都是一段時光的縮影。透過此線上典藏，我們希望能與更多藏家結緣，
            共同品味器物之美、考察典故、交流鑑賞心得。

            如對館內任何一件藏品有興趣，歡迎透過站內訊息直接聯繫，我們將盡快親自回覆。
          </>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-6 text-sm">
        <h2 className="font-display text-xl">聯繫方式</h2>
        {hasContact ? (
          <>
            <dl className="grid grid-cols-3 gap-y-2">
              {settings.contact_phone && (
                <>
                  <dt className="text-muted-foreground">電話</dt>
                  <dd className="col-span-2">{settings.contact_phone}</dd>
                </>
              )}
              {settings.contact_line && (
                <>
                  <dt className="text-muted-foreground">LINE</dt>
                  <dd className="col-span-2">{settings.contact_line}</dd>
                </>
              )}
              {settings.contact_email && (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="col-span-2">{settings.contact_email}</dd>
                </>
              )}
              {settings.contact_address?.trim() && (
                <>
                  <dt className="text-muted-foreground">地址</dt>
                  <dd className="col-span-2">{settings.contact_address}</dd>
                </>
              )}
            </dl>
            {settings.contact_address?.trim() ? (
              <AddressMap address={settings.contact_address} />
            ) : null}
            {settings.contact_line_qr_url?.trim() ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t">
                <p className="text-muted-foreground shrink-0">掃描加入 LINE</p>
                <div className="relative size-44 rounded-md border bg-background overflow-hidden">
                  <Image
                    src={settings.contact_line_qr_url}
                    alt="LINE QR Code"
                    fill
                    sizes="176px"
                    className="object-contain p-2"
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">
            站內登入後即可使用訊息功能與藏家直接對話。
          </p>
        )}
      </div>
    </div>
  );
}
