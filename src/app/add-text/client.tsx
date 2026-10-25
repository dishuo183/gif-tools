"use client";
import * as React from "react";
import { ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif } from "@/lib/engines/gif-encode";
import { MAX_FRAMES, useFrames } from "@/lib/preview";
import { FACES, faceOptions, useFace, type FaceId } from "@/lib/fonts";
import { getTool } from "@/lib/tools";
import { wrapText } from "@/lib/text-layout";

const tool = getTool("add-text");

type Mode = "overlay" | "bar";

interface Style {
  top: string;
  bottom: string;
  fontSize: number;
  color: string;
  outline: string;
  outlineWidth: number;
  mode: Mode;
  barColor: string;
  face: FaceId;
}

const font = (size: number, face: FaceId) => `bold ${size}px ${FACES[face].family}`;

/** Draw one frame plus its captions. Returns the canvas it drew into. */
function compose(canvas: HTMLCanvasElement, img: HTMLImageElement, s: Style) {
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const measure = canvas.getContext("2d", { willReadFrequently: true });
  if (!measure) throw new Error("浏览器未能提供 2D 画布上下文。");
  measure.font = font(s.fontSize, s.face);

  const pad = Math.round(s.fontSize * 0.35);
  const lineHeight = s.fontSize * 1.15;
  const topLines = wrapText(measure, s.top, w - pad * 2);
  const bottomLines = wrapText(measure, s.bottom, w - pad * 2);
  const barHeight = (n: number) =>
    s.mode === "bar" && n ? Math.round(n * lineHeight + pad * 2) : 0;
  const topBar = barHeight(topLines.length);
  const bottomBar = barHeight(bottomLines.length);

  canvas.width = w;
  canvas.height = h + topBar + bottomBar;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("浏览器未能提供 2D 画布上下文。");

  if (s.mode === "bar") {
    ctx.fillStyle = s.barColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, topBar, w, h);

  ctx.font = font(s.fontSize, s.face);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.outlineWidth * 2;
  ctx.strokeStyle = s.outline;
  ctx.fillStyle = s.color;

  const paint = (lines: string[], startY: number) =>
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      if (s.outlineWidth > 0) ctx.strokeText(line, w / 2, y);
      ctx.fillText(line, w / 2, y);
    });

  paint(topLines, s.mode === "bar" ? pad : topBar + pad);
  paint(
    bottomLines,
    s.mode === "bar"
      ? canvas.height - bottomBar + pad
      : canvas.height - pad - bottomLines.length * lineHeight,
  );

  return ctx;
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const { frames, delay, reading, truncated } = useFrames(file, setError, setProgress);
  const [frameDelay, setFrameDelay] = React.useState(100);
  React.useEffect(() => setFrameDelay(delay), [delay]);
  const [style, setStyle] = React.useState<Style>({
    top: "在下不才",
    bottom: "只想做个梗图",
    fontSize: 36,
    color: "#ffffff",
    outline: "#000000",
    outlineWidth: 3,
    mode: "overlay",
    barColor: "#ffffff",
    face: "impact",
  });
  const set = <K extends keyof Style>(k: K, v: Style[K]) =>
    setStyle((prev) => ({ ...prev, [k]: v }));

  const go = () =>
    run("正在添加文字", async () => {
      if (!frames.length) throw new Error("请先选择一个 GIF 或图片。");
      const canvas = document.createElement("canvas");
      const images: ImageData[] = [];
      frames.forEach((img, i) => {
        const ctx = compose(canvas, img, style);
        images.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        setProgress(((i + 1) / frames.length) * 0.8);
      });
      const data = encodeGif(images, { delayMs: frameDelay, loop: 0, transparent: false });
      setProgress(1);
      publish({
        data,
        ext: "gif",
        note: `${style.mode} · ${style.fontSize}px · ${frames.length} frames`,
      });
    });

  const fontReady = useFace(style.face);
  useAutoRun(go, [frames, frameDelay, style], frames.length > 0 && !reading && fontReady);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="at-top">顶部文字</Label>
          <Input id="at-top" value={style.top} onChange={(e) => set("top", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="at-bottom">底部文字</Label>
          <Input
            id="at-bottom"
            value={style.bottom}
            onChange={(e) => set("bottom", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="at-mode">位置</Label>
          <Select
            id="at-mode"
            value={style.mode}
            onChange={(e) => set("mode", e.target.value as Mode)}
          >
            <option value="overlay">叠加 — 文字直接压在画面上</option>
            <option value="bar">字幕条 — 在画面上方或下方加实色条</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="at-font">字体</Label>
          <Select
            id="at-font"
            value={style.face}
            onChange={(e) => set("face", e.target.value as FaceId)}
          >
            {faceOptions("impact")}
          </Select>
        </div>
        <Range
          label="字号"
          suffix="px"
          min={8}
          max={160}
          step={1}
          value={style.fontSize}
          onChange={(e) => set("fontSize", Number(e.target.value))}
        />
        <ColorField
          id="at-color"
          label="文字颜色"
          value={style.color}
          onChange={(v) => set("color", v)}
        />
        <ColorField
          id="at-outline"
          label="描边颜色"
          value={style.outline}
          onChange={(v) => set("outline", v)}
        />
        <Range
          label="描边宽度"
          suffix="px"
          min={0}
          max={12}
          step={1}
          value={style.outlineWidth}
          onChange={(e) => set("outlineWidth", Number(e.target.value))}
        />
        {style.mode === "bar" ? (
          <ColorField
            id="at-bar"
            label="字幕条颜色"
            value={style.barColor}
            onChange={(v) => set("barColor", v)}
          />
        ) : null}
      </div>

      {truncated ? (
        <p role="status" className="text-ui text-[hsl(var(--smui-yellow))]">
          该文件的帧数超过 {MAX_FRAMES} 帧，仅对前 {MAX_FRAMES} 帧添加文字。
        </p>
      ) : null}
    </>
  );
}

export default function AddTextTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp"
      defaultName="captioned"
      hint="帧由 ffmpeg 解码，在画布上添加文字后重新编码为 GIF。预览会随输入实时更新。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
