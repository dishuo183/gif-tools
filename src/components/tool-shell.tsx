"use client";
import * as React from "react";
import { AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { HistoryPicker } from "@/components/history-picker";
import { usePublishCarry, type Carry } from "@/components/tool-strip";
import { download, mimeFor } from "@/lib/download";
import { addToHistory, loadSource, sourceIdFromHash, stashSource } from "@/lib/history";
import { cn, formatBytes, gifInfo, slackSlug, slugify, type GifInfo } from "@/lib/utils";
import type { Tool } from "@/lib/tools";

export interface ToolResult {
  data: Uint8Array;
  /** Extension without the dot, e.g. "gif". */
  ext: string;
  /** Optional summary of the settings, shown in history. */
  note?: string;
  /** Overrides the preview mime if it differs from the extension. */
  mime?: string;
}

/** Everything a tool body needs from the shell. */
export interface ToolBodyProps {
  file: File | null;
  setBusy: (busy: boolean, message?: string) => void;
  setProgress: (ratio: number) => void;
  setError: (message: string | null) => void;
  /** Publish a result: shows the preview, enables download, saves to history. */
  publish: (result: ToolResult) => void;
}

interface ToolShellProps {
  tool: Tool;
  /** MIME/extension hints for the file picker. Omit for generator tools. */
  accept?: string;
  /** Generators (number, text emoji) need no input file. */
  requiresFile?: boolean;
  /** Default download filename stem. */
  defaultName?: string;
  /**
   * Live suggestion for the filename stem — generators pass the text the user
   * is typing. It only overwrites the field while the user hasn't edited it
   * themselves, so a deliberate name is never clobbered.
   */
  suggestedName?: string;
  /** Extension shown in the filename hint before anything is generated. */
  suggestedExt?: string;
  children: (props: ToolBodyProps) => React.ReactNode;
  /** Short usage note rendered under the heading. */
  hint?: React.ReactNode;
}

export function ToolShell({
  tool,
  accept = "image/gif,image/png,image/jpeg,image/webp,video/*",
  requiresFile = true,
  defaultName,
  suggestedName,
  suggestedExt,
  children,
  hint,
}: ToolShellProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ToolResult | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [busy, setBusyState] = React.useState(false);
  const [busyMessage, setBusyMessage] = React.useState<string>();
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(defaultName ?? tool.slug);
  const [nameEdited, setNameEdited] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  // Most runs finish in well under a second; only show the spinner past that.
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    if (!busy) return setSlow(false);
    const t = setTimeout(() => setSlow(true), 1000);
    return () => clearTimeout(t);
  }, [busy]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Slack 只接受 ASCII 表情名，其余工具允许中文文件名。
  const toSlug = React.useCallback(
    (value: string, fallback: string) =>
      tool.category === "emoji" ? slackSlug(value, fallback) : slugify(value, fallback),
    [tool.category],
  );

  // Object URLs are revoked whenever they're replaced, so long sessions with
  // many runs don't pin every previous result in memory.
  React.useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );
  React.useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );

  React.useEffect(() => {
    if (nameEdited) return;
    const next = toSlug(suggestedName ?? "", "");
    if (next) setName(next);
  }, [suggestedName, nameEdited, toSlug]);

  const setBusy = React.useCallback((b: boolean, message?: string) => {
    setBusyState(b);
    setBusyMessage(message);
    if (!b) setProgress(0);
  }, []);

  const publish = React.useCallback((r: ToolResult) => {
    const mime = r.mime ?? mimeFor(`x.${r.ext}`);
    const blob = new Blob([r.data.slice().buffer as ArrayBuffer], { type: mime });
    setResult(r);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }, []);

  // Id of the stashed copy the URL hash points at, so back/forward can reload it.
  const sourceId = React.useRef<string | null>(null);
  const onPick = React.useCallback(
    (f: File | null, id?: string) => {
      if (!f) return;
      if (id) sourceId.current = id;
      else
        void stashSource(f, f.name).then((sid) => {
          if (!sid) return;
          sourceId.current = sid;
          window.history.replaceState(window.history.state, "", `#s=${sid}`);
        });
      setFile(f);
      setResult(null);
      setError(null);
      // The old result's preview URL outlives `result`, so without this the panel
      // keeps showing file A's image under a blank extension and a dead button.
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setSourceUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(f);
      });
      // Seed the download name from the source so it stays recognisable — but
      // never over a name the user typed on purpose.
      const stem = f.name.replace(/\.[^.]+$/, "");
      if (stem && !nameEdited) setName(toSlug(stem, tool.slug));
    },
    [tool.slug, nameEdited, toSlug],
  );

  // The URL hash names the file: on load, and whenever back/forward changes it.
  React.useEffect(() => {
    const sync = () => {
      const id = sourceIdFromHash(window.location.hash);
      if (!id || id === sourceId.current) return;
      void loadSource(id).then((f) => f && onPick(f, id));
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [onPick]);

  // Pasting an image anywhere on the page loads it, like a drop would.
  React.useEffect(() => {
    if (!requiresFile) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (f) onPick(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [requiresFile, onPick]);

  const resultMime = result ? (result.mime ?? mimeFor(`x.${result.ext}`)) : null;
  const carry = React.useMemo<Carry | null>(
    () =>
      file || result
        ? {
            source: file ? { file, url: file.type.startsWith("image/") ? sourceUrl : null } : null,
            result: result
              ? {
                  file: new File(
                    [result.data.slice().buffer as ArrayBuffer],
                    `${slugify(name, tool.slug)}.${result.ext}`,
                    { type: resultMime ?? "application/octet-stream" },
                  ),
                  url: resultMime?.startsWith("image/") ? previewUrl : null,
                }
              : null,
          }
        : null,
    [result, resultMime, name, tool.slug, previewUrl, file, sourceUrl],
  );
  usePublishCarry(carry);
  const sourceSize = useMediaSize(sourceUrl, file?.type ?? null);
  const resultSize = useMediaSize(previewUrl, resultMime);
  const sourceGif = useGifInfo(file);
  const resultGif = useGifInfo(result?.data ?? null);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start">
        <div className="grid gap-4 min-w-0">
          {requiresFile ? (
            <Card>
              <CardHeader>
                <CardTitle>源文件</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    onPick(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`border border-dashed p-6 text-center transition-colors ${
                    dragging ? "border-primary bg-accent" : "border-border"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    className="sr-only"
                    id={`${tool.slug}-file`}
                    aria-label={`为 ${tool.name} 选择文件`}
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  />
                  <Upload
                    className="mx-auto mb-2 size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-ui text-foreground mb-1">
                    {file ? file.name : "把文件拖到这里"}
                  </p>
                  {file ? (
                    <Facts
                      size={sourceSize}
                      ext={file.name.split(".").pop() ?? ""}
                      bytes={file.size}
                      gif={sourceGif}
                      className="mx-auto mb-3 w-fit justify-items-center text-left"
                    />
                  ) : (
                    <p className="text-label text-muted-foreground mb-3">
                      也可以选择文件、粘贴图片，或从历史记录里挑——文件不会离开你的设备
                    </p>
                  )}
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                      {file ? "换一个文件" : "选择文件"}
                    </Button>
                    <HistoryPicker onPick={onPick} video={accept.includes("video")} />
                  </div>
                </div>

                {sourceUrl && file?.type.startsWith("image/") ? (
                  <img
                    src={sourceUrl}
                    alt={`源文件预览：${file.name}`}
                    className="mt-3 max-h-64 mx-auto border border-border"
                  />
                ) : null}
                {sourceUrl && file?.type.startsWith("video/") ? (
                  <video
                    src={sourceUrl}
                    controls
                    className="mt-3 max-h-64 mx-auto border border-border"
                  />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>设置</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {hint ? <p className="text-ui text-muted-foreground">{hint}</p> : null}
              {children({ file, setBusy, setProgress, setError, publish })}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-16">
          <CardHeader>
            <CardTitle>结果</CardTitle>
            {busy ? (
              <span className="text-label text-[hsl(var(--smui-yellow))] tracking-wider uppercase">
                处理中
              </span>
            ) : result ? (
              <span className="text-label text-[hsl(var(--smui-green))] tracking-wider uppercase">
                已完成
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            <div
              role="status"
              aria-live="polite"
              aria-busy={busy}
              className="relative min-h-40 flex flex-col items-center justify-center gap-2 border border-border bg-smui-surface-0 p-3"
            >
              {slow ? (
                <div className="absolute inset-0 z-10 grid place-items-center bg-smui-surface-0/80 text-center">
                  <div>
                    <Loader2
                      className="mx-auto mb-2 size-5 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    <p className="text-ui text-foreground">{busyMessage ?? "处理中"}</p>
                    <p className="text-label text-muted-foreground tabular-nums">
                      {Math.round(progress * 100)}%
                    </p>
                  </div>
                </div>
              ) : null}
              {previewUrl && resultMime?.startsWith("video/") ? (
                <video src={previewUrl} controls loop className="max-h-72 max-w-full" />
              ) : previewUrl && resultMime?.startsWith("image/") ? (
                <img
                  src={previewUrl}
                  alt={`${tool.name}的结果`}
                  className="max-h-72 max-w-full"
                />
              ) : previewUrl ? (
                <p className="text-ui text-muted-foreground">
                  {result?.ext.toUpperCase()} 已可下载
                </p>
              ) : (
                <p className="text-ui text-muted-foreground text-center">
                  {busy
                    ? (busyMessage ?? "处理中")
                    : requiresFile
                      ? "选择文件后开始。"
                      : "还没有结果。"}
                </p>
              )}
            </div>
            {previewUrl && tool.category === "emoji" && resultMime?.startsWith("image/") ? (
              <div className="flex items-center gap-2" title="在 Slack 的 22px 下看起来如何">
                {(["#ffffff", "#1a1d21"] as const).map((bg) => (
                  <span
                    key={bg}
                    className="grid size-11 place-items-center border border-border"
                    style={{ background: bg }}
                  >
                    <img src={previewUrl} alt="" className="size-[22px] object-contain" />
                  </span>
                ))}
                <span className="text-label text-muted-foreground">
                  Slack 尺寸，深色与浅色背景
                </span>
              </div>
            ) : null}
            {result ? (
              <Facts
                size={resultSize}
                ext={result.ext}
                bytes={result.data.length}
                gif={resultGif}
                note={result.note}
              />
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex gap-2 border border-destructive/40 bg-destructive/5 p-2.5 text-ui text-foreground"
              >
                <AlertTriangle
                  className="size-4 shrink-0 text-destructive mt-0.5"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            ) : null}

            <div>
              <Label htmlFor={`${tool.slug}-name`}>文件名</Label>
              <div className="flex gap-2">
                <Input
                  id={`${tool.slug}-name`}
                  value={name}
                  spellCheck={false}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameEdited(true);
                  }}
                  aria-describedby={`${tool.slug}-name-hint`}
                />
                <span className="flex items-center text-ui text-muted-foreground">
                  .{result?.ext ?? suggestedExt ?? "gif"}
                </span>
              </div>
              <p id={`${tool.slug}-name-hint`} className="text-label text-muted-foreground mt-1">
                保存为{" "}
                <code className="text-foreground">
                  {toSlug(name, tool.slug)}.{result?.ext ?? suggestedExt ?? "gif"}
                </code>
                {tool.category === "emoji" ? "——符合 Slack 表情命名规则。" : "。"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!result}
                onClick={() => {
                  if (!result) return;
                  const filename = `${toSlug(name, tool.slug)}.${result.ext}`;
                  download(result.data, filename, resultMime ?? undefined);
                  const mime = resultMime ?? "application/octet-stream";
                  void addToHistory(
                    { tool: tool.slug, toolName: tool.name, filename, mime, note: result.note },
                    new Blob([result.data.slice().buffer as ArrayBuffer], { type: mime }),
                  );
                }}
              >
                <Download aria-hidden="true" />
                下载{result ? ` · ${formatBytes(result.data.length)}` : ""}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Wraps a tool action with busy/error plumbing so pages don't repeat it. */
/**
 * Natural pixel size of whatever is at `url`. Images and videos both report it,
 * just under different property names, and neither is known until it decodes.
 */
function useMediaSize(url: string | null, mime: string | null) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  React.useEffect(() => {
    setSize(null);
    if (!url || !mime) return;
    let live = true;
    if (mime.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => live && setSize({ w: v.videoWidth, h: v.videoHeight });
      v.src = url;
    } else if (mime.startsWith("image/")) {
      const i = new Image();
      i.onload = () => live && setSize({ w: i.naturalWidth, h: i.naturalHeight });
      i.src = url;
    }
    return () => {
      live = false;
    };
  }, [url, mime]);
  return size;
}

/** "128 × 128 · GIF · 25.2 KB", skipping the parts that aren't known yet. */
function useGifInfo(src: Blob | Uint8Array | null) {
  const [info, setInfo] = React.useState<GifInfo | null>(null);
  React.useEffect(() => {
    setInfo(null);
    if (!src) return;
    let live = true;
    const bytes =
      src instanceof Uint8Array
        ? Promise.resolve(src)
        : src.arrayBuffer().then((a) => new Uint8Array(a));
    void bytes.then((b) => live && setInfo(gifInfo(b)));
    return () => {
      live = false;
    };
  }, [src]);
  return info;
}

/** Spec readout for a file: big values in the display face over small labels. */
function Facts({
  size,
  ext,
  bytes,
  gif,
  note,
  className,
}: {
  size: { w: number; h: number } | null;
  ext: string;
  bytes: number;
  gif: GifInfo | null;
  note?: string;
  className?: string;
}) {
  const cells: [string, React.ReactNode][] = [];
  if (size) cells.push(["尺寸", `${size.w} × ${size.h}`]);
  cells.push(["格式", ext.toUpperCase()], ["文件大小", formatBytes(bytes)]);
  if (gif && gif.frames > 1) {
    cells.push(["帧数", gif.frames]);
    cells.push(["时长", `${(gif.duration / 1000).toFixed(1)} 秒`]);
  }
  return (
    <div className={cn("grid gap-2", className)}>
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        {cells.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dd className="font-display text-[15px] leading-tight text-foreground tabular-nums">
              {v}
            </dd>
            <dt className="text-label text-muted-foreground">{k}</dt>
          </div>
        ))}
      </dl>
      {note ? (
        <p className="border-t border-border pt-2 text-label text-muted-foreground tabular-nums">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function useRun(props: Pick<ToolBodyProps, "setBusy" | "setError" | "setProgress">) {
  const { setBusy, setError, setProgress } = props;
  // No tool disables its own button, so a double-click used to start two runs:
  // the first one's cleanup cleared the busy state while the second was still
  // going, and both published, leaving two history entries for one action.
  const running = React.useRef(false);
  // Settings change mid-run: remember only the newest request and run it
  // once the current encode finishes, so a slider drag ends on its final value.
  const pending = React.useRef<[string, () => Promise<void>] | null>(null);
  const run = React.useCallback(
    async (message: string, fn: () => Promise<void>): Promise<void> => {
      if (running.current) {
        pending.current = [message, fn];
        return;
      }
      running.current = true;
      setError(null);
      setBusy(true, message);
      setProgress(0);
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        running.current = false;
        setBusy(false);
      }
      const next = pending.current;
      pending.current = null;
      if (next) void run(...next);
    },
    [setBusy, setError, setProgress],
  );
  return run;
}

/**
 * Runs the tool whenever its settings change (debounced), so there is no
 * "generate" button: `deps` are the settings, `ready` is what the button's
 * disabled state used to check.
 */
export function useAutoRun(go: () => unknown, deps: React.DependencyList, ready = true) {
  const goRef = React.useRef(go);
  goRef.current = go;
  React.useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => void goRef.current(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps]);
}
