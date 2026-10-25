"use client";
import * as React from "react";
import { Checkbox, ColorField, Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";
import { NO_PREVIEW, useFirstFrame } from "@/lib/preview";

const tool = getTool("rotate");

function outputExt(file: File): "gif" | "webm" | "mp4" | "png" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  if (file.type.startsWith("video/")) return "mp4";
  return "png";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

const TURNS: Record<string, string> = {
  "0": "",
  "90": "transpose=1",
  "180": "transpose=1,transpose=1",
  "270": "transpose=2",
};

/**
 * Output box and clockwise angle for a source frame — the same maths ffmpeg
 * does with rotw()/roth(), so the preview and the encode always agree.
 */
function rotated(w: number, h: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  // Rounded: these are pixel counts, and cos(90°) leaves float dust that would
  // otherwise be printed to the user as "270.00000000000006".
  return {
    rad,
    ow: Math.max(1, Math.round(w * c + h * s)),
    oh: Math.max(1, Math.round(w * s + h * c)),
  };
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const { frame, size, failed } = useFirstFrame(file);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [turn, setTurn] = React.useState<keyof typeof TURNS | "custom">("90");
  const [angle, setAngle] = React.useState(15);
  const [bg, setBg] = React.useState("#000000");
  const [hflip, setHflip] = React.useState(false);
  const [vflip, setVflip] = React.useState(false);

  const deg = turn === "custom" ? (Number.isFinite(angle) ? angle : 0) : Number(turn);

  // Live preview: same rotate-then-flip order the filter chain below uses.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !frame || !size) return;
    const { rad, ow, oh } = rotated(size.w, size.h, deg);
    // Cap the backing store; a 4K frame does not need 4K of preview.
    const k = Math.min(1, 480 / Math.max(ow, oh));
    canvas.width = Math.max(1, Math.round(ow * k));
    canvas.height = Math.max(1, Math.round(oh * k));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (turn === "custom" && bg && HEX.test(bg)) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(k * (hflip ? -1 : 1), k * (vflip ? -1 : 1));
    ctx.rotate(rad);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, -size.w / 2, -size.h / 2, size.w, size.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [frame, size, deg, turn, bg, hflip, vflip]);

  const go = () =>
    run("正在旋转", async () => {
      if (!file) throw new Error("请先选择一个 GIF、图片或视频。");
      if (turn === "custom" && bg && !HEX.test(bg)) {
        throw new Error("背景色必须是六位十六进制值，例如 #1a1a1a。");
      }

      const parts: string[] = [];
      if (turn === "custom") {
        if (!Number.isFinite(angle)) throw new Error("请输入旋转角度（单位：度）。");
        const rad = `${angle}*PI/180`;
        // Video can't carry alpha, so an empty (transparent) colour falls back to black there.
        const ext = outputExt(file);
        const fill = bg ? `0x${bg.slice(1)}` : ext === "mp4" || ext === "webm" ? "black" : "none";
        parts.push(`rotate=${rad}:fillcolor=${fill}:ow=rotw(${rad}):oh=roth(${rad})`);
      } else if (TURNS[turn]) {
        parts.push(TURNS[turn]);
      }
      if (hflip) parts.push("hflip");
      if (vflip) parts.push("vflip");
      if (parts.length === 0) throw new Error("请选择旋转角度或翻转方式，目前没有可执行的操作。");

      const ext = outputExt(file);
      // x264/VP9 reject odd dimensions, and rotw()/roth() round to whatever.
      if (ext === "mp4" || ext === "webm") parts.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
      const filters = parts.join(",");
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";

      const out = await ffmpegOnce(
        file,
        `in.${srcExt}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters })
            : ext === "png"
              ? ["-i", input, "-vf", filters, "-frames:v", "1", output]
              : ["-i", input, "-filter:v", filters, "-an", "-pix_fmt", "yuv420p", output],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg 无法旋转此文件（${err instanceof Error ? err.message : String(err)}）。请检查角度，或换一种输入格式再试。`,
        );
      });

      publish({ data: out, ext, note: filters });
    });

  useAutoRun(go, [file, turn, angle, bg, hflip, vflip], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="rotate-turn">旋转</Label>
          <Select
            id="rotate-turn"
            value={turn}
            onChange={(e) => setTurn(e.target.value as typeof turn)}
          >
            <option value="0">不旋转</option>
            <option value="90">顺时针 90°</option>
            <option value="180">180°</option>
            <option value="270">顺时针 270°</option>
            <option value="custom">自定义角度</option>
          </Select>
        </div>

        {turn === "custom" ? (
          <div>
            <Label htmlFor="rotate-angle">角度（度）</Label>
            <Input
              id="rotate-angle"
              type="number"
              min={-360}
              max={360}
              step={1}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
          </div>
        ) : null}
      </div>

      {turn === "custom" ? (
        <ColorField
          id="rotate-bg"
          label="边角背景色"
          value={bg}
          onChange={setBg}
          clearable
        />
      ) : null}

      <div className="grid gap-3">
        <Checkbox
          label="水平翻转（镜像）"
          checked={hflip}
          onChange={(e) => setHflip(e.target.checked)}
        />
        <Checkbox
          label="垂直翻转"
          checked={vflip}
          onChange={(e) => setVflip(e.target.checked)}
        />
      </div>

      <div>
        <span className="text-label text-muted-foreground tracking-[1.5px] uppercase block mb-1">
          预览
        </span>
        <div className="checkerboard flex items-center justify-center border border-border p-4">
          {frame && size ? (
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`旋转 ${deg} 度后的预览${hflip ? "，已水平翻转" : ""}${vflip ? "，已垂直翻转" : ""}`}
              className="block max-h-64 max-w-full"
            />
          ) : (
            <p className="text-ui text-muted-foreground py-8">
              {failed ? NO_PREVIEW : "选择一个文件即可预览。"}
            </p>
          )}
        </div>
        {size ? (
          <p className="text-ui text-muted-foreground mt-2 tabular-nums" aria-live="polite">
            输出 {rotated(size.w, size.h, deg).ow} × {rotated(size.w, size.h, deg).oh} px
          </p>
        ) : null}
      </div>
    </>
  );
}

export default function RotateTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,video/*"
      defaultName="rotated"
      hint="先旋转，再翻转。动画会保留；静态图片输出为 PNG。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
