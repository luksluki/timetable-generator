import { prisma } from "@/lib/prisma";
import { ClassesSubjectsManager } from "@/components/admin/modules/classes-manager";
import { getScheduleConfig } from "@/lib/schedule-time-server";
import { getTotalWeeklyJp } from "@/lib/schedule-time";

export const dynamic = "force-dynamic";

export default async function ClassesSubjectsPage() {
  const [classes, subjects, config] = await Promise.all([
    prisma.classGroup.findMany({
      orderBy: { name: "asc" },
      include: { allocations: { select: { weeklyHours: true } } },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    getScheduleConfig(),
  ]);

  const requiredWeeklyJp = getTotalWeeklyJp(config);

  const classRows = classes.map((c) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    totalJp: c.allocations.reduce((s, a) => s + a.weeklyHours, 0),
  }));
  const subjectRows = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    totalJp: s.totalJp,
    splitPattern: s.splitPattern,
    isHeavySubject: s.isHeavySubject,
    category: s.category,
  }));

  return (
    <ClassesSubjectsManager classes={classRows} subjects={subjectRows} requiredWeeklyJp={requiredWeeklyJp} />
  );
}
