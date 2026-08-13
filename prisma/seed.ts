import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { PERIODS_PER_DAY } from "../src/lib/schedule-config";
import { DEFAULT_PERIODS, DEFAULT_BREAKS } from "../src/lib/schedule-time";

// ---------------------------------------------------------------------------
// Master data — sourced from the school provisions (PRD).
// ---------------------------------------------------------------------------

type SubjectSeed = {
  name: string;
  code: string;
  totalJp: number;
  splitPattern: string;
  isHeavy: boolean;
  category: string | null;
};

const SUBJECTS: SubjectSeed[] = [
  { name: "English", code: "ENG", totalJp: 6, splitPattern: "3+3", isHeavy: false, category: null },
  { name: "Mathematics", code: "MAT", totalJp: 5, splitPattern: "3+2", isHeavy: true, category: null },
  { name: "Physics", code: "PHY", totalJp: 5, splitPattern: "3+2", isHeavy: true, category: "PHY_LAB" },
  { name: "Chemistry", code: "CHE", totalJp: 4, splitPattern: "2+2", isHeavy: false, category: null },
  { name: "Biology", code: "BIO", totalJp: 4, splitPattern: "2+2", isHeavy: false, category: null },
  { name: "History", code: "HIS", totalJp: 3, splitPattern: "3", isHeavy: false, category: null },
  { name: "Geography", code: "GEO", totalJp: 3, splitPattern: "3", isHeavy: false, category: null },
  { name: "Physical Education", code: "PE", totalJp: 3, splitPattern: "3", isHeavy: false, category: null },
  { name: "Computer Science", code: "CS", totalJp: 3, splitPattern: "3", isHeavy: false, category: "CS_LAB" },
  { name: "Art", code: "ART", totalJp: 3, splitPattern: "3", isHeavy: false, category: null },
  { name: "Music", code: "MUS", totalJp: 2, splitPattern: "2", isHeavy: false, category: null },
  { name: "Ethics", code: "ETH", totalJp: 1, splitPattern: "1", isHeavy: false, category: null },
];

const ALL_CLASSES = ["7A", "7B", "7C", "7D", "7E", "8A", "8B", "8C", "8D", "9A", "9B"];

type TeacherSeed = {
  code: number;
  name: string;
  subjectKey: string;
  classes: string[];
  blockedDays?: number[];
  forceStartDay?: number;
  forceStartPeriod?: number;
  isFixedSchedule?: boolean;
};

const TEACHERS: TeacherSeed[] = [
  { code: 2, name: "Alice Johnson", subjectKey: "CHE", classes: ["7A", "7B", "7C", "7D", "7E", "8A"] },
  { code: 3, name: "Bob Smith", subjectKey: "CS", classes: ALL_CLASSES },
  { code: 4, name: "Charlie Brown", subjectKey: "HIS", classes: ALL_CLASSES },
  { code: 5, name: "Diana Prince", subjectKey: "GEO", classes: ALL_CLASSES },
  { code: 6, name: "Ethan Hunt", subjectKey: "PE", classes: ALL_CLASSES },
  { code: 7, name: "Fiona Gallagher", subjectKey: "ENG", classes: ["7A", "7B", "7C", "7D", "9A", "9B"] },
  { code: 8, name: "George Miller", subjectKey: "ART", classes: ALL_CLASSES },
  { code: 9, name: "Hannah Abbott", subjectKey: "ENG", classes: ["7E", "8A", "8B", "8C", "8D"] },
  { code: 10, name: "Ian Malcolm", subjectKey: "BIO", classes: ["7A", "7B", "7C", "7D", "7E", "9A", "9B"] },
  { code: 11, name: "Jane Doe", subjectKey: "PHY", classes: ["7A", "7B", "7C", "7D", "7E"] },
  { code: 12, name: "Kevin Hart", subjectKey: "MAT", classes: ["7A", "7B", "7C", "7D", "9A", "9B"] },
  { code: 13, name: "Laura Croft", subjectKey: "PHY", classes: ["8A", "8B", "8C", "8D", "9A", "9B"] },
  { code: 14, name: "Michael Scott", subjectKey: "MAT", classes: ["7E", "8A", "8B", "8C", "8D"] },
  { code: 15, name: "Nancy Drew", subjectKey: "CHE", classes: ["8B", "8C", "8D", "9A", "9B"] },
  { code: 16, name: "Oliver Twist", subjectKey: "ETH", classes: ALL_CLASSES },
  {
    code: 17,
    name: "Pam Beesly",
    subjectKey: "MUS",
    classes: ALL_CLASSES,
    blockedDays: [1, 4], // Tuesday & Friday blocked
    forceStartDay: 3, // Thursday
    forceStartPeriod: 0, // must start at JP 1
  },
  {
    code: 18,
    name: "Quinn Fabray",
    subjectKey: "BIO",
    classes: ["8A", "8B", "8C", "8D"],
    isFixedSchedule: true, // locked schedule
  },
];

/** Teacher duty roster (Piket). dayOfWeek: 0=Mon .. 4=Fri */
const PIKET: Record<number, number[]> = {
  0: [11, 6, 7], // Monday: Jane Doe, Ethan Hunt, Fiona Gallagher
  1: [4, 5, 9], // Tuesday: Charlie Brown, Diana Prince, Hannah Abbott
  2: [14, 2, 8], // Wednesday: Michael Scott, Alice Johnson, George Miller
  3: [16, 15, 3], // Thursday: Oliver Twist, Nancy Drew, Bob Smith
  4: [13, 10, 12], // Friday: Laura Croft, Ian Malcolm, Kevin Hart
};

async function main() {
  console.log("🧹 Clearing existing data...");
  await prisma.scheduleSlot.deleteMany();
  await prisma.teacherUnavailability.deleteMany();
  await prisma.teacherPiket.deleteMany();
  await prisma.teachingAllocation.deleteMany();
  await prisma.room.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.classGroup.deleteMany();
  await prisma.teacher.deleteMany();

  console.log("📚 Seeding subjects...");
  await prisma.subject.createMany({
    data: SUBJECTS.map((s) => ({
      name: s.name,
      code: s.code,
      totalJp: s.totalJp,
      splitPattern: s.splitPattern,
      isHeavySubject: s.isHeavy,
      category: s.category,
    })),
  });

  console.log("🏫 Seeding class groups...");
  await prisma.classGroup.createMany({
    data: ALL_CLASSES.map((name) => ({
      name,
      grade: Number(name[0]),
    })),
  });

  console.log("🚪 Seeding rooms...");
  const rooms = [
    ...ALL_CLASSES.map((name) => ({ name: `Room ${name}`, isLab: false, roomType: "REGULAR" as const })),
    { name: "Physics Lab 1", isLab: true, roomType: "PHY_LAB" as const },
    { name: "Physics Lab 2", isLab: true, roomType: "PHY_LAB" as const },
    { name: "Computer Lab", isLab: true, roomType: "CS_LAB" as const },
  ];
  await prisma.room.createMany({ data: rooms });

  console.log("👩‍🏫 Seeding teachers...");
  const subjectByCode = await prisma.subject.findMany();
  const subjectMap = new Map(subjectByCode.map((s) => [s.code, s]));
  await prisma.teacher.createMany({
    data: TEACHERS.map((t) => ({
      code: t.code,
      name: t.name,
      subjectName: subjectMap.get(SUBJECTS.find((s) => s.code === t.subjectKey)!.code)!.name,
      maxHoursPerDay: PERIODS_PER_DAY,
      blockedDays: t.blockedDays ?? [],
      forceStartDay: t.forceStartDay ?? null,
      forceStartPeriod: t.forceStartPeriod ?? null,
      isFixedSchedule: t.isFixedSchedule ?? false,
    })),
  });

  // Build lookup maps
  const teacherRows = await prisma.teacher.findMany();
  const teacherByCode = new Map(teacherRows.map((t) => [t.code, t]));
  const classRows = await prisma.classGroup.findMany();
  const classByName = new Map(classRows.map((c) => [c.name, c]));
  const subjectByName = new Map(subjectByCode.map((s) => [s.name, s]));

  console.log("🕒 Seeding piket duties...");
  const piketRows: { teacherId: string; dayOfWeek: number }[] = [];
  for (const [dayStr, codes] of Object.entries(PIKET)) {
    const dayOfWeek = Number(dayStr);
    for (const code of codes) {
      const teacher = teacherByCode.get(code);
      if (!teacher) throw new Error(`Piket teacher code ${code} not found`);
      piketRows.push({ teacherId: teacher.id, dayOfWeek });
    }
  }
  await prisma.teacherPiket.createMany({ data: piketRows });

  console.log("📆 Seeding teaching allocations...");
  const allocationRows: {
    teacherId: string;
    classGroupId: string;
    subjectId: string;
    weeklyHours: number;
  }[] = [];
  for (const t of TEACHERS) {
    const teacher = teacherByCode.get(t.code)!;
    const subjectSeed = SUBJECTS.find((s) => s.code === t.subjectKey)!;
    const subject = subjectByName.get(subjectSeed.name)!;
    for (const className of t.classes) {
      const classGroup = classByName.get(className);
      if (!classGroup) throw new Error(`Class ${className} not found`);
      allocationRows.push({
        teacherId: teacher.id,
        classGroupId: classGroup.id,
        subjectId: subject.id,
        weeklyHours: subject.totalJp,
      });
    }
  }
  await prisma.teachingAllocation.createMany({ data: allocationRows });

  // ---- JP time + break configuration (create only; preserve edits on re-seed) ----
  console.log("🕐 Seeding schedule time config...");
  await prisma.scheduleConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      periods: DEFAULT_PERIODS as unknown as object,
      breaks: DEFAULT_BREAKS as unknown as object,
    },
    update: {},
  });

  // ---- Verification: each class should total REQUIRED_WEEKLY_JP (42) ----
  console.log("✅ Verifying per-class weekly JP...");
  const allocations = await prisma.teachingAllocation.findMany({
    include: { classGroup: true },
  });
  const totals = new Map<string, number>();
  for (const a of allocations) {
    totals.set(a.classGroup.name, (totals.get(a.classGroup.name) ?? 0) + a.weeklyHours);
  }
  let ok = true;
  for (const [name, total] of totals) {
    const flag = total === 42 ? "✓" : "✗";
    if (total !== 42) ok = false;
    console.log(`   ${flag} ${name}: ${total} JP`);
  }

  console.log("\n━━━ Seed summary ━━━");
  console.log(`   Teachers:      ${teacherRows.length}`);
  console.log(`   Class groups:  ${classRows.length}`);
  console.log(`   Subjects:      ${subjectByCode.length}`);
  console.log(`   Rooms:         ${rooms.length}`);
  console.log(`   Piket duties:  ${piketRows.length}`);
  console.log(`   Allocations:   ${allocationRows.length}`);
  console.log(`   All classes @ 42 JP: ${ok ? "YES" : "NO"}`);
  if (!ok) {
    console.warn("⚠️  Some classes do not total 42 JP — check allocations.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
