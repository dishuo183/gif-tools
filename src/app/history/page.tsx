import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { JsonLd, pageJsonLd } from "@/lib/seo";
import HistoryClient from "./client";

export const metadata: Metadata = {
  title: "历史记录",
  description:
    "你在本站做过的所有结果，只保存在这个浏览器里。可以重新下载任意结果，也可以一键清空。",
  alternates: {
    canonical: `${SITE.url}/history/`,
    types: { "text/markdown": `${SITE.url}/history.md` },
  },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <>
      <JsonLd data={pageJsonLd("history", "历史记录", metadata.description as string)} />
      <h1 className="font-display text-heading text-foreground mb-1.5">历史记录</h1>
      <p className="text-sm text-muted-foreground max-w-3xl mb-5">
        最近 60 个结果，只存在这个浏览器里，别处没有。清除站点数据就会清空这个列表，它也不会同步到其他设备。
      </p>
      <h2 className="text-label text-muted-foreground tracking-[0.5px] uppercase mb-2">
        已保存的结果
      </h2>
      <HistoryClient />

      <h2 className="text-label text-muted-foreground tracking-[0.5px] uppercase mt-10 mb-2">
        存放在哪里
      </h2>
      <p className="text-sm text-muted-foreground max-w-3xl">
        索引放在 localStorage，文件本身放在 IndexedDB，都在本站的 origin 下。不上传任何东西，所以列表是按浏览器、按设备分开的。超过 60 条后会丢掉最旧的记录。
      </p>
    </>
  );
}
