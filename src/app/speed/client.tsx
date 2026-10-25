"use client";
import * as React from "react";
import { Checkbox, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("speed");

const secs = (v: number) => `${v.toFixed(2)} 秒`;

// GIF frame delays are whole hundredths of a second and browsers clamp anything
// under 2cs to 10cs, so a GIF that asks for more than 50fps plays back *slower*.
const GIF_MAX_FPS = 50;
// Fallback for a source whose rate ffmpeg does not print (some single-frame
// GIFs); typical hand-made GIF territory.
const REF_FPS = 15;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** GIF stays a GIF, WebM stays WebM, any other video becomes MP4. */
function outputExt(file: File): "gif" | "webm" | "mp4" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  return "mp4";
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [mode, setMode] = React.useState<"multiplier" | "fps">("multiplier");
  const [multiplier, setMultiplier] = React.useState(2);
  const [fps, setFps] = React.useState(15);
  const [drop, setDrop] = React.useState(false);
  const [dropFps, setDropFps] = React.useState(12);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [srcFps, setSrcFps] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!file) {
      setDuration(null);
      setSrcFps(null);
      return;
    }
    let stale = false;
    // The probe shares the ffmpeg queue with a real encode, so it must not
    // drive the shell's busy state: its finally would clear the badge of a
    // conversion the user started while it was still pending.
    probe(file)
      .then((info) => {
        if (stale) return;
        setDuration(info.durationSec);
        setSrcFps(info.fps);
      })
      .catch(() => {
        if (!stale) setDuration(null);
      });
    return () => {
      stale = true;
    };
  }, [file]);

  // The fps filter only resamples, so the capped length still matches the headline.
  const capFps =
    !!file &&
    outputExt(file) === "gif" &&
    mode === "multiplier" &&
    !drop &&
    multiplier * (srcFps ?? REF_FPS) > GIF_MAX_FPS;

  const go = () =>
    run("正在调整速度", async () => {
      if (!file) throw new Error("请先选择 GIF 或视频。");
      if (mode === "multiplier" && !(multiplier >= 0.1 && multiplier <= 10)) {
        throw new Error("速度倍率必须在 0.1x 到 10x 之间。");
      }
      if (mode === "fps" && !(fps >= 1 && fps <= 60)) {
        throw new Error("目标帧率必须在每秒 1 到 60 帧之间。");
      }

      // Multiplier retimes existing frames; fps mode stamps a fixed interval
      // onto every frame (N is the frame index, TB the output timebase).
      const parts = mode === "multiplier" ? [`setpts=PTS/${multiplier}`] : [`setpts=N/${fps}/TB`];
      if (mode === "multiplier" && drop) parts.push(`fps=${dropFps}`);
      if (capFps) parts.push(`fps=${GIF_MAX_FPS}`);
      const filters = parts.join(",");

      const ext = outputExt(file);
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";
      const out = await ffmpegOnce(
        file,
        `in.${srcExt}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters })
            : ["-i", input, "-filter:v", filters, "-an", "-pix_fmt", "yuv420p", output],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg 无法调整该文件的时间（${err instanceof Error ? err.message : String(err)}）。请换更短的片段或不同的输入格式。`,
        );
      });

      publish({
        data: out,
        ext,
        note:
          mode === "multiplier" ? `${multiplier}x${drop ? ` @ ${dropFps}fps` : ""}` : `${fps} fps`,
      });
    });

  // Live readout, derived from the same numbers the filters are built from:
  // setpts=PTS/m divides the length by m; the fps filter only resamples, so it
  // changes the frame rate and not the length. setpts=N/fps/TB restamps every
  // frame at a fixed interval, so the new length is frame count ÷ fps.
  const badMultiplier = mode === "multiplier" && !(multiplier >= 0.1 && multiplier <= 10);
  const badFps = mode === "fps" && !(fps >= 1 && fps <= 60);
  let headline: string;
  let detail: string;
  if (badMultiplier || badFps) {
    headline = "超出范围";
    detail = badMultiplier
      ? "速度倍率必须在 0.1x 到 10x 之间。"
      : "目标帧率必须在每秒 1 到 60 帧之间。";
  } else if (mode === "multiplier") {
    headline = duration
      ? `${secs(duration)} → ${secs(duration / multiplier)}`
      : `时长 ÷ ${multiplier}`;
    detail = drop
      ? `帧率强制为每秒 ${dropFps} 帧（会丢弃部分帧，上面显示的时长不变）。`
      : capFps
        ? `帧率上限为每秒 ${GIF_MAX_FPS} 帧——GIF 单帧不能短于 2/100 秒，再快反而会变慢。`
        : `帧率 ×${multiplier}——15 帧/秒的源文件会以 ${round1(15 * multiplier)} 帧/秒播放。`;
  } else {
    headline = `每帧停留 ${(1 / fps).toFixed(3)} 秒`;
    detail = `新时长 = 帧数 ÷ ${fps} 帧/秒${
      duration ? `，只有源文件本身就是 ${fps} 帧/秒时才会保持 ${secs(duration)}` : ""
    }。`;
  }

  useAutoRun(go, [file, mode, multiplier, fps, drop, dropFps], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="speed-mode">模式</Label>
          <Select
            id="speed-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "multiplier" | "fps")}
          >
            <option value="multiplier">速度倍率</option>
            <option value="fps">目标帧率</option>
          </Select>
        </div>

        {mode === "multiplier" ? (
          <div>
            <Label htmlFor="speed-multiplier">速度倍率（0.1x – 10x）</Label>
            <Input
              id="speed-multiplier"
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              aria-describedby="speed-multiplier-hint"
            />
            <p id="speed-multiplier-hint" className="text-label text-muted-foreground mt-1">
              大于 1 变快，小于 1 变慢。
            </p>
          </div>
        ) : (
          <div>
            <Label htmlFor="speed-fps">目标帧率</Label>
            <Input
              id="speed-fps"
              type="number"
              min={1}
              max={60}
              step={1}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              aria-describedby="speed-fps-hint"
            />
            <p id="speed-fps-hint" className="text-label text-muted-foreground mt-1">
              每帧显示 1/{fps || 1} 秒。
            </p>
          </div>
        )}
      </div>

      {mode === "multiplier" ? (
        <div className="grid gap-3">
          <Checkbox
            label="丢弃部分帧以减小体积"
            checked={drop}
            onChange={(e) => setDrop(e.target.checked)}
          />
          {drop ? (
            <Range
              id="speed-drop-fps"
              aria-label="丢帧后的每秒帧数"
              label="丢帧后的每秒帧数"
              min={2}
              max={30}
              step={1}
              value={dropFps}
              suffix=" 帧/秒"
              onChange={(e) => setDropFps(Number(e.target.value))}
            />
          ) : null}
        </div>
      ) : null}

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

export default function SpeedTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,video/*"
      defaultName="speed"
      hint="加速或减速都会保持原格式——GIF 仍是 GIF，视频仍是视频。音频会被丢弃。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
