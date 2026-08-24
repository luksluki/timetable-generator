// Central timetable configuration shared across UI, API, seed and the solver payload.

/** Number of teaching days per week (Monday..Friday). dayOfWeek: 0=Mon .. 4=Fri */
export const DAYS_PER_WEEK = 5;

/**
 * Teaching periods per day.
 *
 * NOTE: The school provisions require exactly 42 JP per class group (the forced
 * subject splits 6+5+5+4+4+3+3+3+3+3+2+1 = 42). Over a 5-day week this needs
 * ceil(42/5) = 9 periods/day (45 slots) to be feasible. 8 periods (40 slots)
 * cannot hold 42 JP, so we use 9.
 */
export const PERIODS_PER_DAY = 9;

/** 
 * Required weekly lesson allocation (JP) per class group. 
 * @deprecated Use `getTotalWeeklyJp(config)` from `schedule-time.ts` instead.
 */
export const REQUIRED_WEEKLY_JP = 42;

/** Consecutive teaching periods allowed before a break is required (soft). */
export const MAX_CONSECUTIVE_TEACHING = 3;

/** Morning periods preferred for heavy subjects (Math / Science). */
export const MORNING_PERIOD_INDICES = [0, 1, 2];

export const DAY_NAMES_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
export const DAY_NAMES_EN = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

/** Period labels (1-based). */
export function periodLabel(periodIdx: number): string {
  return `JP ${periodIdx + 1}`;
}

/**
 * Cosmetic break annotations keyed by `${dayOfWeek}:${periodIdx}`.
 * These are display-only labels and do NOT remove teaching capacity,
 * keeping the 42-JP problem feasible.
 */
export const BREAK_ANNOTATIONS: Record<string, string> = {
  // Monday period 0 — flag ceremony note
  "0:0": "Upacara",
  // Friday last period — Friday prayer note
  "4:8": "Sholat Jumat",
};

/** Soft-constraint weights (1-10). */
export const SOFT_WEIGHTS = {
  teacherGap: 3,
  heavyMorning: 4,
  maxConsecutive: 5,
  /**
   * Penalises blank periods in the MIDDLE of a class's day (free periods are
   * pushed to the end of the day). High weight to strongly prefer compact days.
   */
  classGap: 6,
} as const;

export type SplitPattern = {
  weeklyJp: number;
  /** Exact daily JP chunks, e.g. [3, 3] for a 6-JP subject. */
  chunks: number[];
};

/** Forced daily split patterns per the school provisions. */
export const SPLIT_BY_JP: Record<number, number[]> = {
  6: [3, 3],
  5: [3, 2],
  4: [2, 2],
  3: [3],
  2: [2],
  1: [1],
};

export function chunksForJp(weeklyJp: number): number[] {
  return SPLIT_BY_JP[weeklyJp] ?? [weeklyJp];
}
