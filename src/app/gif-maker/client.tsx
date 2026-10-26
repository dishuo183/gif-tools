"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoryPicker } from "@/components/history-picker";
import { ColorField, Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";
import { clamp } from "@/lib/utils";

const tool = getTool("gif-maker");

interface Frame {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
}

type Fit = "contain" | "cover" | "stretch";

/** Where to draw `img` inside a w×h canvas for the chosen fit mode. */
function placement(img: HTMLImageElement, w: number, h: number, fit: Fit) {
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  if (fit === "stretch") return { x: 0, y: 0, w, h };
  const scale = fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

/** Output size: the first frame's aspect ratio at the chosen width. */
function outputSize(frames: Frame[], width: number) {
  const w = clamp(Math.round(width), 16, 2000);
  const first = frames[0]?.img;
  const ratio = first ? (first.naturalHeight || 1) / (first.naturalWidth || 1) : 1;
  return { w, h: Math.max(1, Math.round(w * ratio)) };
}

/** Draw one frame exactly as the encode will. Preview and export share this. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  frames: Frame[],
  i: number,
  w: number,
  h: number,
  fit: Fit,
  bg: string,
) {
  ctx.clearRect(0, 0, w, h);
  if (fit === "contain" && bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  const p = placement(frames[i].img, w, h, fit);
  ctx.drawImage(frames[i].img, p.x, p.y, p.w, p.h);
}

/**
 * Files from a drop, descending into dropped folders. Folder contents come
 * back sorted numerically (frame2 before frame10) since that's the frame order
 * anyone exporting a sequence expects; loose files keep their drop order.
 */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items, (i) => i.webkitGetAsEntry?.() ?? null);
  if (!entries.some(Boolean)) return Array.from(dt.files);
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { numeric: true });
  const walk = async (entry: FileSystemEntry | null): Promise<File[]> => {
    if (!entry) return [];
    if (entry.isFile) {
      return [await new Promise<File>((ok, err) => (entry as FileSystemFileEntry).file(ok, err))];
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries returns in batches (Chrome caps at 100); drain it.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((ok, err) => reader.readEntries(ok, err));
      if (!batch.length) break;
      children.push(...batch);
    }
    children.sort(byName);
    const out: File[] = [];
    for (const c of children) out.push(...(await walk(c)));
    return out;
  };
  const out: File[] = [];
  for (const e of entries) out.push(...(await walk(e)));
  return out;
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [frames, setFrames] = React.useState<Frame[]>([]);
  const [delay, setDelay] = React.useState(700);
  const [loop, setLoop] = React.useState(0);
  const [width, setWidth] = React.useState(1340);
  const [fit, setFit] = React.useState<Fit>("contain");
  const [bg, setBg] = React.useState("#000000");
  const [dragging, setDragging] = React.useState(false);
  // Index of the frame card being dragged, and the slot it is hovering over.
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = React.useCallback(
    async (list: FileList | File[] | null) => {
      const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) {
        setError("这些文件不是图片。请选择 PNG、JPEG、WebP 或 GIF 文件。");
        return;
      }
      setError(null);
      // Keep whatever decoded: one bad file in a drop of ten used to throw the
      // other nine away and strand their object URLs for the life of the tab.
      const added: Frame[] = [];
      const failed: string[] = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        try {
          added.push({
            id: `${f.name}-${Date.now()}-${Math.random()}`,
            name: f.name,
            url,
            img: await loadImage(f),
          });
        } catch {
          URL.revokeObjectURL(url);
          failed.push(f.name);
        }
      }
      if (added.length) setFrames((prev) => [...prev, ...added]);
      if (failed.length) setError(`无法读取 ${failed.join("、")}。`);
    },
    [setError],
  );

  const reorder = (from: number, to: number) =>
    setFrames((prev) => {
      if (from === to || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [f] = next.splice(from, 1);
      next.splice(to, 0, f);
      return next;
    });
  const move = (i: number, dir: -1 | 1) => reorder(i, i + dir);

  // A file handed over from another tool (or pasted) arrives via the shell.
  React.useEffect(() => {
    if (file) void addFiles([file]);
  }, [file, addFiles]);
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // Loop the assembled animation at the real frame delay, so reordering a
  // frame or changing the fit shows up immediately rather than after an encode.
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { w: outW, h: outH } = outputSize(frames, width);
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !frames.length) return;
    let i = 0;
    const paint = () => drawFrame(ctx, frames, i % frames.length, outW, outH, fit, bg);
    paint();
    if (frames.length === 1) return;
    const id = setInterval(
      () => {
        i += 1;
        paint();
      },
      clamp(Math.round(delay), 20, 5000),
    );
    return () => clearInterval(id);
  }, [frames, outW, outH, fit, bg, delay]);

  // Unmounting must release every object URL; individual deletes only cover one.
  const framesRef = React.useRef(frames);
  framesRef.current = frames;
  React.useEffect(() => () => framesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const remove = (i: number) =>
    setFrames((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, k) => k !== i);
    });

  const go = () =>
    run("正在生成 GIF", async () => {
      if (!frames.length) throw new Error("请先添加至少一张图片。");
      const { w, h } = outputSize(frames, width);
      const ms = clamp(Math.round(delay), 20, 5000);

      setProgress(0.3);
      const imageData = renderFrames({ width: w, height: h }, frames.length, (ctx, _t, i) =>
        drawFrame(ctx, frames, i, w, h, fit, bg),
      );
      setProgress(0.7);
      const data = encodeGif(imageData, {
        delayMs: ms,
        loop: clamp(Math.round(loop), 0, 65535),
        transparent: !bg,
      });
      setProgress(1);
      publish({
        data,
        ext: "gif",
        note: `${frames.length} 帧 · ${ms}ms · ${w}px · ${fit}`,
      });
    });

  useAutoRun(go, [frames, delay, loop, width, fit, bg], frames.length > 0);
  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          // A frame card dragged over this zone is not a file drop.
          if (e.dataTransfer.types.includes("Files")) {
            void filesFromDrop(e.dataTransfer).then(addFiles);
          }
        }}
        className={`border border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-accent" : "border-border"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          id="gif-maker-files"
          aria-label="选择要制作成 GIF 帧的图片"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-ui text-foreground mb-1">把多张图片或一个文件夹拖到这里</p>
        <p className="text-label text-muted-foreground mb-3">
          它们会按添加顺序成为帧，也可以直接粘贴，文件不会离开你的设备
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            选择图片
          </Button>
          <HistoryPicker label="从历史记录添加" onPick={(f) => void addFiles([f])} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0" id="gif-maker-frames-label">
            帧
          </Label>
          <span className="text-label text-muted-foreground tabular-nums" aria-live="polite">
            已添加 {frames.length} 帧
          </span>
        </div>
        {frames.length ? (
          <ul
            aria-labelledby="gif-maker-frames-label"
            className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-1.5"
          >
            {frames.map((f, i) => (
              <li
                key={f.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragFrom(i);
                }}
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) reorder(dragFrom, i);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`group relative border bg-smui-surface-0 p-1 cursor-grab active:cursor-grabbing ${
                  dragOver === i && dragFrom !== i ? "border-primary" : "border-border"
                } ${dragFrom === i ? "opacity-40" : ""}`}
              >
                <img
                  src={f.url}
                  alt=""
                  draggable={false}
                  className="checkerboard aspect-square w-full object-contain"
                />
                <span className="absolute top-1 left-1 bg-background/80 px-1 text-label text-foreground tabular-nums">
                  {i + 1}
                </span>
                <span
                  className="block truncate text-label text-muted-foreground mt-1"
                  title={f.name}
                >
                  {f.name}
                </span>
                <span className="absolute top-1 right-1 flex gap-px opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 bg-background/90"
                    aria-label={`将第 ${i + 1} 帧前移`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 bg-background/90"
                    aria-label={`将第 ${i + 1} 帧后移`}
                    disabled={i === frames.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 bg-background/90"
                    aria-label={`删除第 ${i + 1} 帧`}
                    onClick={() => remove(i)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui text-muted-foreground">还没有帧。</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="gm-delay">帧延迟（ms）</Label>
          <Input
            id="gm-delay"
            type="number"
            min={20}
            max={5000}
            step={10}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="gm-loop">循环次数（0 = 无限）</Label>
          <Input
            id="gm-loop"
            type="number"
            min={0}
            max={100}
            step={1}
            value={loop}
            onChange={(e) => setLoop(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="gm-width">输出宽度（px）</Label>
          <Input
            id="gm-width"
            type="number"
            min={16}
            max={2000}
            step={1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            aria-describedby="gm-width-hint"
          />
          <p id="gm-width-hint" className="text-label text-muted-foreground mt-1">
            高度按第一帧的比例自动计算。
          </p>
        </div>
        <div>
          <Label htmlFor="gm-fit">适配方式</Label>
          <Select id="gm-fit" value={fit} onChange={(e) => setFit(e.target.value as Fit)}>
            <option value="contain">完整显示 —— 留边填充</option>
            <option value="cover">填满画面 —— 裁剪边缘</option>
            <option value="stretch">拉伸变形 —— 适配目标尺寸</option>
          </Select>
        </div>
      </div>

      {fit === "contain" ? (
        <ColorField id="gm-bg" label="背景颜色" value={bg} onChange={setBg} clearable />
      ) : null}

      <div>
        <Label>实时预览</Label>
        <div className="checkerboard flex min-h-32 items-center justify-center border border-border p-3">
          {frames.length ? (
            <canvas
              ref={canvasRef}
              width={outW}
              height={outH}
              role="img"
              aria-label={`循环预览：共 ${frames.length} 帧，${outW} × ${outH} 像素`}
              className="max-h-60 max-w-full"
            />
          ) : (
            <p className="text-ui text-muted-foreground">添加图片后即可预览。</p>
          )}
        </div>
        {frames.length ? (
          <p className="text-label text-muted-foreground tabular-nums mt-1">
            {`${outW} × ${outH} · ${frames.length} 帧 · 每帧 ${Math.max(
              20,
              Math.round(delay),
            )}ms · 共 ${(Math.max(20, Math.round(delay)) * frames.length) / 1000} s`}
          </p>
        ) : null}
      </div>
    </>
  );
}

export default function GifMakerTool() {
  return (
    <ToolShell
      tool={tool}
      requiresFile={false}
      defaultName="animation"
      hint="添加图片，按想要的顺序排列，然后设置帧延迟。每一帧都会用你选择的适配方式绘制成相同尺寸。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
