/** Glossary terms. Shared by the page and scripts/gen-agent-files.mjs. */
export const TERMS: { term: string; body: string; see?: string }[] = [
  {
    term: "调色板",
    body: "GIF 每帧最多存 256 种颜色，这些颜色列在调色板里。颜色越少，文件越小，渐变也越平。这里的工具会先从整段动画生成一份调色板，再把每一帧映射上去，避免逐帧调色板带来的颜色闪烁。",
    see: "optimize",
  },
  {
    term: "抖动",
    body: "把两种调色板颜色的像素交错排列，伪造出第三种颜色。它能掩盖渐变里的色带，代价是画面更噪、文件更大。扁平插画和截图建议关掉，照片和视频建议保留。",
    see: "video-to-gif",
  },
  {
    term: "帧延迟",
    body: "一帧在屏幕上停留的时间，以百分之一秒为单位。多数浏览器会把小于 2（20ms）的值抬到 10，所以按 100fps 做的 GIF 实际只播 10fps。这里的变速会重写延迟，而不是能保留帧就丢帧。",
    see: "speed",
  },
  {
    term: "有损压缩",
    body: "丢掉观众基本注意不到的细节，让文件变小。gifsicle 的有损模式允许相邻像素归并到同一种颜色；JPEG 和 WebP 的质量参数对静态图片做的是同一件事。",
    see: "compress",
  },
  {
    term: "色彩量化",
    body: "把图片的完整色彩范围缩减到调色板大小。这里的工具会一次性量化整段动画，让颜色在帧与帧之间保持稳定。",
    see: "convert",
  },
  {
    term: "APNG",
    body: "动态 PNG。和 GIF 只有单一透明色不同，它支持完整 24 位色和真正的 alpha 透明，当前所有浏览器都支持。Slack 不接受它做自定义表情，那里请用 GIF。",
    see: "convert",
  },
  {
    term: "动态 WebP",
    body: "一种更现代的动画格式，通常只有同内容 GIF 的一半大小。适合网页，但 Slack 不接受它做自定义表情。",
    see: "convert",
  },
  {
    term: "透明度",
    body: "GIF 的透明是二值的：一个像素要么完全透明，要么完全不透明，所以柔和边缘看起来会有锯齿。表情生成器会用硬边缘来规避这一点。",
    see: "text-emoji",
  },
  {
    term: "Slack 表情限制",
    body: "自定义表情必须小于 128KB，显示时大约 22px 见方，名字只能包含小写字母、数字、连字符和下划线。这里每个下载都按这条规则命名。",
    see: "text-emoji",
  },
  {
    term: "WebAssembly（wasm）",
    body: "在浏览器里以接近原生速度运行的编译代码。这里的 ffmpeg、gifsicle 和 ImageMagick 都编译成了 WebAssembly，所以没有任何东西被上传到服务器。",
  },
];
