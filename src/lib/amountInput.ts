/** 表示用: 数字だけの文字列を ja-JP の桁区切りにする */
export function formatAmountFromDigits(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d === "") return "";
  const n = Number(d);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ja-JP");
}

/** 計算・パース用: カンマを除去 */
export function stripAmountCommas(s: string): string {
  return s.replace(/,/g, "").trim();
}
