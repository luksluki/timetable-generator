"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { piketSchema } from "@/lib/validators";

function revalidateAll() {
  revalidatePath("/admin/piket");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
  revalidatePath("/");
}

/** Assign a teacher to piket on a given day (idempotent upsert). */
export async function setPiket(input: unknown) {
  const { teacherId, dayOfWeek } = piketSchema.parse(input);
  try {
    await prisma.teacherPiket.upsert({
      where: { teacherId_dayOfWeek: { teacherId, dayOfWeek } },
      create: { teacherId, dayOfWeek },
      update: { teacherId, dayOfWeek },
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function removePiket(teacherId: string, dayOfWeek: number) {
  try {
    await prisma.teacherPiket.delete({
      where: { teacherId_dayOfWeek: { teacherId, dayOfWeek } },
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
