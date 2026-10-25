/**
 * Post-build: emit the agent-readability surface into out/.
 *
 * Everything here derives from src/lib/tools.ts so the site, the sitemap and
 * the markdown mirrors can never drift apart. Node 24 imports the .ts directly.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const { TOOLS, CATEGORIES } = await import("../src/lib/tools.ts");
const { TERMS } = await import("../src/lib/glossary.ts");
const { SITE } = await import("../src/lib/site.ts");

const OUT = join(process.cwd(), "out");
const now = new Date().toISOString();
const ORDER = ["convert", "edit", "optimize", "emoji"];

const write = async (rel, body) => {
  const path = join(OUT, rel);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, body, "utf8");
  console.log(`wrote out/${rel}`);
};

/* ── llms.txt ──────────────────────────────────────────────────────────── */
const llms = `# ${SITE.name}

> ${SITE.description}

所有工具都在浏览器里通过 WebAssembly 运行。没有 API，也没有上传接口：文件在访问者
自己的浏览器里处理，永远不会被发送到别处。本站是静态导出，下面每一页都是带独立
元数据的真实 HTML 文档，并且在同一路径下有一份 \`.md\` 扩展名的 Markdown 镜像。

## 工具

${ORDER.map(
  (cat) => `### ${CATEGORIES[cat].label} — ${CATEGORIES[cat].description}

${TOOLS.filter((t) => t.category === cat)
  .map((t) => `- [${t.name}](${SITE.url}/${t.slug}.md)：${t.description}`)
  .join("\n")}`,
).join("\n\n")}

## 关于

- [首页](${SITE.url}/index.md)：完整的工具索引。
- [站点地图](${SITE.url}/sitemap.md)：站内所有页面。
- [AGENTS.md](${SITE.url}/AGENTS.md)：本站如何构建、如何参与开发。

## 引擎

- ffmpeg（WebAssembly）— 视频与动画的解码、滤镜和编码。
- gifsicle（WebAssembly）— GIF 专用优化与调色板缩减。
- ImageMagick（WebAssembly）— 静态图片的转换与压缩。
- Canvas 2D 与 gifenc — 表情和文字生成器。

最后更新：${now}
`;
await write("llms.txt", llms);

/* ── per-tool markdown mirrors ─────────────────────────────────────────── */
for (const t of TOOLS) {
  await write(
    `${t.slug}.md`,
    `---
title: "${t.title}"
description: "${t.description.replace(/"/g, '\\"')}"
url: "${SITE.url}/${t.slug}/"
category: "${t.category}"
last_updated: "${now}"
doc_version: "1"
---

# ${t.title}

${t.description}

## 工作原理

这个工具完全在你的浏览器里运行，使用编译为 WebAssembly 的 ${t.engine.join("、")}
（或下面列出的 Canvas API）。文件不会被上传——它被读入内存，在本地处理，然后作为
下载交还给你。

## 使用方法

1. 打开 ${SITE.url}/${t.slug}/
2. ${t.category === "emoji" && (t.slug === "number" || t.slug === "text-emoji") ? "输入文字并选择一种样式。" : "选择文件，可以拖进去，也可以用文件选择器。"}
3. 调整设置。${t.blurb}
4. 设置文件名并下载。文件名会被规范化，结果可以直接作为自定义表情上传到 Slack。

结果也会保存到按浏览器隔离的历史记录里：${SITE.url}/history/。

## 相关工具

${TOOLS.filter((x) => x.category === t.category && x.slug !== t.slug)
  .map((x) => `- [${x.name}](${SITE.url}/${x.slug}.md)：${x.blurb}`)
  .join("\n")}

## 站点地图

- [所有页面，按分区排列](${SITE.url}/sitemap.md)
- [XML 站点地图](${SITE.url}/sitemap.xml)
- [给 agent 的站点概览](${SITE.url}/llms.txt)
`,
  );
}

/* ── index.md ──────────────────────────────────────────────────────────── */
await write(
  "index.md",
  `---
title: "${SITE.title}"
description: "${SITE.description}"
url: "${SITE.url}/"
last_updated: "${now}"
doc_version: "1"
---

# ${SITE.title}

${SITE.description}

没有账号，没有上传，也没有服务端处理。下面每个工具都是一个静态页面，按需加载
WebAssembly 引擎，在你自己的浏览器里完成工作。结果会保存在本地历史里，随时可以
再取回；下载的文件名也按规则生成，可以直接作为自定义表情放进 Slack。

${ORDER.map(
  (cat) => `## ${CATEGORIES[cat].label}

${CATEGORIES[cat].description}

${TOOLS.filter((t) => t.category === cat)
  .map((t) => `- [${t.name}](${SITE.url}/${t.slug}.md)：${t.description}`)
  .join("\n")}`,
).join("\n\n")}

## 站点地图

- [所有页面，按分区排列](${SITE.url}/sitemap.md)
- [XML 站点地图](${SITE.url}/sitemap.xml)
`,
);

/* ── sitemap.md ────────────────────────────────────────────────────────── */
await write(
  "sitemap.md",
  `---
title: "站点地图 — ${SITE.name}"
description: "${SITE.name} 的所有页面，按分区排列。"
url: "${SITE.url}/sitemap.md"
last_updated: "${now}"
doc_version: "1"
---

# 站点地图

## 站点

- [首页](${SITE.url}/)：工具索引。
- [历史记录](${SITE.url}/history/)：你本地的结果（不索引，按浏览器隔离）。

${ORDER.map(
  (cat) => `## ${CATEGORIES[cat].label}

${TOOLS.filter((t) => t.category === cat)
  .map(
    (t) =>
      `- [${t.name}](${SITE.url}/${t.slug}/)（[markdown](${SITE.url}/${t.slug}.md)）：${t.blurb}`,
  )
  .join("\n")}`,
).join("\n\n")}
`,
);

/* ── glossary.md and history.md ────────────────────────────────────────── */
await write(
  "glossary.md",
  `---
title: "GIF 术语表 — ${SITE.name}"
description: "这些工具用到的术语的通俗解释。"
url: "${SITE.url}/glossary.md"
last_updated: "${now}"
doc_version: "1"
---

# GIF 术语表

这些工具用到的术语，在这里一次讲清楚。每个页面上的每个设置，说的都是这里的某一条。

${TERMS.map(
  (t) =>
    `## ${t.term}\n\n${t.body}${
      t.see
        ? `\n\n参见 [${TOOLS.find((x) => x.slug === t.see)?.name}](${SITE.url}/${t.see}.md)。`
        : ""
    }`,
).join("\n\n")}

## 站点地图

- [所有页面，按分区排列](${SITE.url}/sitemap.md)
`,
);

await write(
  "history.md",
  `---
title: "历史记录 — ${SITE.name}"
description: "你最近的结果，只保存在这个浏览器里。"
url: "${SITE.url}/history.md"
last_updated: "${now}"
doc_version: "1"
---

# 历史记录

你生成的每个结果都保存在这个浏览器里——索引在 localStorage，文件本身在 IndexedDB。
不上传任何东西，所以列表是按浏览器、按设备分开的，清除站点数据就会清空。

## 在这里能做什么

- 用原来的文件名重新下载任何历史结果。
- 删除单条记录，或者清空整个历史。
- 查看每个文件是哪个工具生成的、什么时候生成的。

## 站点地图

- [所有页面，按分区排列](${SITE.url}/sitemap.md)
`,
);

/* ── AGENTS.md (served copy) ───────────────────────────────────────────── */
await write("AGENTS.md", await readFile(join(process.cwd(), "AGENTS.md"), "utf8"));

console.log(`\ngenerated agent files for ${TOOLS.length} tools`);

/* ── canonical Link headers for the markdown mirrors ───────────────────── */
// Cloudflare Pages reads out/_headers; one rule per mirror points agents at
// the HTML page each .md duplicates.
const mirrors = [
  ...TOOLS.map((t) => [`/${t.slug}.md`, `${SITE.url}/${t.slug}/`]),
  ["/index.md", `${SITE.url}/`],
  ["/glossary.md", `${SITE.url}/glossary/`],
  ["/history.md", `${SITE.url}/history/`],
  ["/sitemap.md", `${SITE.url}/sitemap.md`],
  ["/AGENTS.md", `${SITE.url}/AGENTS.md`],
];
const headersPath = join(OUT, "_headers");
const existing = await readFile(headersPath, "utf8");
await writeFile(
  headersPath,
  `${existing.trimEnd()}\n\n${mirrors
    .map(([path, canonical]) => `${path}\n  Link: <${canonical}>; rel="canonical"`)
    .join("\n\n")}\n`,
  "utf8",
);
console.log(`added canonical Link headers for ${mirrors.length} markdown mirrors`);
