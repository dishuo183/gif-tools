# statico's GIF tools

> [!NOTE]
> Every line of this project — the site, the tests and the documentation — was
> written by [Claude Code](https://claude.com/claude-code).

> 界面默认中文。中文文案集中在 `src/lib/tools.ts`、`src/lib/glossary.ts` 和
> 各个 `src/app/<slug>/client.tsx` 里，直接改字面量即可。

A GIF toolkit that runs entirely in your browser: convert, resize, crop, cut,
optimize and caption GIFs, and build Slack emoji. ffmpeg, gifsicle and
ImageMagick are compiled to WebAssembly and run in the page.

Nothing is uploaded. There is no API, no account and no server-side processing.

Live at [gif.statico.io](https://gif.statico.io).

## 本地运行（Windows）

需要 Node 24（`.node-version` 指定）；pnpm 由 `packageManager` 固定为 11.24.0，
建议用 `corepack enable` 让 Node 自己选版本。

```powershell
pnpm install          # 安装依赖，第一次要下载 ffmpeg/ImageMagick 的 wasm，合计约 100MB
pnpm dev              # 开发模式，打开 http://localhost:3000
```

只在本机使用、不需要改代码时，用生产构建更接近线上表现：

```powershell
pnpm build            # 静态导出到 out/，并生成 llms.txt、sitemap.md 等
pnpm start            # 用 serve 托管 out/，还是 http://localhost:3000
```

要点：

- `prebuild` 会把 `@ffmpeg/core` 和 `@magick/magick-wasm` 的二进制复制到
  `public/`，并给 ffmpeg 的 worker 打补丁；这一步不能跳过。
- 字体已改为自托管（`src/app/jetbrains-mono-latin.woff2`），构建过程不需要访问
  Google Fonts；运行时所有资源同源，断网也能用。
- 首次打开需要 ffmpeg 的工具（转换、裁剪、倒放等）会懒加载约 31MB 的 wasm
  核心，第一次会慢几秒，之后走缓存。
- 如果 `pnpm install` 报 `ECONNREFUSED`，检查 `~/.npmrc` 里的 `proxy` /
  `https-proxy` 是否指向一个没在运行的端口（例如 `127.0.0.1:7890`），临时清掉
  这两行或换一个可用代理即可。

## Tools

**Convert** — video to GIF, GIF to MP4/WebM, GIF maker from images, format
conversion, frame splitting.

**Edit** — resize, crop, cut, speed, reverse and boomerang, rotate and flip,
captions, effects and colour adjustment.

**Optimize** — gifsicle GIF compression, still-image compression.

**Emoji** — intensifies, party parrot, the animated emoji effect pack, the
100-style number generator, and square text emoji for Slack.

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # static export to out/
pnpm test           # Playwright, against the built export
pnpm typecheck
```

`predev`/`prebuild` copy the WebAssembly binaries out of `node_modules` into
`public/`, so they are served same-origin. Nothing is vendored: ffmpeg,
gifsicle and ImageMagick all arrive as npm packages, and `public/ffmpeg/` and
`public/magick/` are generated and git-ignored.

`pnpm-workspace.yaml` sets `minimumReleaseAge`, so `pnpm install` refuses any
release younger than a week.

## Deployment

Cloudflare Pages:

| Setting          | Value                       |
| ---------------- | --------------------------- |
| Build command    | `pnpm build`                |
| Output directory | `out`                       |
| Node version     | 24 (set by `.node-version`) |

Node 24 is not optional: the postbuild script imports `src/lib/tools.ts`
directly, which needs native TypeScript support.

To deploy from a checkout instead of from Git:

```bash
pnpm run deploy     # `run` is required: pnpm has its own `deploy` command
```

`public/_headers` sets caching for the WebAssembly binaries and the correct
content types for the Markdown mirrors, and is copied into the export. The
postbuild appends a canonical `Link` header for each Markdown mirror.

`functions/_middleware.js` deploys alongside the static export and serves the
`.md` mirror to clients that send `Accept: text/markdown`. It falls through to
the static asset on any error.

## Notes

The ffmpeg core is around 32MB and loads on demand, only on pages that need
it. The single-threaded build is used deliberately so the site needs no
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers and no
`SharedArrayBuffer`; the trade-off is encode speed.

See [AGENTS.md](./AGENTS.md) for architecture and conventions.

## License

MIT — see [LICENSE](./LICENSE).
