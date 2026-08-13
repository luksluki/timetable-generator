import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { teacherSchema, allocationSchema } from "../src/lib/validators";
import { REQUIRED_WEEKLY_JP } from "../src/lib/schedule-config";

async function main() {
  // 1) Validator parse + prisma create/delete cycle for a teacher.
  //    Mimic the form: selects send strings ("3"/"").
  const parsed = teacherSchema.parse({
    code: "99",
    name: "Test Guru",
    subjectName: "Test",
    maxHoursPerDay: "9",
    blockedDays: [1],
    isFixedSchedule: false,
    forceStartDay: "3",
    forceStartPeriod: "",
  });
  console.log(
    "parsed teacher: code=%s forceStartDay=%s forceStartPeriod=%s blockedDays=%j",
    parsed.code, parsed.forceStartDay, parsed.forceStartPeriod, parsed.blockedDays,
  );
  if (parsed.forceStartDay !== 3) throw new Error("forceStartDay should coerce to 3");
  if (parsed.forceStartPeriod !== null) throw new Error("empty forceStartPeriod should be null");

  const t = await prisma.teacher.create({ data: parsed });
  console.log("created teacher:", t.code, t.name);
  await prisma.teacher.delete({ where: { id: t.id } });
  console.log("deleted teacher; gone:", (await prisma.teacher.findUnique({ where: { code: 99 } })) === null);

  // 2) Allocation schema parse
  const a = await prisma.teachingAllocation.findFirst();
  if (a) {
    const ap = allocationSchema.parse({
      teacherId: a.teacherId,
      classGroupId: a.classGroupId,
      subjectId: a.subjectId,
      weeklyHours: 3,
    });
    console.log("parsed allocation weeklyHours:", ap.weeklyHours);
  }

  // 3) 42-JP guard logic (replicates allocations action)
  const cls = await prisma.classGroup.findFirst();
  if (cls) {
    const total = await prisma.teachingAllocation.aggregate({
      where: { classGroupId: cls.id },
      _sum: { weeklyHours: true },
    });
    const sum = total._sum.weeklyHours ?? 0;
    console.log(`class ${cls.name} currently ${sum}/${REQUIRED_WEEKLY_JP} JP`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
