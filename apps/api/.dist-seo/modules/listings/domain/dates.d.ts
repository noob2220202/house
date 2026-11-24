/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export declare function dateOnlyToDate(value: string): Date;
/** @db.Date column → "YYYY-MM-DD". */
export declare function dateToDateOnly(value: Date | null | undefined): string | null;
/** "YYYY-MM-DD" (a KST calendar day) → the instant of that day's KST midnight. */
export declare function kstDayStart(value: string): Date;
/** Today's date in Asia/Seoul as "YYYY-MM-DD". */
export declare function kstToday(now?: Date): string;
/** "YYYY-MM-DD" + `days` calendar days. */
export declare function addDaysToDateOnly(value: string, days: number): string;
