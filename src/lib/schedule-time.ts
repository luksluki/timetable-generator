import { PERIODS_PER_DAY } from "@/lib/schedule-config";

export type PeriodDef = { index: number; start: string; end: string };
export type BreakDef = {
  id: string;
  afterIndex: number;
  start: string;
  end: string;
  label: string;
};
export type ScheduleConfigData = { periods: PeriodDef[]; breaks: BreakDef[] };

export type TimelineEntry =
  | { kind: "period"; period: PeriodDef }
  | { kind: "break"; brk: BreakDef };

export const DEFAULT_PERIODS: PeriodDef[] = [
  { index: 0, start: "07:00", end: "07:40" },
  { index: 1, start: "07:40", end: "08:20" },
  { index: 2, start: "08:20", end: "09:00" },
  { index: 3, start: "09:00", end: "09:40" },
  { index: 4, start: "10:00", end: "10:40" },
  { index: 5, start: "10:40", end: "11:20" },
  { index: 6, start: "11:20", end: "12:00" },
  { index: 7, start: "12:30", end: "13:10" },
  { index: 8, start: "13:10", end: "13:50" },
];

export const DEFAULT_BREAKS: BreakDef[] = [
  { id: "b1", afterIndex: 3, start: "09:40", end: "10:00", label: "Istirahat" },
  { id: "b2", afterIndex: 6, start: "12:00", end: "12:30", label: "Makan Siang" },
];

export function defaultConfig(): ScheduleConfigData {
  return {
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    breaks: DEFAULT_BREAKS.map((b) => ({ ...b })),
  };
}

function asPeriod(p: Record<string, unknown>): PeriodDef | null {
  const index = Number(p.index);
  if (Number.isNaN(index)) return null;
  return {
    index,
    start: String(p.start ?? ""),
    end: String(p.end ?? ""),
  };
}

function asBreak(b: Record<string, unknown>): BreakDef | null {
  const afterIndex = Number(b.afterIndex);
  if (Number.isNaN(afterIndex)) return null;
  return {
    id: String(b.id ?? `b${Math.random().toString(36).slice(2)}`),
    afterIndex,
    start: String(b.start ?? ""),
    end: String(b.end ?? ""),
    label: String(b.label ?? "Break"),
  };
}

export function normalizeConfig(
  periodsRaw: unknown,
  breaksRaw: unknown,
): ScheduleConfigData {
  const periods = (Array.isArray(periodsRaw) ? periodsRaw : [])
    .map((p) => asPeriod(p as Record<string, unknown>))
    .filter((p): p is PeriodDef => p !== null)
    .sort((a, b) => a.index - b.index);
  const breaks = (Array.isArray(breaksRaw) ? breaksRaw : [])
    .map((b) => asBreak(b as Record<string, unknown>))
    .filter((b): b is BreakDef => b !== null);
  return { periods, breaks };
}

/** Merge periods + breaks into an ordered day timeline. */
export function buildTimeline(cfg: ScheduleConfigData): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const p of cfg.periods) {
    out.push({ kind: "period", period: p });
    for (const b of cfg.breaks) {
      if (b.afterIndex === p.index) out.push({ kind: "break", brk: b });
    }
  }
  return out;
}

export function periodTimeLabel(cfg: ScheduleConfigData, periodIdx: number): string {
  const p = cfg.periods.find((x) => x.index === periodIdx);
  return p ? `${p.start}–${p.end}` : "";
}

/** Ensure the periods array covers PERIODS_PER_DAY entries. */
export function ensureConfigRows(cfg: ScheduleConfigData): ScheduleConfigData {
  const periods = [...cfg.periods];
  while (periods.length < PERIODS_PER_DAY) {
    periods.push({ index: periods.length, start: "", end: "" });
  }
  periods.forEach((p, i) => (p.index = i));
  return { ...cfg, periods };
}
