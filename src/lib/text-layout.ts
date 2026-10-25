/**
 * 画布文本的换行工具。
 *
 * 原来的实现按空白分词，中文句子没有空格，于是整段被当成一个词：add-text 里
 * 会溢出画面，text-emoji 里会被压成一行。这里按「词」切分，中日韩文字逐字成词，
 * 拉丁词保持完整，再用同一个贪心算法折行。
 */

/** 中日韩统一表意文字、假名、谚文，以及全角标点。 */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;

export function hasCJK(text: string): boolean {
  return CJK.test(text);
}

/**
 * 折行用的最小单位：中日韩字符各自一个 token，拉丁单词连同其后的空格
 * 作为一个 token，这样拼接时不会丢掉词间空格。
 */
export function wrapTokens(text: string): string[] {
  if (!text) return [];
  if (!hasCJK(text)) return text.split(/(\s+)/).filter(Boolean);

  const tokens: string[] = [];
  let latin = "";
  const flush = () => {
    if (latin) tokens.push(latin);
    latin = "";
  };
  for (const ch of Array.from(text)) {
    if (CJK.test(ch)) {
      flush();
      tokens.push(ch);
    } else if (/\s/.test(ch)) {
      flush();
      tokens.push(ch);
    } else {
      latin += ch;
    }
  }
  flush();
  return tokens;
}

/** 把 `text` 折成不超过 `maxWidth` 的行，保留显式换行。 */
export function wrapText(
  ctx: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const token of wrapTokens(paragraph)) {
      const next = line + token;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = next;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
  }
  return lines;
}

/**
 * 按“词”拆分并给出拼接符：拉丁文按空格分词、用空格拼回；没有空格的中文
 * 按字拆、直接拼回，这样分行时不会在汉字之间插入空格。
 */
export function splitWords(text: string): { words: string[]; joiner: string } {
  const cjk = hasCJK(text);
  if (cjk && !/\s/.test(text.trim())) {
    return { words: Array.from(text.trim()), joiner: "" };
  }
  return { words: text.trim().split(/\s+/).filter(Boolean), joiner: " " };
}
