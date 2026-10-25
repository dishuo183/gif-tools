"use client";
import * as React from "react";
import { Checkbox, Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("convert");

type Target = "gif" | "png" | "jpg" | "webp" | "apng" | "bmp";

const TARGETS: { value: Target; label: string; animated: boolean; quality: boolean }[] = [
  { value: "gif", label: "GIF —— 动图", animated: true, quality: false },
  { value: "webp", label: "WebP —— 动图或静图", animated: true, quality: true },
  { value: "apng", label: "APNG —— 动图 PNG", animated: true, quality: false },
  { value: "png", label: "PNG —— 静图，无损", animated: false, quality: false },
  { value: "jpg", label: "JPEG —— 静图，有损", animated: false, quality: true },
  { value: "bmp", label: "BMP —— 静图，未压缩", animated: false, quality: false },
];

const ANIMATED_SOURCES = /\.(gif|webp|apng|png|mp4|webm|mov|avi|mkv)$/i;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [target, setTarget] = React.useState<Target>("webp");
  const [quality, setQuality] = React.useState(80);
  const [colors, setColors] = React.useState(256);
  const [animate, setAnimate] = React.useState(true);

  // Dimensions come from the browser decode useFirstFrame already does; probe()
  // would boot the 32MB ffmpeg core just to read two numbers.
  const { size: source } = useFirstFrame(file);

  const spec = TARGETS.find((t) => t.value === target)!;
  // Only offer to keep animation when both sides could actually have it.
  const canAnimate = spec.animated && !!file && ANIMATED_SOURCES.test(file.name);
  const keepAnimation = canAnimate && animate;
  // No scale filter anywhere in this tool, so the pixels come out as they went in.
  const size = source ? `${source.w} × ${source.h} px` : file ? "读取中…" : "—";
  const qualityWords =
    quality >= 90
      ? "接近无损，文件最大"
      : quality >= 70
        ? "细节锐利"
        : quality >= 45
          ? "可见变软"
          : "文件小，有块状感";
  const readout: [string, string][] = [
    ["尺寸", size],
    ["格式", `.${target}`],
    [
      "动画",
      keepAnimation ? "源文件多于 1 帧时保留" : "仅保留第一帧",
    ],
  ];
  if (spec.quality) readout.push(["质量", `${quality} —— ${qualityWords}`]);
  // The single-frame GIF path has no palettegen stage, so `colors` does nothing there.
  else if (target === "gif")
    readout.push(["颜色", keepAnimation ? `最多 ${colors}` : "单帧不使用"]);

  const go = () =>
    run(`正在转换为 ${target.toUpperCase()}`, async () => {
      if (!file) throw new Error("请先选择图片。");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const still = keepAnimation ? [] : ["-frames:v", "1"];
      // JPEG's q:v runs 2 (best) to 31 (worst) — invert the friendly slider.
      const jpegQ = Math.round(31 - (quality / 100) * 29);

      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        `out.${target}`,
        ({ input, output }) => {
          switch (target) {
            case "gif":
              return keepAnimation
                ? paletteGifArgs({ input, output, filters: "null", colors })
                : ["-i", input, "-frames:v", "1", "-f", "gif", output];
            case "webp":
              return keepAnimation
                ? [
                    "-i",
                    input,
                    "-c:v",
                    "libwebp_anim",
                    "-loop",
                    "0",
                    "-quality",
                    String(quality),
                    output,
                  ]
                : ["-i", input, ...still, "-c:v", "libwebp", "-quality", String(quality), output];
            case "apng":
              return keepAnimation
                ? ["-i", input, "-f", "apng", "-plays", "0", output]
                : ["-i", input, ...still, "-f", "apng", output];
            case "jpg":
              return ["-i", input, ...still, "-q:v", String(jpegQ), output];
            case "png":
            case "bmp":
              return ["-i", input, ...still, output];
          }
        },
        { onProgress: setProgress },
      );

      publish({
        data: out,
        ext: target,
        note: `${ext} → ${target}${keepAnimation ? "（动图）" : ""}`,
      });
    });

  useAutoRun(go, [file, target, quality, colors, animate], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cv-target">输出格式</Label>
          <Select
            id="cv-target"
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
          >
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {spec.quality ? (
          <Range
            label="质量"
            min={1}
            max={100}
            step={1}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        ) : target === "gif" ? (
          <Range
            label="最大颜色数"
            min={2}
            max={256}
            step={2}
            value={colors}
            onChange={(e) => setColors(Number(e.target.value))}
          />
        ) : null}
      </div>

      {canAnimate ? (
        <Checkbox
          label="保留动画（取消勾选则只保留第一帧）"
          checked={animate}
          onChange={(e) => setAnimate(e.target.checked)}
        />
      ) : (
        <p role="status" aria-live="polite" className="text-label text-muted-foreground">
          {spec.animated
            ? "该输出格式支持动画，但源文件是静态图片。"
            : `${target.toUpperCase()} 是静态格式，只保留第一帧。`}
        </p>
      )}

      <Readout rows={readout} />
    </>
  );
}

export default function ConvertTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,image/bmp,image/apng,video/*"
      defaultName="converted"
      hint="只要源文件和目标格式都支持动画，动画就会保留。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
