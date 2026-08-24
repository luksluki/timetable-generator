import { prisma } from "@/lib/prisma";
import { getScheduleConfig } from "@/lib/schedule-time-server";
import {
  DAYS_PER_WEEK,
  MAX_CONSECUTIVE_TEACHING,
  MORNING_PERIOD_INDICES,
  PERIODS_PER_DAY,
  SOFT_WEIGHTS,
} from "@/lib/schedule-config";

export type SolverPayload = ReturnType<typeof buildSolverPayload> extends Promise<infer T>
  ? T
  : never;

/** Threshold above which a piket teacher is capped to one class on their piket day. */
export const PIKET_LOAD_THRESHOLD = 30;

/**
 * Assemble the JSON problem description handed to the Python CP-SAT solver.
 */
export async function buildSolverPayload(opts?: {
  timeoutSeconds?: number;
  piketRule?: "capOver30" | "blockUnder33";
}) {
  const [teachers, classes, subjects, allocations, piket, rooms, config] =
    await Promise.all([
      prisma.teacher.findMany(),
      prisma.classGroup.findMany({ orderBy: { name: "asc" } }),
      prisma.subject.findMany(),
      prisma.teachingAllocation.findMany(),
      prisma.teacherPiket.findMany(),
      prisma.room.findMany(),
      getScheduleConfig(),
    ]);

  // Weekly load per teacher (sum of allocation weeklyHours).
  const loadByTeacher = new Map<string, number>();
  for (const a of allocations) {
    loadByTeacher.set(
      a.teacherId,
      (loadByTeacher.get(a.teacherId) ?? 0) + a.weeklyHours,
    );
  }

  // Homeroom per class ("Ruang <className>") and lab rooms grouped by category.
  const classRooms: Record<string, string> = {};
  const labSubjects: Record<string, string[]> = {};
  for (const c of classes) {
    const homeroom = rooms.find((r) => r.name === `Ruang ${c.name}`);
    if (homeroom) classRooms[c.id] = homeroom.id;
  }
  for (const r of rooms) {
    if (r.roomType && r.roomType !== "REGULAR") {
      (labSubjects[r.roomType] ??= []).push(r.id);
    }
  }

  return {
    daysPerWeek: DAYS_PER_WEEK,
    periodsPerDay: config.periods.length,
    activePeriodsPerDay: config.activePeriodsPerDay,
    maxConsecutiveTeaching: MAX_CONSECUTIVE_TEACHING,
    morningPeriods: MORNING_PERIOD_INDICES,
    softWeights: SOFT_WEIGHTS,
    piketLoadThreshold: PIKET_LOAD_THRESHOLD,
    timeoutSeconds: opts?.timeoutSeconds ?? 30,
    /** Piket policy: default capOver30, or proposed blockUnder33. */
    piketRule: opts?.piketRule ?? "capOver30",
    /** Push class free-periods to the end of each day (no mid-day gaps). */
    enableClassGapSoft: true,
    classes: classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade })),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      totalJp: s.totalJp,
      splitPattern: s.splitPattern,
      isHeavy: s.isHeavySubject,
      category: s.category,
    })),
    teachers: teachers.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      maxHoursPerDay: t.maxHoursPerDay,
      blockedDays: t.blockedDays,
      forceStartDay: t.forceStartDay,
      forceStartPeriod: t.forceStartPeriod,
      isFixedSchedule: t.isFixedSchedule,
      weeklyLoad: loadByTeacher.get(t.id) ?? 0,
    })),
    allocations: allocations.map((a) => ({
      id: a.id,
      teacherId: a.teacherId,
      classGroupId: a.classGroupId,
      subjectId: a.subjectId,
      weeklyHours: a.weeklyHours,
    })),
    piket: piket.map((p) => ({
      teacherId: p.teacherId,
      dayOfWeek: p.dayOfWeek,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      roomType: r.roomType,
      isLab: r.isLab,
    })),
    classRooms,
    labSubjects,
    lockedSlots: [] as {
      allocationId: string;
      chunkIdx?: number;
      dayOfWeek: number;
      periodIdx: number;
    }[],
  };
}
