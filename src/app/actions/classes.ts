"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { classGroupSchema } from "@/lib/validators";

function revalidateAll() {
  revalidatePath("/admin/classes");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function upsertClassGroup(input: unknown, id?: string) {
  const data = classGroupSchema.parse(input);
  try {
    if (id) await prisma.classGroup.update({ where: { id }, data });
    else await prisma.classGroup.create({ data });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteClassGroup(id: string) {
  try {
    await prisma.classGroup.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
