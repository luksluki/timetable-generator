"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { allocationSchema } from "@/lib/validators";
import { REQUIRED_WEEKLY_JP } from "@/lib/schedule-config";

function revalidateAll() {
  revalidatePath("/admin/allocations");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Sum of weekly hours already allocated to a class (optionally excluding one). */
async function classTotalJp(classGroupId: string, excludeId?: string) {
  const rows = await prisma.teachingAllocation.findMany({
    where: { classGroupId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { weeklyHours: true },
  });
  return rows.reduce((s, r) => s + r.weeklyHours, 0);
}

export async function upsertAllocation(input: unknown, id?: string) {
  const data = allocationSchema.parse(input);
  try {
    const current = id
      ? await prisma.teachingAllocation.findUnique({ where: { id } })
      : null;
    const excludeId = current?.classGroupId === data.classGroupId ? id : undefined;
    const total = (await classTotalJp(data.classGroupId, excludeId)) + data.weeklyHours;
    if (total > REQUIRED_WEEKLY_JP) {
      return {
        ok: false as const,
        error: `Class would total ${total} JP (max ${REQUIRED_WEEKLY_JP}).`,
      };
    }

    if (id) await prisma.teachingAllocation.update({ where: { id }, data });
    else await prisma.teachingAllocation.create({ data });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteAllocation(id: string) {
  try {
    await prisma.teachingAllocation.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
