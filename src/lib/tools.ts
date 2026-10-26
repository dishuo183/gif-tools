/**
 * Single source of truth for every tool. Drives the nav, the home grid,
 * per-page SEO metadata, sitemap.xml, llms.txt and the .md mirrors.
 *
 * 界面上可见的文案全部是中文；slug 保持英文，因为它是路由、下载文件名和
 * 本地历史记录的键，改了会让旧链接和旧记录失效。
 */
export type ToolCategory = "convert" | "edit" | "optimize" | "emoji";

export interface Tool {
  slug: string;
  name: string;
  /** <title> 和 og:title 用这个。 */
  title: string;
  /** meta description + llms.txt 的一行。控制在 120-160 个字符左右。 */
  description: string;
  /** 卡片和导航上的短标签。 */
  blurb: string;
  category: ToolCategory;
  engine: ("ffmpeg" | "gifsicle" | "magick" | "canvas")[];
  keywords: string[];
}

/** smui 强调色（HSL 三元组变量），用于分类标题、图标和卡片左边框。 */
export const CATEGORIES: Record<
  ToolCategory,
  { label: string; description: string; tone: string }
> = {
  convert: {
    label: "转换",
    description: "在视频、GIF、WebP、APNG 和静态图片之间互转。",
    tone: "var(--smui-frost-2)",
  },
  edit: {
    label: "编辑",
    description: "调整尺寸、裁剪、剪切、旋转、加字幕、加特效。",
    tone: "var(--smui-green)",
  },
  optimize: {
    label: "优化",
    description: "在不毁掉画面的前提下把文件变小。",
    tone: "var(--smui-yellow)",
  },
  emoji: {
    label: "表情",
    description: "可直接用在 Slack 的动态表情和文字生成器。",
    tone: "var(--smui-purple)",
  },
};

export const TOOLS: Tool[] = [
  {
    slug: "video-to-gif",
    name: "视频转 GIF",
    title: "视频转 GIF 转换器",
    description:
      "在浏览器里把 MP4、WebM、MOV 或 AVI 视频转成动态 GIF。可选择时间区间、帧率、宽度和调色板质量。不上传、无水印。",
    blurb: "MP4/WebM/MOV → 动态 GIF，可调调色板。",
    category: "convert",
    engine: ["ffmpeg"],
    keywords: ["视频转 gif", "mp4 转 gif", "webm 转 gif", "mov 转 gif"],
  },
  {
    slug: "gif-to-video",
    name: "GIF 转视频",
    title: "GIF 转 MP4 / WebM 转换器",
    description:
      "把动态 GIF 转成随处可播的 MP4 或 WebM，体积往往只有 GIF 的零头。由编译为 WebAssembly 的 ffmpeg 在本地完成。",
    blurb: "GIF → MP4/WebM，比原文件小得多。",
    category: "convert",
    engine: ["ffmpeg"],
    keywords: ["gif 转 mp4", "gif 转视频", "gif 转 webm"],
  },
  {
    slug: "gif-maker",
    name: "GIF 制作",
    title: "GIF 制作器 — 用图片合成 GIF",
    description:
      "用一组图片合成动态 GIF。可以调整帧顺序、设置每帧延迟和循环次数，下载前先预览效果。",
    blurb: "图片 → GIF，可排序、设延迟、设循环。",
    category: "convert",
    engine: ["canvas", "ffmpeg"],
    keywords: ["gif 制作", "图片转 gif", "png 转 gif", "动态 gif 生成器"],
  },
  {
    slug: "convert",
    name: "格式转换",
    title: "图片与动画格式转换器",
    description:
      "在 GIF、PNG、JPEG、WebP、动态 WebP、APNG 和 BMP 之间互转，目标格式支持时保留动画。使用 wasm 版 ImageMagick 与 ffmpeg。",
    blurb: "GIF ⇄ PNG/JPEG/WebP/APNG/BMP，保留动画。",
    category: "convert",
    engine: ["magick", "ffmpeg"],
    keywords: ["gif 转 webp", "webp 转 gif", "apng", "图片格式转换"],
  },
  {
    slug: "split",
    name: "拆分帧",
    title: "GIF 拆帧 — 导出每一帧",
    description:
      "把动态 GIF 或 WebP 拆成单帧，打包成 ZIP 下载，也可以只取某一帧。每帧的延迟都会显示出来。",
    blurb: "GIF → 单帧 PNG，打包下载。",
    category: "convert",
    engine: ["ffmpeg"],
    keywords: ["gif 拆帧", "gif 转 png", "提取 gif 帧"],
  },
  {
    slug: "resize",
    name: "调整尺寸",
    title: "调整 GIF、图片或视频的尺寸",
    description:
      "按像素或百分比调整动态 GIF、静态图片或视频的尺寸。可锁定宽高比，也可以拉伸铺满，Lanczos 缩放让边缘更干净。",
    blurb: "按像素或百分比缩放，可锁定比例。",
    category: "edit",
    engine: ["ffmpeg", "gifsicle"],
    keywords: ["调整 gif 尺寸", "gif 缩放", "gif 改大小"],
  },
  {
    slug: "crop",
    name: "裁剪",
    title: "裁剪 GIF 或图片",
    description:
      "用可拖拽的选框、精确像素输入或固定宽高比来裁剪动态 GIF、图片或视频，裁剪后动画仍然保留。",
    blurb: "拖框或输入像素，动画不丢。",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["裁剪 gif", "gif 裁剪", "方形裁剪"],
  },
  {
    slug: "cut",
    name: "剪切",
    title: "剪切、截取 GIF 或视频",
    description:
      "把动态 GIF 或视频裁到你真正要的那一段。拖到起点和终点，预览选区，只导出这一段。",
    blurb: "用时间条截取起止区间。",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["剪切 gif", "截取 gif", "缩短 gif"],
  },
  {
    slug: "speed",
    name: "速度",
    title: "调整 GIF 播放速度",
    description:
      "给动态 GIF 或视频加速、减速。可以用倍数，也可以指定目标帧率，并能选择丢帧来减小体积。",
    blurb: "按倍数或目标帧率加速、减速。",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["gif 加速", "gif 减速", "gif 速度"],
  },
  {
    slug: "reverse",
    name: "倒放",
    title: "倒放 GIF",
    description:
      "让动态 GIF 倒着播，或者做成先正放再倒放的无缝回旋镖。视频输入同样适用。",
    blurb: "倒着播，或无缝回旋镖循环。",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["gif 倒放", "回旋镖 gif", "反向 gif"],
  },
  {
    slug: "rotate",
    name: "旋转",
    title: "旋转、镜像 GIF",
    description:
      "把动态 GIF 或图片旋转 90、180、270 度，水平或垂直翻转，也可以按任意角度旋转并指定背景色。",
    blurb: "90/180/270 度、任意角度、镜像翻转。",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["旋转 gif", "翻转 gif", "镜像 gif"],
  },
  {
    slug: "add-text",
    name: "添加文字",
    title: "给 GIF 加文字或字幕",
    description:
      "给动态 GIF 加梗图式字幕。可选上方或下方、字幕条或浮层，字号、颜色、描边都能调，文字在各帧上保持不动。",
    blurb: "梗图字幕、浮层与字幕条。",
    category: "edit",
    engine: ["canvas", "ffmpeg"],
    keywords: ["gif 加文字", "gif 字幕", "梗图文字"],
  },
  {
    slug: "effects",
    name: "特效",
    title: "GIF 特效与滤镜",
    description:
      "给动态 GIF 或图片加灰度、复古、反色、模糊、锐化、色调分离，以及亮度、对比度、饱和度、色相调整。",
    blurb: "灰度、复古、反色、模糊、色彩调整。",
    category: "edit",
    engine: ["ffmpeg", "magick"],
    keywords: ["gif 特效", "gif 滤镜", "gif 灰度"],
  },
  {
    slug: "remove-bg",
    name: "去除背景",
    title: "去掉 GIF 或图片的背景色",
    description:
      "把动态 GIF 或静态图片中的某一种颜色变成透明。在预览上点选颜色，再调容差和羽化让边缘更柔和。由 ffmpeg 在本地完成。",
    blurb: "抠掉一种颜色，可调容差与羽化。",
    category: "edit",
    engine: ["ffmpeg", "canvas"],
    keywords: ["gif 去背景", "透明 gif", "色键抠图", "去掉白色背景"],
  },
  {
    slug: "optimize",
    name: "GIF 压缩",
    title: "GIF 压缩",
    description:
      "用 gifsicle 压缩动态 GIF：有损压缩、减色、帧差分，还可以丢帧，并与原图对比体积。",
    blurb: "gifsicle 有损压缩与减色。",
    category: "optimize",
    engine: ["gifsicle"],
    keywords: ["gif 优化", "gif 压缩", "gif 瘦身", "减小 gif 体积"],
  },
  {
    slug: "compress",
    name: "压缩图片",
    title: "压缩 PNG、JPEG 和 WebP",
    description:
      "减小静态图片的体积。可以设 JPEG 或 WebP 质量、清除元数据，或对 PNG 做调色板量化，下载前先看省了多少。",
    blurb: "静态图片质量控制与元数据清理。",
    category: "optimize",
    engine: ["magick"],
    keywords: ["压缩 png", "压缩 jpeg", "图片压缩"],
  },
  {
    slug: "intensify",
    name: "抖动加强",
    title: "INTENSIFIES 抖动表情生成器",
    description:
      "让任意图片剧烈抖动——经典的 [INTENSIFIES] Slack 表情。可调抖动幅度、速度，以及边缘是裁掉还是补边。",
    blurb: "经典的 [INTENSIFIES] 抖动表情。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["intensifies", "抖动表情", "slack 表情"],
  },
  {
    slug: "party",
    name: "派对彩虹",
    title: "派对鹦鹉生成器 — 给任意图片加彩虹",
    description:
      "让任意图片循环经过派对鹦鹉的彩虹配色。可选调色板、帧数，以及是整张图换色还是只给亮部换色。",
    blurb: "彩虹色彩循环，派对鹦鹉风格。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["派对鹦鹉", "彩虹表情", "slack 表情"],
  },
  {
    slug: "emojify",
    name: "表情动效",
    title: "Slack 动态表情效果",
    description:
      "给任意图片套上流行的动态表情效果——旋转、弹跳、缩放、摇摆、震动、彩虹、滚动等，尺寸和命名都适配 Slack。",
    blurb: "旋转、弹跳、缩放、摇摆、彩虹等。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["slack 动态表情", "表情生成器", "旋转表情", "弹跳表情"],
  },
  {
    slug: "old-man-yells",
    name: "老人咆哮",
    title: "老人咆哮 — Slack 表情生成器",
    description:
      "做一个「老人咆哮」Slack 表情：放进任意 logo，辛普森爷爷对着它挥拳。透明背景、128px，可导出静态 PNG 或动态 GIF。",
    blurb: "辛普森爷爷对着任意 logo 挥拳。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["老人咆哮", "old man yells at", "slack 表情"],
  },
  {
    slug: "on-fire",
    name: "着火",
    title: "着火表情生成器 — 让任意图片烧起来",
    description:
      "让任意图片着火：经典的动态火焰在图片后面燃烧，也可以放到前方。透明背景、128px Slack 表情，可导出动态 GIF 或静态 PNG。",
    blurb: "任意图片陷进动态火焰。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["着火表情", "火焰 gif", "slack 表情"],
  },
  {
    slug: "number",
    name: "数字",
    title: "100 分数字表情生成器",
    description:
      "生成 100 分风格的数字表情——任意数字，经典的双下划线红色样式，也可以自定义颜色。导出静态 PNG 或发光动态 GIF。",
    blurb: "任意数字与配色的 100 分样式。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["100 表情", "数字表情", "百分表情"],
  },
  {
    slug: "text-emoji",
    name: "文字表情",
    title: "Slack 方形文字表情生成器",
    description:
      "把「yes」「nope」这样的短句变成方形、清晰的 Slack 表情。自动换行，并附带多种现成样式。",
    blurb: "「hell yeah」变成 128px 方形表情。",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["文字表情", "slack 文字表情", "方形表情"],
  },
];

export const TOOLS_BY_SLUG: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export function toolsIn(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getTool(slug: string): Tool {
  const t = TOOLS_BY_SLUG[slug];
  if (!t) throw new Error(`未知的工具 slug：${slug}`);
  return t;
}
