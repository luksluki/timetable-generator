import { prisma } from "@/lib/prisma";
import { AllocationsManager } from "@/components/admin/modules/allocations-manager";

export const dynamic = "force-dynamic";

export default async function AllocationsPage() {
  const [allocations, teachers, classes, subjects] = await Promise.all([
    prisma.teachingAllocation.findMany({
      orderBy: [{ classGroup: { name: "asc" } }, { subject: { name: "asc" } }],
      include: { teacher: true, classGroup: true, subject: true },
    }),
    prisma.teacher.findMany({ orderBy: { code: "asc" } }),
    prisma.classGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = allocations.map((a) => ({
    id: a.id,
    teacherId: a.teacherId,
    classGroupId: a.classGroupId,
    subjectId: a.subjectId,
    weeklyHours: a.weeklyHours,
    teacherCode: a.teacher.code,
    teacherName: a.teacher.name,
    className: a.classGroup.name,
    subjectName: a.subject.name,
  }));

  const options = {
    teachers: teachers.map((t) => ({ label: `${t.code} · ${t.name}`, value: t.id })),
    classes: classes.map((c) => ({ label: c.name, value: c.id })),
    subjects: subjects.map((s) => ({ label: s.name, value: s.id })),
  };

  return <AllocationsManager allocations={rows} options={options} />;
}
