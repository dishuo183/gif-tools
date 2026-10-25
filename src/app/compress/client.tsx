"use client";
import * as React from "react";
import { Checkbox, Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { compressImage, MagickFormat } from "@/lib/engines/magick";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

const tool = getTool("compress");

const FORMATS = {
  jpeg: { format: MagickFormat.Jpeg, ext: "jpg", label: "JPEG" },
  png: { format: MagickFormat.Png, ext: "png", label: "PNG" },
  webp: { format: MagickFormat.WebP, ext: "webp", label: "WebP" },
} as const;
type FormatKey = keyof typeof FORMATS;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [key, setKey] = React.useState<FormatKey>("jpeg");
  const [quality, setQuality] = React.useState(82);
  const [strip, setStrip] = React.useState(true);
  const [saving, setSaving] = React.useState<{ text: string; pct: number } | null>(null);
  // Shared with the preview tools: one browser decode, and it reports failure
  // instead of leaving the readout on "reading…" forever.
  const { size: dims, failed } = useFirstFrame(file);

  React.useEffect(() => setSaving(null), [file]);

  // ImageMagick re-encodes in place; nothing here resizes.
  const lossless = key === "png";
  const qualityWords =
    quality >= 90
      ? "接近无损，文件最大"
      : quality >= 75
        ? "细节清晰"
        : quality >= 50
          ? "可见的柔化"
          : "文件更小，有块状感";

  const go = () =>
    run("正在压缩", async () => {
      setSaving(null); // a failed run must not leave the last file's result on screen
      if (!file) throw new Error("请先选择一个 PNG、JPEG 或 WebP 文件。");
      const target = FORMATS[key];
      setProgress(0.3);
      const out = await compressImage(file, { format: target.format, quality, strip });
      setProgress(1);
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving({
        text: `${formatBytes(file.size)} → ${formatBytes(out.length)}（${
          pct >= 0 ? `${pct}% 缩小` : `${-pct}% 增大`
        }）`,
        pct,
      });
      publish({
        data: out,
        ext: target.ext,
        note: `${target.label} q=${quality}${strip ? " stripped" : ""}`,
      });
    });

  useAutoRun(go, [file, key, quality, strip], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cmp-format">输出格式</Label>
          <Select id="cmp-format" value={key} onChange={(e) => setKey(e.target.value as FormatKey)}>
            <option value="jpeg">JPEG — 文件最小，不支持透明</option>
            <option value="png">PNG — 无损，保留透明</option>
            <option value="webp">WebP — 文件较小，保留透明</option>
          </Select>
        </div>
        <Range
          label="质量"
          min={1}
          max={100}
          step={1}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
        />
      </div>

      <Checkbox
        label="移除元数据（EXIF、色彩配置文件、注释）"
        checked={strip}
        onChange={(e) => setStrip(e.target.checked)}
      />

      <Readout
        rows={
          [
            [
              "尺寸",
              dims ? `${dims.w} × ${dims.h} px` : !file ? "—" : failed ? "未知" : "读取中…",
            ],
            ["格式", `.${FORMATS[key].ext}`],
            ["质量", lossless ? "无损 — 不使用质量设置" : `${quality} — ${qualityWords}`],
            ["元数据", strip ? "已移除" : "保留"],
          ] as const
        }
      />

      <p
        role="status"
        aria-live="polite"
        className={`text-ui min-h-5 ${
          !saving || saving.pct >= 0
            ? "text-[hsl(var(--smui-green))]"
            : "text-[hsl(var(--smui-yellow))]"
        }`}
      >
        {saving?.text ?? ""}
      </p>
    </>
  );
}

export default function CompressTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp"
      defaultName="compressed"
      hint="用 ImageMagick 重新编码静态图片。质量设置只对 JPEG 和 WebP 生效，PNG 始终无损。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
