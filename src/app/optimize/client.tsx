"use client";
import * as React from "react";
import { Checkbox, Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { optimizeGif } from "@/lib/engines/gifsicle";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

const tool = getTool("optimize");

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [level, setLevel] = React.useState<1 | 2 | 3>(3);
  const [lossy, setLossy] = React.useState(60);
  const [useLossy, setUseLossy] = React.useState(true);
  const [colors, setColors] = React.useState(256);
  const [saving, setSaving] = React.useState<{ text: string; pct: number } | null>(null);
  // Shared with the preview tools: one browser decode, and it reports failure
  // instead of leaving the readout on "reading…" forever.
  const { size: dims, failed } = useFirstFrame(file);

  React.useEffect(() => setSaving(null), [file]);

  // gifsicle only gets --colors when it is below 256, and no --scale at all.
  const lossyWords =
    lossy <= 40
      ? "几乎看不出"
      : lossy <= 80
        ? "轻微噪点"
        : lossy <= 140
          ? "明显噪点"
          : "严重伪影";
  const readout: [string, string][] = [
    ["尺寸", dims ? `${dims.w} × ${dims.h} px` : !file ? "—" : failed ? "未知" : "读取中…"],
    ["格式", ".gif"],
    ["颜色数", colors < 256 ? `减少到 ${colors}` : "调色板不变"],
    ["有损", useLossy ? `${lossy} — ${lossyWords}` : "关闭"],
    [
      "力度",
      level === 1 ? "仅存储变化区域" : level === 2 ? "+ 复用透明" : "所有方法",
    ],
  ];

  const go = () =>
    run("正在优化", async () => {
      setSaving(null); // a failed run must not leave the last file's result on screen
      if (!file) throw new Error("请先选择一个 GIF。");
      setProgress(0.3);
      const out = await optimizeGif(file, {
        level,
        lossy: useLossy ? lossy : undefined,
        colors,
      });
      setProgress(1);
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving({
        text: `${formatBytes(file.size)} → ${formatBytes(out.length)}（${pct >= 0 ? `${pct}% 缩小` : `${-pct}% 增大`}）`,
        pct,
      });
      publish({
        data: out,
        ext: "gif",
        note: `-O${level}${useLossy ? ` lossy=${lossy}` : ""} colors=${colors}`,
      });
    });

  useAutoRun(go, [file, level, lossy, useLossy, colors], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="opt-level">优化级别</Label>
          <Select
            id="opt-level"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1 — 仅存储变化区域</option>
            <option value={2}>2 — 同时复用透明区域</option>
            <option value={3}>3 — 尝试所有方法（最慢）</option>
          </Select>
        </div>
        <Range
          label="颜色数"
          min={2}
          max={256}
          step={1}
          value={colors}
          onChange={(e) => setColors(Number(e.target.value))}
        />
      </div>

      <div className="grid gap-3">
        <Checkbox
          label="有损压缩（文件更小，噪点略多）"
          checked={useLossy}
          onChange={(e) => setUseLossy(e.target.checked)}
        />
        {useLossy ? (
          <Range
            label="有损强度"
            min={10}
            max={200}
            step={5}
            value={lossy}
            onChange={(e) => setLossy(Number(e.target.value))}
          />
        ) : null}
      </div>

      <Readout rows={readout} />

      {saving ? (
        <p
          role="status"
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

export default function OptimizeTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif"
      defaultName="optimized"
      hint="gifsicle 会重写 GIF，让每帧只存储发生变化的部分。有损模式用少量画质换取更小的文件。"
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
