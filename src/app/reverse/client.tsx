"use client";
import * as React from "react";
import { Label, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("reverse");

const secs = (v: number) => `${v.toFixed(2)} 秒`;

function outputExt(file: File): "gif" | "webm" | "mp4" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  return "mp4";
}

/**
 * Boomerang: split the stream, reverse one copy, concatenate. `trim` throws
 * away the duplicated last frame so the turnaround does not stutter.
 */
const BOOMERANG =
  "split[fa][fb];[fb]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[fr];[fa][fr]concat=n=2:v=1";

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [mode, setMode] = React.useState<"reverse" | "boomerang">("reverse");
  const [duration, setDuration] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    let stale = false;
    // The probe shares the ffmpeg queue with a real encode, so it must not
    // drive the shell's busy state: its finally would clear the badge of a
    // conversion the user started while it was still pending.
    probe(file)
      .then((info) => {
        if (!stale) setDuration(info.durationSec);
      })
      .catch(() => {
        if (!stale) setDuration(null);
      });
    return () => {
      stale = true;
    };
  }, [file]);

  const go = () =>
    run(mode === "boomerang" ? "正在生成往返" : "正在倒放", async () => {
      if (!file) throw new Error("请先选择 GIF 或视频。");

      const ext = outputExt(file);
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";
      const filters = mode === "boomerang" ? BOOMERANG : "reverse";

      const out = await ffmpegOnce(
        file,
        `in.${srcExt}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters })
            : [
                "-i",
                input,
                "-filter_complex",
                `[0:v]${filters}[v]`,
                "-map",
                "[v]",
                "-an",
                "-pix_fmt",
                "yuv420p",
                output,
              ],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg 无法倒放该文件（${err instanceof Error ? err.message : String(err)}）。倒放需要把所有帧读入内存——请先剪短片段再试。`,
        );
      });

      publish({ data: out, ext, note: mode });
    });

  // Reverse keeps every frame, so the length is unchanged. Boomerang appends
  // the reversed copy minus its first frame (trim=start_frame=1), so it plays
  // 2n-1 frames: twice the length, one frame short.
  const headline = duration
    ? mode === "boomerang"
      ? `${secs(duration)} \u2192 ${secs(duration * 2)}（少一帧）`
      : `${secs(duration)} \u2192 ${secs(duration)}`
    : mode === "boomerang"
      ? "约为原时长的两倍"
      : "与原时长相同";
  const detail =
    mode === "boomerang"
      ? "先正放再倒放：帧数约为两倍，减去重复的转折帧。"
      : "保留每一帧，从后往前播放：帧数与时长都不变。";

  useAutoRun(go, [file, mode], !!file);
  return (
    <>
      <div>
        <Label htmlFor="reverse-mode">方向</Label>
        <Select
          id="reverse-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "reverse" | "boomerang")}
        >
          <option value="reverse">倒放 — 从后往前播放</option>
          <option value="boomerang">往返 — 先正放再倒放</option>
        </Select>
      </div>

      <p className="text-ui text-muted-foreground">
        倒放需要一次性把所有帧载入内存，因此过长或过大的输入可能耗尽内存而失败。遇到这种情况请先剪短片段。
      </p>

      <div
        role="status"
        aria-live="polite"
        className="border border-border bg-smui-surface-0 p-3 grid gap-1"
      >
        <span className="text-label uppercase tracking-wider text-muted-foreground">结果</span>
        <p className="text-ui text-foreground tabular-nums">{headline}</p>
        <p className="text-label text-muted-foreground tabular-nums">{detail}</p>
      </div>
    </>
  );
}

export default function ReverseTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,video/*"
      defaultName="reversed"
      hint="GIF 仍是 GIF，视频仍是视频。音频会被丢弃。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
