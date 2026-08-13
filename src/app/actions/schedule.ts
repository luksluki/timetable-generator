"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  detectConflicts,
  hasHardConflict,
  type Conflict,
} from "@/lib/conflicts";
import {
  PERIODS_PER_DAY,
  DAYS_PER_WEEK,
} from "@/lib/schedule-config";
import type { SlotView } from "@/lib/schedule-data";
import { getScheduleData, type ScheduleData } from "@/lib/schedule-data";

export type MoveResult = {
  ok: boolean;
  conflicts: Conflict[];
  message: string;
};

/** Server-callable fetch of the full schedule + lookups (post-generate refresh). */
export async function getScheduleDataAction(): Promise<ScheduleData> {
  return getScheduleData();
}

/**
 * Move the entire contiguous block containing `slotId` so the dragged cell
 * lands at (toDay, toPeriod). Hard conflicts abort the move; soft conflicts
 * are persisted and returned as warnings.
 */
export async function moveScheduleBlock(input: {
  slotId: string;
  toDay: number;
  toPeriod: number;
}): Promise<MoveResult> {
  const { slotId, toDay, toPeriod } = input;

  if (
    toDay < 0 ||
    toDay >= DAYS_PER_WEEK ||
    toPeriod < 0 ||
    toPeriod >= PERIODS_PER_DAY
  ) {
    return {
      ok: false,
      conflicts: [],
      message: "Target is outside the timetable grid.",
    };
  }

  const rows = await prisma.scheduleSlot.findMany({
    include: {
      allocation: {
        include: { teacher: true, subject: true, classGroup: true },
      },
      room: true,
    },
  });

  const slots: SlotView[] = rows.map((s) => ({
    id: s.id,
    allocationId: s.allocationId,
    classGroupId: s.classGroupId,
    classGroupName: s.allocation.classGroup.name,
    teacherId: s.allocation.teacherId,
    teacherCode: s.allocation.teacher.code,
    teacherName: s.allocation.teacher.name,
    subjectId: s.allocation.subjectId,
    subjectName: s.allocation.subject.name,
    subjectCode: s.allocation.subject.code,
    isHeavy: s.allocation.subject.isHeavySubject,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    dayOfWeek: s.dayOfWeek,
    periodIdx: s.periodIdx,
    isLocked: s.isLocked,
    blockTag: s.blockTag,
  }));

  const dragged = slots.find((s) => s.id === slotId);
  if (!dragged) {
    return { ok: false, conflicts: [], message: "Slot not found." };
  }
  if (dragged.isLocked) {
    return {
      ok: false,
      conflicts: [],
      message: "This slot is locked (fixed schedule) and cannot be moved.",
    };
  }

  // The block = same allocation on the same day (contiguous run).
  const block = slots.filter(
    (s) =>
      s.allocationId === dragged.allocationId &&
      s.dayOfWeek === dragged.dayOfWeek,
  );
  const blockPeriods = block.map((s) => s.periodIdx);
  const minP = Math.min(...blockPeriods);
  const offset = dragged.periodIdx - minP;
  const newStart = toPeriod - offset;
  const blockLen = block.length;

  if (newStart < 0 || newStart + blockLen > PERIODS_PER_DAY) {
    return {
      ok: false,
      conflicts: [],
      message: "The block does not fit at the target position.",
    };
  }

  // Build the optimistic view to validate.
  const movedIds = new Set(block.map((s) => s.id));
  const optimistic: SlotView[] = slots.map((s) => {
    if (!movedIds.has(s.id)) return s;
    const rel = s.periodIdx - minP;
    return {
      ...s,
      dayOfWeek: toDay,
      periodIdx: newStart + rel,
      blockTag: `${s.allocationId}_${toDay}`,
    };
  });

  const conflicts = detectConflicts(optimistic);
  if (hasHardConflict(conflicts)) {
    return {
      ok: false,
      conflicts,
      message: "Move blocked by a hard constraint violation.",
    };
  }

  // Persist the new positions for the block.
  await prisma.$transaction(
    block.map((s) => {
      const rel = s.periodIdx - minP;
      return prisma.scheduleSlot.update({
        where: { id: s.id },
        data: {
          dayOfWeek: toDay,
          periodIdx: newStart + rel,
          blockTag: `${s.allocationId}_${toDay}`,
        },
      });
    }),
  );

  revalidatePath("/schedule");

  const soft = conflicts.filter((c) => c.level === "soft");
  return {
    ok: true,
    conflicts: soft,
    message: soft.length
      ? `Block moved with ${soft.length} soft warning(s).`
      : "Block moved successfully.",
  };
}
