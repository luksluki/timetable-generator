import { prisma } from "@/lib/prisma";
import {
  defaultConfig,
  normalizeConfig,
  type ScheduleConfigData,
} from "@/lib/schedule-time";

/** Load the JP/break config from the DB, falling back to defaults. */
export async function getScheduleConfig(): Promise<ScheduleConfigData> {
  const row = await prisma.scheduleConfig.findUnique({ where: { id: 1 } });
  if (!row) return defaultConfig();
  return normalizeConfig(row.periods, row.breaks, row.academicYear, row.semester);
}
