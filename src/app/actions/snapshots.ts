"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getScheduleDataAction } from "./schedule";

function revalidateAll() {
  revalidatePath("/timetable");
  revalidatePath("/schedule");
}

export async function createSnapshot(name: string) {
  try {
    const slots = await prisma.scheduleSlot.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { periodIdx: "asc" }],
    });

    if (slots.length === 0) {
      return { ok: false as const, message: "No timetable to snapshot." };
    }

    await prisma.timetableSnapshot.create({
      data: {
        name,
        slotsData: slots as object,
      },
    });
    
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: (e as Error).message };
  }
}

export async function getSnapshots() {
  try {
    const snapshots = await prisma.timetableSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });
    return { ok: true as const, snapshots };
  } catch (e) {
    return { ok: false as const, message: (e as Error).message };
  }
}

export async function deleteSnapshot(id: string) {
  try {
    await prisma.timetableSnapshot.delete({ where: { id } });
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: (e as Error).message };
  }
}

export async function restoreSnapshot(id: string) {
  try {
    const snapshot = await prisma.timetableSnapshot.findUnique({
      where: { id },
    });
    if (!snapshot) {
      return { ok: false as const, message: "Snapshot not found." };
    }

    const slots = snapshot.slotsData as unknown as Array<{
      id: string;
      allocationId: string;
      roomId: string | null;
      classGroupId: string;
      dayOfWeek: number;
      periodIdx: number;
      isLocked: boolean;
      blockTag: string | null;
    }>;

    // Transaction to clear and insert
    await prisma.$transaction([
      prisma.scheduleSlot.deleteMany({}),
      prisma.scheduleSlot.createMany({
        data: slots.map((s) => ({
          id: s.id,
          allocationId: s.allocationId,
          roomId: s.roomId,
          classGroupId: s.classGroupId,
          dayOfWeek: s.dayOfWeek,
          periodIdx: s.periodIdx,
          isLocked: s.isLocked ?? false,
          blockTag: s.blockTag ?? null,
        })),
      }),
    ]);

    revalidateAll();
    const data = await getScheduleDataAction();
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, message: (e as Error).message };
  }
}
