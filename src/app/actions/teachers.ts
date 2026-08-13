"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { teacherSchema } from "@/lib/validators";

function revalidateAll() {
  revalidatePath("/admin/teachers");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function upsertTeacher(input: unknown, id?: string) {
  const data = teacherSchema.parse(input);
  try {
    if (id) {
      await prisma.teacher.update({ where: { id }, data });
    } else {
      await prisma.teacher.create({ data });
    }
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteTeacher(id: string) {
  try {
    await prisma.teacher.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
