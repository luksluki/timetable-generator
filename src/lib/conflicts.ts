import type { SlotView } from "@/lib/schedule-data";
import {
  MAX_CONSECUTIVE_TEACHING,
  MORNING_PERIOD_INDICES,
  PERIODS_PER_DAY,
  DAYS_PER_WEEK,
} from "@/lib/schedule-config";

export type ConflictKind =
  | "teacher"
  | "class"
  | "room"
  | "contiguity"
  | "bounds"
  | "locked"
  | "heavyMorning"
  | "gap"
  | "consecutive";

export type ConflictLevel = "hard" | "soft";

export type Conflict = {
  kind: ConflictKind;
  level: ConflictLevel;
  slotIds: string[];
  message: string;
};

const HARD_KINDS: ReadonlySet<ConflictKind> = new Set([
  "teacher",
  "class",
  "room",
  "contiguity",
  "bounds",
  "locked",
]);

export function isHard(kind: ConflictKind): boolean {
  return HARD_KINDS.has(kind);
}

/** Group consecutive cells of the same block (allocation + day). */
export function blockCells(slots: SlotView[], slot: SlotView): SlotView[] {
  const tag = slot.blockTag ?? slot.allocationId;
  return slots.filter(
    (s) =>
      (s.blockTag ?? s.allocationId) === tag &&
      s.dayOfWeek === slot.dayOfWeek &&
      s.allocationId === slot.allocationId,
  );
}

/**
 * Detect hard and soft constraint violations across a set of slots.
 * Pure function — safe to run on the client (optimistic) and server (validate).
 */
export function detectConflicts(slots: SlotView[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Bounds & locked + heavy morning
  for (const s of slots) {
    if (
      s.dayOfWeek < 0 ||
      s.dayOfWeek >= DAYS_PER_WEEK ||
      s.periodIdx < 0 ||
      s.periodIdx >= PERIODS_PER_DAY
    ) {
      conflicts.push({
        kind: "bounds",
        level: "hard",
        slotIds: [s.id],
        message: "Slot is outside the valid day/period grid.",
      });
    }
    if (s.isHeavy && !MORNING_PERIOD_INDICES.includes(s.periodIdx)) {
      conflicts.push({
        kind: "heavyMorning",
        level: "soft",
        slotIds: [s.id],
        message: `${s.subjectName} (heavy) is not in a morning period.`,
      });
    }
  }

  const byKey = (keyFn: (s: SlotView) => string | null) => {
    const m = new Map<string, SlotView[]>();
    for (const s of slots) {
      const k = keyFn(s);
      if (k === null) continue;
      (m.get(k) ?? m.set(k, []).get(k)!).push(s);
    }
    return m;
  };

  // Teacher double-booking
  for (const [, group] of byKey(
    (s) => `${s.teacherId}|${s.dayOfWeek}|${s.periodIdx}`,
  )) {
    if (group.length > 1) {
      conflicts.push({
        kind: "teacher",
        level: "hard",
        slotIds: group.map((s) => s.id),
        message: `Teacher ${group[0].teacherCode} is double-booked.`,
      });
    }
  }
  // Class double-booking
  for (const [, group] of byKey(
    (s) => `${s.classGroupId}|${s.dayOfWeek}|${s.periodIdx}`,
  )) {
    if (group.length > 1) {
      conflicts.push({
        kind: "class",
        level: "hard",
        slotIds: group.map((s) => s.id),
        message: `Class ${group[0].classGroupName} is double-booked.`,
      });
    }
  }
  // Room double-booking
  for (const [, group] of byKey(
    (s) => (s.roomId ? `${s.roomId}|${s.dayOfWeek}|${s.periodIdx}` : null),
  )) {
    if (group.length > 1) {
      conflicts.push({
        kind: "room",
        level: "hard",
        slotIds: group.map((s) => s.id),
        message: `Room ${group[0].roomName} is double-booked.`,
      });
    }
  }

  // Block contiguity: same allocation+day must occupy consecutive periods.
  const blockMap = new Map<string, SlotView[]>();
  for (const s of slots) {
    const k = `${s.allocationId}|${s.dayOfWeek}`;
    (blockMap.get(k) ?? blockMap.set(k, []).get(k)!).push(s);
  }
  for (const [, group] of blockMap) {
    if (group.length <= 1) continue;
    const periods = group.map((s) => s.periodIdx).sort((a, b) => a - b);
    let contiguous = true;
    for (let i = 1; i < periods.length; i++) {
      if (periods[i] !== periods[i - 1] + 1) {
        contiguous = false;
        break;
      }
    }
    if (!contiguous) {
      conflicts.push({
        kind: "contiguity",
        level: "hard",
        slotIds: group.map((s) => s.id),
        message: `${group[0].subjectName} block is not contiguous.`,
      });
    }
  }

  // Per-teacher soft checks: gaps + consecutive teaching.
  const teacherDay = new Map<string, SlotView[]>();
  for (const s of slots) {
    const k = `${s.teacherId}|${s.dayOfWeek}`;
    (teacherDay.get(k) ?? teacherDay.set(k, []).get(k)!).push(s);
  }
  for (const [, group] of teacherDay) {
    const byPeriod = [...group].sort((a, b) => a.periodIdx - b.periodIdx);
    const periods = byPeriod.map((s) => s.periodIdx);
    // gaps (holes between first and last)
    const present = new Set(periods);
    for (let p = periods[0] + 1; p < periods[periods.length - 1]; p++) {
      if (!present.has(p)) {
        conflicts.push({
          kind: "gap",
          level: "soft",
          slotIds: [],
          message: `Teacher ${group[0].teacherCode} has a free gap on this day.`,
        });
        break;
      }
    }
    // consecutive runs > MAX
    let run = 1;
    for (let i = 1; i < periods.length; i++) {
      if (periods[i] === periods[i - 1] + 1) run++;
      else {
        if (run > MAX_CONSECUTIVE_TEACHING) {
          conflicts.push({
            kind: "consecutive",
            level: "soft",
            slotIds: byPeriod.slice(i - run, i).map((s) => s.id),
            message: `Teacher ${group[0].teacherCode} teaches ${run} consecutive periods.`,
          });
        }
        run = 1;
      }
    }
    if (run > MAX_CONSECUTIVE_TEACHING) {
      conflicts.push({
        kind: "consecutive",
        level: "soft",
        slotIds: byPeriod.slice(periods.length - run).map((s) => s.id),
        message: `Teacher ${group[0].teacherCode} teaches ${run} consecutive periods.`,
      });
    }
  }

  return conflicts;
}

/** Map each slot id to its worst (hard > soft) conflict level. */
export function slotConflictLevels(
  conflicts: Conflict[],
): Map<string, ConflictLevel> {
  const out = new Map<string, ConflictLevel>();
  for (const c of conflicts) {
    for (const id of c.slotIds) {
      const existing = out.get(id);
      if (existing === "hard") continue;
      out.set(id, c.level === "hard" || existing === undefined ? c.level : existing);
    }
  }
  return out;
}

export function hasHardConflict(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.level === "hard");
}

/** Count free periods remaining per class (grid capacity - placed). */
export function classFreePeriods(slots: SlotView[], classGroupId: string): number {
  const used = slots.filter((s) => s.classGroupId === classGroupId).length;
  return DAYS_PER_WEEK * PERIODS_PER_DAY - used;
}
