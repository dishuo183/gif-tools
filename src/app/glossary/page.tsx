import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { JsonLd, pageJsonLd } from "@/lib/seo";
import { TOOLS } from "@/lib/tools";
import { TERMS } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "GIF 术语表",
  description:
    "这些工具用到的术语的通俗解释：调色板、抖动、帧延迟、有损压缩、APNG、WebP、色彩量化，以及 Slack 表情的各项限制。",
  alternates: {
    canonical: `${SITE.url}/glossary/`,
    types: { "text/markdown": `${SITE.url}/glossary.md` },
  },
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={pageJsonLd("glossary", "GIF 术语表", metadata.description as string, {
          mainEntity: {
            "@type": "DefinedTermSet",
            name: "GIF 术语表",
            hasDefinedTerm: TERMS.map((t) => ({
              "@type": "DefinedTerm",
              name: t.term,
              description: t.body,
            })),
          },
        })}
      />
      <h1 className="font-display text-heading text-foreground mb-1.5">GIF 术语表</h1>
      <p className="text-sm text-muted-foreground max-w-3xl mb-6">
        这些工具用到的术语，在这里一次讲清楚。每个页面上的每个设置，说的都是这里的某一条。
      </p>
      <dl className="max-w-3xl space-y-5">
        {TERMS.map((t) => (
          <div key={t.term} className="border-l-2 border-border pl-4">
            <dt>
              <h2 className="text-label text-foreground tracking-wide uppercase mb-1">{t.term}</h2>
            </dt>
            <dd className="text-sm text-muted-foreground">
              {t.body}
              {t.see ? (
                <>
                  {" "}
                  <Link href={`/${t.see}/`} className="text-primary underline underline-offset-2">
                    试试「{TOOLS.find((x) => x.slug === t.see)?.name}」
                  </Link>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
