"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, renderFrames } from "@/lib/engines/gif-encode";
import { FACES, faceOptions, useFace, type FaceId } from "@/lib/fonts";
import { getTool } from "@/lib/tools";
import { inkMetrics } from "@/lib/utils";

const tool = getTool("number");

interface Style {
  fill: string;
  fill2: string;
  stroke: string;
  glow: boolean;
}

const PRESETS: { id: string; label: string; style: Style }[] = [
  {
    id: "classic",
    label: "经典 100",
    style: { fill: "#dd2e44", fill2: "#dd2e44", stroke: "", glow: false },
  },
  {
    id: "gold",
    label: "金色",
    style: { fill: "#ffd76b", fill2: "#c07a06", stroke: "#40260a", glow: false },
  },
  {
    id: "neon",
    label: "霓虹",
    style: { fill: "#4dfff0", fill2: "#4dfff0", stroke: "", glow: true },
  },
  {
    id: "outlined",
    label: "描边",
    style: { fill: "#ffffff", fill2: "#ffffff", stroke: "#101418", glow: false },
  },
  {
    id: "sunset",
    label: "渐变",
    style: { fill: "#ffb02e", fill2: "#ff2e88", stroke: "", glow: false },
  },
];

type Underline = "none" | "single" | "double";
const ANIMS = ["pulse", "shake", "rainbow"] as const;
type Anim = (typeof ANIMS)[number];

/** Display names for the animation toggles; the ids stay as-is. */
const ANIM_LABEL: Record<Anim, string> = {
  pulse: "脉动",
  shake: "抖动",
  rainbow: "彩虹",
};

interface Opts extends Style {
  text: string;
  italic: boolean;
  underline: Underline;
  thick: number;
  bg: string;
  transparent: boolean;
  anims: Anim[];
  face: FaceId;
}

/** Draw one frame. `t` is 0..1 through the animation loop. */
function draw(ctx: CanvasRenderingContext2D, S: number, o: Opts, t: number) {
  ctx.clearRect(0, 0, S, S);
  if (!o.transparent) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, S, S);
  }

  const text = o.text.trim() || "100";
  const margin = S * 0.07;
  const inner = S - margin * 2;
  const th = Math.max(1, (o.thick * S) / 128);
  const uBlock = o.underline === "none" ? 0 : o.underline === "single" ? th : th * 3;
  const uSpace = uBlock ? uBlock + S * 0.07 : 0;
  const textH = Math.max(1, inner - uSpace);
  const font = (px: number) => `${o.italic ? "italic " : ""}900 ${px}px ${FACES[o.face].family}`;

  // Auto-fit: measure at a reference size, then scale down to the tighter of
  // the width and height budgets so 4-digit numbers never clip.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(100);
  const ref = ctx.measureText(text);
  const rw = inkMetrics(ref).w;
  const rh = Math.max(1, ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent);
  const fs = Math.max(1, 100 * Math.min(inner / rw, textH / rh));
  ctx.font = font(fs);
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  const { w: tw, dx } = inkMetrics(m);

  ctx.save();
  ctx.translate(S / 2, margin + textH / 2);
  if (o.anims.includes("pulse")) {
    const s = 1 + 0.07 * Math.sin(t * 2 * Math.PI);
    ctx.scale(s, s);
  }
  if (o.anims.includes("shake")) {
    ctx.translate(Math.sin(t * 4 * Math.PI) * S * 0.022, Math.cos(t * 6 * Math.PI) * S * 0.016);
  }

  let paint: string | CanvasGradient;
  if (o.anims.includes("rainbow")) {
    paint = `hsl(${Math.round(t * 360)} 92% 55%)`;
  } else if (o.fill2 !== o.fill) {
    const g = ctx.createLinearGradient(0, -textH / 2, 0, textH / 2);
    g.addColorStop(0, o.fill);
    g.addColorStop(1, o.fill2);
    paint = g;
  } else {
    paint = o.fill;
  }

  if (o.glow) {
    ctx.shadowColor = o.anims.includes("rainbow") ? (paint as string) : o.fill;
    ctx.shadowBlur =
      fs * (o.anims.includes("pulse") ? 0.18 + 0.12 * Math.sin(t * 2 * Math.PI) : 0.24);
  }

  const y = (asc - desc) / 2;
  if (o.stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = fs * 0.1;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(text, -dx, y);
  }
  ctx.fillStyle = paint;
  ctx.fillText(text, -dx, y);

  if (uBlock) {
    const ux = Math.min(tw, inner) / 2;
    let uy = textH / 2 + S * 0.05;
    const bar = () => {
      if (o.face !== "impact") {
        // Two loose swoops, like the strokes under the emoji.
        ctx.strokeStyle = paint;
        ctx.lineCap = "round";
        ctx.lineWidth = th;
        ctx.beginPath();
        ctx.moveTo(-ux + th / 2, uy + th);
        ctx.quadraticCurveTo(0, uy - th * 0.4, ux - th / 2, uy + th / 2);
        ctx.stroke();
        return;
      }
      if (o.stroke) {
        ctx.lineWidth = fs * 0.1;
        ctx.strokeStyle = o.stroke;
        ctx.strokeRect(-ux, uy, ux * 2, th);
      }
      ctx.fillRect(-ux, uy, ux * 2, th);
    };
    bar();
    if (o.underline === "double") {
      uy += th * 2;
      bar();
    }
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

function Body({
  setBusy,
  setProgress,
  setError,
  publish,
  text,
  setText,
  anims,
  setAnims,
}: ToolBodyProps & {
  text: string;
  setText: (v: string) => void;
  anims: Anim[];
  setAnims: (v: Anim[]) => void;
}) {
  const run = useRun({ setBusy, setError, setProgress });
  const format = anims.length ? "gif" : "png";
  const [preset, setPreset] = React.useState("classic");
  const [style, setStyle] = React.useState<Style>(PRESETS[0].style);
  const [italic, setItalic] = React.useState(true);
  const [underline, setUnderline] = React.useState<Underline>("double");
  const [thick, setThick] = React.useState(9);
  const [size, setSize] = React.useState(128);
  const [bg, setBg] = React.useState(""); // "" = transparent
  const transparent = !bg;
  const [face, setFace] = React.useState<FaceId>("caveat");
  const fontReady = useFace(face);

  const opts: Opts = {
    ...style,
    text,
    italic,
    underline,
    thick,
    bg,
    transparent,
    anims,
    face,
  };
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const go = () =>
    run("正在渲染", async () => {
      if (!text.trim()) throw new Error("请先输入数字或短文字。");
      const o = optsRef.current;
      if (format === "png") {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("浏览器阻止了此工具所需的 2D Canvas。");
        draw(ctx, size, { ...o, anims: [] }, 0);
        setProgress(0.6);
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
        if (!blob) throw new Error("浏览器无法编码这张 PNG。请尝试更小的尺寸。");
        publish({
          data: new Uint8Array(await blob.arrayBuffer()),
          ext: "png",
          mime: "image/png",
          note: `${size}px ${preset}`,
        });
      } else {
        const frames = renderFrames({ width: size, height: size }, 16, (ctx, t) =>
          draw(ctx, size, o, t),
        );
        setProgress(0.7);
        publish({
          data: encodeGif(frames, { delayMs: 70, transparent, maxColors: 128 }),
          ext: "gif",
          note: `${size}px ${preset} ${anims.join("+") || "static"}`,
        });
      }
      setProgress(1);
    });

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p.id);
    setStyle(p.style);
  };

  useAutoRun(go, [text, format, style, italic, underline, thick, size, anims, face], fontReady);
  return (
    <>
      <div>
        <Label htmlFor="num-text">数字或短文字</Label>
        <Input
          id="num-text"
          value={text}
          maxLength={6}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="num-text-hint"
        />
        <p id="num-text-hint" className="text-label text-muted-foreground mt-1">
          最多 6 个字符。内容更长时会自动缩小以适配方形。
        </p>
      </div>

      <fieldset>
        <legend className="text-label text-muted-foreground tracking-[1.5px] uppercase mb-1">
          样式预设
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
              aria-pressed={preset === p.id}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          id="num-fill"
          label="颜色"
          value={style.fill}
          onChange={(v) => {
            setStyle((s) => ({ ...s, fill: v, fill2: v }));
            setPreset("custom");
          }}
        />
        <div>
          <Label htmlFor="num-underline">下划线</Label>
          <Select
            id="num-underline"
            value={underline}
            onChange={(e) => setUnderline(e.target.value as Underline)}
          >
            <option value="none">无</option>
            <option value="single">单线</option>
            <option value="double">双线——100 样式</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {underline !== "none" ? (
          <Range
            label="下划线粗细"
            min={3}
            max={20}
            value={thick}
            suffix="px"
            onChange={(e) => setThick(Number(e.target.value))}
          />
        ) : (
          <div />
        )}
        <div>
          <Label htmlFor="num-font">字体</Label>
          <Select id="num-font" value={face} onChange={(e) => setFace(e.target.value as FaceId)}>
            {faceOptions("caveat")}
          </Select>
        </div>
        <div>
          <Label htmlFor="num-size">尺寸</Label>
          <Select id="num-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack 表情</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        <Checkbox label="斜体" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
        <ColorField id="num-bg" label="背景颜色" value={bg} onChange={setBg} clearable />
      </div>

      <div>
        <Label>动画</Label>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ANIMS.map((a) => (
            <Checkbox
              key={a}
              label={ANIM_LABEL[a]}
              checked={anims.includes(a)}
              onChange={(e) =>
                setAnims(e.target.checked ? [...anims, a] : anims.filter((x) => x !== a))
              }
            />
          ))}
        </div>
        <p className="text-label text-muted-foreground mt-1">
          勾选任意一项即可生成 GIF 动画；全不选则输出静态 PNG。
        </p>
      </div>
    </>
  );
}

export default function NumberTool() {
  // Held here so the download name and its extension can track the controls.
  const [text, setText] = React.useState("100");
  const [anims, setAnims] = React.useState<Anim[]>([]);
  const format = anims.length ? "gif" : "png";
  return (
    <ToolShell
      tool={tool}
      requiresFile={false}
      defaultName="number"
      suggestedName={text}
      suggestedExt={format}
      hint="输入一个数字，选好样式后下载。文字会自动缩小以适配方形，所以 1000 和 100 一样好用。"
    >
      {(props) => (
        <Body {...props} text={text} setText={setText} anims={anims} setAnims={setAnims} />
      )}
    </ToolShell>
  );
}
