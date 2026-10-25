"use client";
import * as React from "react";
import { Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce } from "@/lib/engines/ffmpeg";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

const tool = getTool("gif-to-video");

// h264 and vp9 both need even dimensions; GIFs regularly have odd ones.
const EVEN = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

// Each codec has its own useful CRF window; the slider and the encode share it.
const CRF_RANGE = { mp4: [15, 40], webm: [20, 50] } as const;

/** Plain words for a CRF, placed on that codec's own scale. */
function crfMeaning(format: "mp4" | "webm", crf: number): string {
  const [lo, hi] = CRF_RANGE[format];
  const t = (crf - lo) / (hi - lo);
  if (t <= 0.15) return "接近无损，文件最大";
  if (t <= 0.4) return "细节锐利，文件较大";
  if (t <= 0.65) return "均衡";
  if (t <= 0.85) return "文件更小，细节更柔和";
  return "文件最小，肉眼可见发软";
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [format, setFormat] = React.useState<"mp4" | "webm">("mp4");
  const [crf, setCrf] = React.useState(28);
  const [saving, setSaving] = React.useState<{ text: string; pct: number } | null>(null);
  // A new file invalidates the previous result line.
  React.useEffect(() => setSaving(null), [file]);
  // Dimensions from the browser decode; probe() would boot the 32MB ffmpeg core.
  const { size: source } = useFirstFrame(file);

  // h264/vp9 reject odd dimensions, so EVEN truncates them down.
  const outW = source ? source.w - (source.w % 2) : null;
  const outH = source ? source.h - (source.h % 2) : null;

  const go = () =>
    run(`正在生成 ${format.toUpperCase()}`, async () => {
      setSaving(null); // a failed run must not leave the last file's result on screen
      if (!file) throw new Error("请先选择 GIF。");
      const out = await ffmpegOnce(
        file,
        "in.gif",
        `out.${format}`,
        ({ input, output }) =>
          format === "mp4"
            ? [
                "-i",
                input,
                "-vf",
                EVEN,
                "-c:v",
                "libx264",
                "-crf",
                String(crf),
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                output,
              ]
            : [
                "-i",
                input,
                "-vf",
                EVEN,
                "-c:v",
                "libvpx-vp9",
                "-crf",
                String(crf),
                "-b:v",
                "0",
                "-pix_fmt",
                "yuv420p",
                output,
              ],
        { onProgress: setProgress },
      );
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving({
        text: `${formatBytes(file.size)} → ${formatBytes(out.length)}（${pct >= 0 ? `缩小 ${pct}%` : `增大 ${-pct}%`}）`,
        pct,
      });
      publish({ data: out, ext: format, note: `${format} crf=${crf}` });
    });

  useAutoRun(go, [file, format, crf], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="g2v-format">输出格式</Label>
          <Select
            id="g2v-format"
            value={format}
            onChange={(e) => {
              const next = e.target.value as "mp4" | "webm";
              setFormat(next);
              // Keep crf inside the new codec's window — the encode uses this value.
              const [lo, hi] = CRF_RANGE[next];
              setCrf((c) => Math.min(Math.max(c, lo), hi));
            }}
          >
            <option value="mp4">MP4（h264）—— 到处都能播放</option>
            <option value="webm">WebM（vp9）—— 更小，现代浏览器支持</option>
          </Select>
        </div>
        <Range
          label="质量（CRF）"
          min={CRF_RANGE[format][0]}
          max={CRF_RANGE[format][1]}
          step={1}
          value={crf}
          onChange={(e) => setCrf(Number(e.target.value))}
        />
      </div>

      <Readout
        rows={
          [
            ["尺寸", outW && outH ? `${outW} × ${outH} px` : file ? "读取中…" : "—"],
            ["格式", format === "mp4" ? ".mp4（h264）" : ".webm（vp9）"],
            ["质量", `CRF ${crf} —— ${crfMeaning(format, crf)}`],
          ] as const
        }
      />

      {source && (source.w % 2 || source.h % 2) ? (
        <p className="text-label text-muted-foreground">
          源文件某一维度是奇数。视频编码器要求偶数，因此会裁掉 1 像素。
        </p>
      ) : null}

      {saving ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-ui ${
            saving.pct >= 0 ? "text-[hsl(var(--smui-green))]" : "text-[hsl(var(--smui-yellow))]"
          }`}
        >
          {saving.text}
        </p>
      ) : null}
    </>
  );
}

export default function GifToVideoTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,video/*"
      defaultName="video"
      hint="视频编码的压缩效率远高于 GIF，体积通常只有原文件的一小部分。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
