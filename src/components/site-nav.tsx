"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Menu, X } from "lucide-react";
import { CATEGORIES, TOOLS, type ToolCategory } from "@/lib/tools";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REPO = "https://github.com/statico/gif-tools";

const CATEGORY_ORDER: ToolCategory[] = ["convert", "edit", "optimize", "emoji"];

export function SiteNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the mobile menu whenever we navigate.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-12 px-4 sm:px-6">
        <div className="flex items-baseline gap-4 min-w-0">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[2px] uppercase text-foreground shrink-0"
          >
            gif<span className="text-primary">.</span>tools
          </Link>
          <nav aria-label="工具分类" className="hidden md:flex items-baseline gap-4">
            {CATEGORY_ORDER.map((c) => (
              <Link
                key={c}
                href={`/#${c}`}
                className="text-label tracking-[0.5px] uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                {CATEGORIES[c].label}
              </Link>
            ))}
            <Link
              href="/history/"
              className={cn(
                "text-label tracking-[0.5px] uppercase transition-colors",
                pathname?.startsWith("/history")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              历史
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <a href={REPO} aria-label="GitHub 源码" title="GitHub 源码">
              <Github aria-hidden="true" />
            </a>
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "关闭菜单" : "打开菜单"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="全部工具"
          className="md:hidden border-t border-border max-h-[70vh] overflow-y-auto"
        >
          {CATEGORY_ORDER.map((c) => (
            <div key={c} className="px-4 py-3 border-b border-border last:border-0">
              <p className="smui-eyebrow mb-2">{CATEGORIES[c].label}</p>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {TOOLS.filter((t) => t.category === c).map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/${t.slug}/`}
                      className="text-ui text-foreground hover:text-primary"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/history/" className="text-ui text-foreground hover:text-primary">
              历史记录
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-16 px-4 sm:px-6 py-6">
      <p className="text-label text-muted-foreground tracking-wider">
        所有处理都在你的浏览器里完成，用的是 ffmpeg、gifsicle 和 ImageMagick 的 WebAssembly
        版本。文件永远不会上传。
      </p>
      <p className="text-label text-muted-foreground tracking-wider mt-2">
        <Link href="/glossary/" className="hover:text-foreground underline underline-offset-2">
          术语表
        </Link>
        {" · "}
        {/* Plain anchor: it's a static file, and next/link would prefetch it
            as an RSC route and 404. */}
        <a href="/sitemap.md" className="hover:text-foreground underline underline-offset-2">
          站点地图
        </a>
        {" · "}
        <a href={REPO} className="hover:text-foreground underline underline-offset-2">
          GitHub 源码
        </a>
      </p>
    </footer>
  );
}
