/** `<input type="date">` の値 (YYYY-MM-DD) をローカル日付として解釈 */
export function parseInputDate(value: string): Date | null {
  if (!value.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function formatDateJa(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

/** 表・カード向けの短い日付 */
export function formatDateShortJa(d: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(d);
}
