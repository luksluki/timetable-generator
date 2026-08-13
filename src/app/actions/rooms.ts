"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { roomSchema } from "@/lib/validators";

function revalidateAll() {
  revalidatePath("/admin/rooms");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function upsertRoom(input: unknown, id?: string) {
  const data = roomSchema.parse(input);
  try {
    if (id) await prisma.room.update({ where: { id }, data });
    else await prisma.room.create({ data });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function deleteRoom(id: string) {
  try {
    await prisma.room.delete({ where: { id } });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}
