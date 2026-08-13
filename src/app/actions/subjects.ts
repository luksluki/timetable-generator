"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { subjectSchema } from "@/lib/validators";

function revalidateAll() {
  revalidatePath("/admin/classes");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function upsertSubject(input: unknown, id?: string) {
  const data = subjectSchema.parse(input);
  try {
    if (id) await prisma.subject.update({ where: { id }, data });
    else await prisma.subject.create({ data });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteSubject(id: string) {
  try {
    await prisma.subject.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
