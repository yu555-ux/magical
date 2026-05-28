/** Strip "N|" / "选项N:" prefixes from option strings */
export function cleanOption(raw: string): string {
  // "1|选项一" format
  if (/^\d+[|｜]/.test(raw)) return raw.replace(/^\d+[|｜]\s*/, '');
  // "选项1:..." or "选项一：..." format
  const m = raw.match(/^选项[一二三四五六七八九十\d]+\s*[:：]\s*(.*)/);
  if (m) return m[1];
  return raw;
}
