import JapaneseHolidays from "japanese-holidays";

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** 日本の祝日・振替休日・国民の休日（JST の暦日で判定） */
function isJapanesePublicHoliday(d: Date): boolean {
  return Boolean(JapaneseHolidays.isHolidayAt(d, true));
}

function isBusinessDay(d: Date): boolean {
  return !isWeekend(d) && !isJapanesePublicHoliday(d);
}

function normalizeNoon(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

/**
 * Excel WORKDAY に近い挙動: 開始日の翌日から営業日を数え、
 * `days` 営業日後の日付を返す（開始日自体はカウントに含めない）。
 * 営業日 = 土日・日本の祝日（振替・国民の休日含む）以外。
 */
export function addBusinessDaysAfter(start: Date, days: number): Date {
  const d = normalizeNoon(start);
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) remaining -= 1;
  }
  return d;
}

/**
 * 両端を含めた期間内の営業日数（土日・日本の祝日を除く）。
 */
export function countBusinessDaysInclusive(start: Date, end: Date): number {
  const a = normalizeNoon(start);
  const b = normalizeNoon(end);
  if (b < a) return 0;
  let count = 0;
  const cur = new Date(a);
  while (cur <= b) {
    if (isBusinessDay(cur)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
