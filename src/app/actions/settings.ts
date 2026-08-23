"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  normalizeConfig,
  DEFAULT_PERIODS,
  DEFAULT_BREAKS,
} from "@/lib/schedule-time";

function revalidateAll() {
  revalidatePath("/admin/settings");
  revalidatePath("/timetable");
  revalidatePath("/schedule");
}

export async function saveScheduleConfig(input: {
  periods: unknown;
  breaks: unknown;
  academicYear: string;
  semester: string;
}) {
  try {
    const cfg = normalizeConfig(input.periods, input.breaks, input.academicYear, input.semester);
    await prisma.scheduleConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        periods: cfg.periods as object,
        breaks: cfg.breaks as object,
        academicYear: cfg.academicYear,
        semester: cfg.semester,
      },
      update: {
        periods: cfg.periods as object,
        breaks: cfg.breaks as object,
        academicYear: cfg.academicYear,
        semester: cfg.semester,
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

export async function resetScheduleConfig() {
  await prisma.scheduleConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      periods: DEFAULT_PERIODS as object,
      breaks: DEFAULT_BREAKS as object,
      academicYear: "2026-2027",
      semester: "Ganjil",
    },
    update: {
      periods: DEFAULT_PERIODS as object,
      breaks: DEFAULT_BREAKS as object,
      academicYear: "2026-2027",
      semester: "Ganjil",
    },
  });
  revalidateAll();
  return { ok: true as const };
}
