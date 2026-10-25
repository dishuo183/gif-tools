"use client";
import * as React from "react";
import { Checkbox, Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";
import { outExt } from "@/lib/format";
import { NO_PREVIEW, useFirstFrame } from "@/lib/preview";
import { clamp } from "@/lib/utils";

const tool = getTool("resize");

const VIDEO = ["mp4", "webm"];

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [mode, setMode] = React.useState<"pixels" | "percent">("pixels");
  const [width, setWidth] = React.useState(1340);
  const [height, setHeight] = React.useState(1785);
  const [percent, setPercent] = React.useState(50);
  const [lock, setLock] = React.useState(true);
  const [filter, setFilter] = React.useState("lanczos");
  // useFirstFrame decodes the file in the browser, so the source dimensions come
  // for free — probe() would boot the 32MB ffmpeg core just to read two numbers.
  const { size: src, failed } = useFirstFrame(file);

  // 不再用源文件尺寸覆盖这里的默认值：1340×1785 是常用的输出尺寸，选文件时
  // 把用户的目标尺寸改掉反而添乱；源尺寸在下面的状态行里照常显示。

  const onWidth = (v: number) => {
    setWidth(v);
    if (lock && src && v > 0) setHeight(Math.max(1, Math.round((v * src.h) / src.w)));
  };
  const onHeight = (v: number) => {
    setHeight(v);
    if (lock && src && v > 0) setWidth(Math.max(1, Math.round((v * src.w) / src.h)));
  };

  const target =
    mode === "percent" && src
      ? { w: Math.round((src.w * percent) / 100), h: Math.round((src.h * percent) / 100) }
      : { w: width, h: height };

  // 最终尺寸就是 ffmpeg 要用的尺寸；结果面板会显示真实输出，这里不再画第二份预览。
  const tw = clamp(Math.round(target.w), 1, 4000);
  const th = clamp(Math.round(target.h), 1, 4000);

  const go = () =>
    run("正在调整尺寸", async () => {
      if (!file) throw new Error("请先选择文件。");
      if (!src) throw new Error("正在读取源文件尺寸——请稍候再试。");
      const ext = outExt(file.name);
      const isVideo = VIDEO.includes(ext);
      // Video encoders need even dimensions; GIF and stills don't care.
      const w = isVideo ? Math.max(2, tw - (tw % 2)) : tw;
      const h = isVideo ? Math.max(2, th - (th % 2)) : th;
      const scale = `scale=${w}:${h}:flags=${filter}`;
      const onProgress = (r: number) => setProgress(r);
      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters: scale })
            : ["-i", input, "-vf", scale, output],
        { onProgress },
      );
      publish({ data: out, ext, note: `${w}x${h} ${filter}` });
    });

  useAutoRun(go, [file, mode, width, height, percent, lock, filter], !!file && !!src);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="resize-mode">模式</Label>
          <Select
            id="resize-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "pixels" | "percent")}
          >
            <option value="pixels">按像素</option>
            <option value="percent">按百分比</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="resize-filter">缩放滤镜</Label>
          <Select id="resize-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="lanczos">Lanczos —— 最锐利（默认）</option>
            <option value="bicubic">双三次 —— 更平滑</option>
            <option value="neighbor">最近邻 — 像素画</option>
          </Select>
        </div>
      </div>

      {mode === "pixels" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="resize-w">宽度（px）</Label>
            <Input
              id="resize-w"
              type="number"
              min={1}
              max={4000}
              value={width}
              onChange={(e) => onWidth(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="resize-h">高度（px）</Label>
            <Input
              id="resize-h"
              type="number"
              min={1}
              max={4000}
              value={height}
              onChange={(e) => onHeight(Number(e.target.value))}
            />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="resize-pct">相对于原图的百分比</Label>
          <Input
            id="resize-pct"
            type="number"
            min={1}
            max={400}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
        </div>
      )}

      <Checkbox
        label="锁定宽高比"
        checked={lock}
        onChange={(e) => setLock(e.target.checked)}
      />

      <p className="text-ui text-muted-foreground" role="status" aria-live="polite">
        {src
          ? `源 ${src.w}×${src.h} → 输出 ${tw}×${th}`
          : failed
            ? NO_PREVIEW
            : "选择一个文件以读取尺寸。"}
      </p>
    </>
  );
}

export default function ResizeTool() {
  return (
    <ToolShell
      tool={tool}
      defaultName="resized"
      hint="缩放 GIF、图片或视频。GIF 会用生成的调色板重新编码，缩小后依然清晰。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
