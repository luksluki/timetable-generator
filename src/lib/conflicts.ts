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

  const teacherGrid = new Map<string, SlotView[][]>();
  const classGrid = new Map<string, SlotView[][]>();
  const roomGrid = new Map<string, SlotView[][]>();
  const blockGrid = new Map<string, SlotView[][]>();
  const teacherDay = new Map<string, SlotView[][]>();

  const gridSize = DAYS_PER_WEEK * PERIODS_PER_DAY;

  for (const s of slots) {
    const d = s.dayOfWeek;
    const p = s.periodIdx;

    if (d < 0 || d >= DAYS_PER_WEEK || p < 0 || p >= PERIODS_PER_DAY) {
      conflicts.push({
        kind: "bounds",
        level: "hard",
        slotIds: [s.id],
        message: "Slot is outside the valid day/period grid.",
      });
      continue;
    }

    if (s.isHeavy && !MORNING_PERIOD_INDICES.includes(p)) {
      conflicts.push({
        kind: "heavyMorning",
        level: "soft",
        slotIds: [s.id],
        message: `${s.subjectName} (heavy) is not in a morning period.`,
      });
    }

    const gridIdx = d * PERIODS_PER_DAY + p;

    let tArr = teacherGrid.get(s.teacherId);
    if (!tArr) { tArr = Array.from({ length: gridSize }, () => []); teacherGrid.set(s.teacherId, tArr); }
    tArr[gridIdx].push(s);

    let cArr = classGrid.get(s.classGroupId);
    if (!cArr) { cArr = Array.from({ length: gridSize }, () => []); classGrid.set(s.classGroupId, cArr); }
    cArr[gridIdx].push(s);

    if (s.roomId) {
      let rArr = roomGrid.get(s.roomId);
      if (!rArr) { rArr = Array.from({ length: gridSize }, () => []); roomGrid.set(s.roomId, rArr); }
      rArr[gridIdx].push(s);
    }

    let bArr = blockGrid.get(s.allocationId);
    if (!bArr) { bArr = Array.from({ length: DAYS_PER_WEEK }, () => []); blockGrid.set(s.allocationId, bArr); }
    bArr[d].push(s);

    let tdArr = teacherDay.get(s.teacherId);
    if (!tdArr) { tdArr = Array.from({ length: DAYS_PER_WEEK }, () => []); teacherDay.set(s.teacherId, tdArr); }
    tdArr[d].push(s);
  }

  for (const grid of teacherGrid.values()) {
    for (let i = 0; i < gridSize; i++) {
      if (grid[i].length > 1) {
        conflicts.push({ kind: "teacher", level: "hard", slotIds: grid[i].map(s => s.id), message: `Teacher ${grid[i][0].teacherCode} is double-booked.` });
      }
    }
  }

  for (const grid of classGrid.values()) {
    for (let i = 0; i < gridSize; i++) {
      if (grid[i].length > 1) {
        conflicts.push({ kind: "class", level: "hard", slotIds: grid[i].map(s => s.id), message: `Class ${grid[i][0].classGroupName} is double-booked.` });
      }
    }
  }

  for (const grid of roomGrid.values()) {
    for (let i = 0; i < gridSize; i++) {
      if (grid[i].length > 1) {
        conflicts.push({ kind: "room", level: "hard", slotIds: grid[i].map(s => s.id), message: `Room ${grid[i][0].roomName} is double-booked.` });
      }
    }
  }

  for (const grid of blockGrid.values()) {
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const group = grid[d];
      if (group.length <= 1) continue;
      const periods = group.map(s => s.periodIdx).sort((a, b) => a - b);
      let contiguous = true;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] !== periods[i - 1] + 1) {
          contiguous = false;
          break;
        }
      }
      if (!contiguous) {
        conflicts.push({ kind: "contiguity", level: "hard", slotIds: group.map(s => s.id), message: `${group[0].subjectName} block is not contiguous.` });
      }
    }
  }

  for (const grid of teacherDay.values()) {
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const group = grid[d];
      if (group.length === 0) continue;
      const byPeriod = [...group].sort((a, b) => a.periodIdx - b.periodIdx);
      const periods = byPeriod.map(s => s.periodIdx);
      
      const present = new Set(periods);
      for (let p = periods[0] + 1; p < periods[periods.length - 1]; p++) {
        if (!present.has(p)) {
          conflicts.push({ kind: "gap", level: "soft", slotIds: [], message: `Teacher ${group[0].teacherCode} has a free gap on this day.` });
          break;
        }
      }
      
      let run = 1;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] === periods[i - 1] + 1) run++;
        else {
          if (run > MAX_CONSECUTIVE_TEACHING) {
            conflicts.push({ kind: "consecutive", level: "soft", slotIds: byPeriod.slice(i - run, i).map(s => s.id), message: `Teacher ${group[0].teacherCode} teaches ${run} consecutive periods.` });
          }
          run = 1;
        }
      }
      if (run > MAX_CONSECUTIVE_TEACHING) {
        conflicts.push({ kind: "consecutive", level: "soft", slotIds: byPeriod.slice(periods.length - run).map(s => s.id), message: `Teacher ${group[0].teacherCode} teaches ${run} consecutive periods.` });
      }
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
