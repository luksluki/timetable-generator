import { prisma } from "@/lib/prisma";
import { TeachersManager } from "@/components/admin/modules/teachers-manager";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const teachers = await prisma.teacher.findMany({ orderBy: { code: "asc" } });
  const rows = teachers.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    subjectName: t.subjectName ?? "",
    maxHoursPerDay: t.maxHoursPerDay,
    blockedDays: t.blockedDays,
    forceStartDay: t.forceStartDay,
    forceStartPeriod: t.forceStartPeriod,
    isFixedSchedule: t.isFixedSchedule,
  }));
  return <TeachersManager teachers={rows} />;
}
