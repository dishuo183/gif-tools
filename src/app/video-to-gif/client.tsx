"use client";
import * as React from "react";
import { Checkbox, Input, Label, Range, Readout } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("video-to-gif");

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(5);
  const [fps, setFps] = React.useState(15);
  const [width, setWidth] = React.useState(480);
  const [colors, setColors] = React.useState(256);
  const [dither, setDither] = React.useState(true);
  const [source, setSource] = React.useState<{
    durationSec: number | null;
    width: number | null;
    height: number | null;
  } | null>(null);

  // Read the real duration so the range can be prefilled and clamped.
  React.useEffect(() => {
    if (!file) {
      setSource(null);
      return;
    }
    let cancelled = false;
    setSource(null);
    probe(file)
      .then((info) => {
        if (cancelled) return;
        setSource(info);
        setStart(0);
        setEnd(info.durationSec ? Math.min(info.durationSec, 5) : 5);
        if (info.width) setWidth(Math.min(info.width, 480));
      })
      .catch(() => {
        if (!cancelled) setError("无法读取该视频，可能是不支持的格式。");
      });
    return () => {
      cancelled = true;
    };
  }, [file, setError]);

  const max = source?.durationSec ?? null;
  const duration = Math.max(0, end - start);
  // scale=W:-1 keeps the aspect ratio, so the height ffmpeg picks is this.
  const outHeight =
    source?.width && source?.height ? Math.round((source.height * width) / source.width) : null;
  // -t is clamped by however much video is actually left after -ss.
  const outDuration =
    max == null ? duration : Math.max(0, Math.min(end, max) - Math.min(start, max));

  const go = () =>
    run("正在生成 GIF", async () => {
      if (!file) throw new Error("请先选择视频。");
      if (outDuration <= 0) {
        throw new Error("请选择视频内的范围：结束时间必须晚于开始时间。");
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        "out.gif",
        ({ input, output }) => [
          "-ss",
          String(start),
          "-t",
          String(outDuration),
          ...paletteGifArgs({
            input,
            output,
            filters: `fps=${fps},scale=${width}:-1:flags=lanczos`,
            colors,
            dither: dither ? "bayer:bayer_scale=5" : "none",
          }),
        ],
        { onProgress: setProgress, durationSec: outDuration },
      );
      publish({
        data: out,
        ext: "gif",
        note: `${start}s +${outDuration}s @ ${fps}fps ${width}px ${colors} 种颜色`,
      });
    });

  useAutoRun(go, [file, start, end, fps, width, colors, dither], !!file);
  return (
    <>
      <p role="status" aria-live="polite" className="text-ui text-muted-foreground">
        {file
          ? source
            ? `源文件：宽 ${source.width ?? "?"} px，时长 ${max ? `${max.toFixed(2)} s` : "未知"}。`
            : "正在读取视频…"
          : "尚未选择视频。"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="v2g-start">开始时间（秒）</Label>
          <Input
            id="v2g-start"
            type="number"
            min={0}
            max={max ?? undefined}
            step={0.1}
            value={start}
            onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <Label htmlFor="v2g-end">结束时间（秒）</Label>
          <Input
            id="v2g-end"
            type="number"
            min={0}
            max={max ?? undefined}
            step={0.1}
            value={end}
            onChange={(e) => setEnd(Math.max(0, Number(e.target.value) || 0))}
            aria-describedby="v2g-end-hint"
          />
          <p id="v2g-end-hint" className="text-label text-muted-foreground mt-1">
            {outDuration > 0 ? `${outDuration.toFixed(2)} s 的 GIF` : "结束时间必须晚于开始时间"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Range
          label="帧率"
          suffix=" fps"
          min={5}
          max={30}
          step={1}
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
        />
        <div>
          <Label htmlFor="v2g-width">输出宽度（px）</Label>
          <Input
            id="v2g-width"
            type="number"
            min={16}
            max={2000}
            step={2}
            value={width}
            onChange={(e) => setWidth(Math.max(16, Number(e.target.value) || 16))}
            aria-describedby="v2g-width-hint"
          />
          <p id="v2g-width-hint" className="text-label text-muted-foreground mt-1">
            高度按比例自动计算。
          </p>
        </div>
      </div>

      <Range
        label="最大颜色数"
        min={2}
        max={256}
        step={2}
        value={colors}
        onChange={(e) => setColors(Number(e.target.value))}
      />

      <Checkbox
        label="抖动（渐变更平滑，文件更大）"
        checked={dither}
        onChange={(e) => setDither(e.target.checked)}
      />

      <Readout
        rows={
          [
            ["尺寸", outHeight ? `${width} × ${outHeight} px` : `${width} px × 自动`],
            ["格式", ".gif"],
            ["帧率", `${fps} fps`],
            ["颜色", `最多 ${colors}${dither ? "，已抖动" : ""}`],
            ["时长", `${outDuration.toFixed(2)} s`],
          ] as const
        }
      />
    </>
  );
}

export default function VideoToGifTool() {
  return (
    <ToolShell
      tool={tool}
      accept="video/*"
      defaultName="video"
      hint="选择时间范围、帧率和宽度。两遍调色板编码能让颜色更干净。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
