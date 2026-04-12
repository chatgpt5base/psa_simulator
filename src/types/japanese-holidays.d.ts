declare module "japanese-holidays" {
  interface JapaneseHolidaysStatic {
    /** 日本時間の暦日が祝日なら名称、そうでなければ falsy。furikae=true で振替休日・国民の休日を含む */
    isHolidayAt(date: Date, furikae?: boolean): string | undefined;
  }
  const JapaneseHolidays: JapaneseHolidaysStatic;
  export = JapaneseHolidays;
}
