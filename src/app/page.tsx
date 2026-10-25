import Link from "next/link";
import type { CSSProperties } from "react";
import { TOOL_ICONS } from "@/components/tool-icons";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools";
import { JsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";

const ORDER: ToolCategory[] = ["convert", "edit", "optimize", "emoji"];

export default function Home() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: SITE.name,
              url: `${SITE.url}/`,
              description: SITE.description,
              dateModified: new Date().toISOString(),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: SITE.name, item: `${SITE.url}/` },
              ],
            },
          ],
        }}
      />

      <section className="mb-10 max-w-3xl">
        <p className="smui-eyebrow mb-1.5">GIF 工具箱</p>
        <h1 className="font-display text-hero text-foreground leading-[1.1] mb-3">
          所有 GIF 工具，都在你的浏览器里运行。
        </h1>
        <p className="text-sm text-muted-foreground">
          {SITE.description}
          结果会保存在本地历史里，随时可以再拿；每个下载都按 Slack 的规则命名，可以直接拖进去用。
        </p>
      </section>

      {ORDER.map((cat) => {
        const tone = { "--tone": CATEGORIES[cat].tone } as CSSProperties;
        return (
          <section key={cat} id={cat} className="mb-10 scroll-mt-16" style={tone}>
            <h2 className="font-display text-heading mb-0.5" style={{ color: "hsl(var(--tone))" }}>
              {CATEGORIES[cat].label}
            </h2>
            <p className="text-ui text-muted-foreground mb-3">{CATEGORIES[cat].description}</p>
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.filter((t) => t.category === cat).map((t) => {
                const Icon = TOOL_ICONS[t.slug];
                return (
                  <li key={t.slug}>
                    <Link
                      href={`/${t.slug}/`}
                      className="tool-card flex h-full gap-3 border border-border bg-card p-3.5"
                    >
                      {Icon ? <Icon className="size-5 shrink-0 mt-px" aria-hidden="true" /> : null}
                      <span className="min-w-0">
                        <span className="block text-ui text-foreground mb-1">{t.name}</span>
                        <span className="block text-label text-muted-foreground leading-relaxed">
                          {t.blurb}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
