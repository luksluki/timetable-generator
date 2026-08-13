import "dotenv/config";
import { buildSolverPayload } from "../src/lib/solver-payload";
import { runSolver } from "../src/lib/python-runner";
import { prisma } from "../src/lib/prisma";
import { PERIODS_PER_DAY, DAYS_PER_WEEK } from "../src/lib/schedule-config";

async function main() {
  const timeout = Number(process.argv[2] ?? 30);
  const piketRule = (process.argv[3] === "blockUnder33" ? "blockUnder33" : "capOver30") as
    | "capOver30" | "blockUnder33";
  console.log(`⚙️  Building solver payload (piketRule=${piketRule})...`);
  const payload = await buildSolverPayload({ timeoutSeconds: timeout, piketRule });
  console.log(
    `   ${payload.teachers.length} teachers, ${payload.classes.length} classes, ${payload.allocations.length} allocations, ${payload.rooms.length} rooms`,
  );

  console.log(`🚀 Running CP-SAT solver (timeout ${timeout}s)...`);
  const t0 = Date.now();
  const result = await runSolver(payload, timeout);
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`⏱️  Solved in ${dt}s — status: ${result.status}, objective: ${result.objective}`);
  console.log(`   stats:`, result.stats);
  if (result.conflicts.length) {
    console.log(`   conflicts:`, result.conflicts);
  }

  if (result.status === "INFEASIBLE" || result.status === "ERROR") {
    console.error("❌ Solver did not produce a timetable.");
    process.exit(1);
  }

  const slots = result.slots;
  console.log(`\n📦 Produced ${slots.length} slots.`);

  // ---- Validation ----
  // Resolve teacher per allocation
  const allocs = await prisma.teachingAllocation.findMany();
  const allocTeacher = new Map(allocs.map((a) => [a.id, a.teacherId]));

  // 1) Class double-booking
  const classCell = new Map<string, number>();
  let classClashes = 0;
  for (const s of slots) {
    const key = `${s.classGroupId}|${s.dayOfWeek}|${s.periodIdx}`;
    classCell.set(key, (classCell.get(key) ?? 0) + 1);
  }
  for (const [, n] of classCell) if (n > 1) classClashes++;
  console.log(`   Class double-booked cells: ${classClashes}`);

  // 2) Teacher double-booking
  const teacherCell = new Map<string, number>();
  let teacherClashes = 0;
  for (const s of slots) {
    const tid = allocTeacher.get(s.allocationId);
    if (!tid) continue;
    const key = `${tid}|${s.dayOfWeek}|${s.periodIdx}`;
    teacherCell.set(key, (teacherCell.get(key) ?? 0) + 1);
  }
  for (const [, n] of teacherCell) if (n > 1) teacherClashes++;
  console.log(`   Teacher double-booked cells: ${teacherClashes}`);

  // 3) JP per class == 42
  const classJp = new Map<string, number>();
  for (const s of slots) {
    classJp.set(s.classGroupId, (classJp.get(s.classGroupId) ?? 0) + 1);
  }
  const classes = await prisma.classGroup.findMany({ orderBy: { name: "asc" } });
  let jpOk = true;
  for (const c of classes) {
    const total = classJp.get(c.id) ?? 0;
    const flag = total === 42 ? "✓" : "✗";
    if (total !== 42) jpOk = false;
    console.log(`   ${flag} ${c.name}: ${total} JP`);
  }

  // 4) Period range valid
  const oob = slots.filter((s) => s.dayOfWeek < 0 || s.dayOfWeek >= DAYS_PER_WEEK || s.periodIdx < 0 || s.periodIdx >= PERIODS_PER_DAY);
  console.log(`   Out-of-bounds slots: ${oob.length}`);

  // 5) Hilmy rule: has a Thursday (day 3) block starting at period 0
  const hilmy = await prisma.teacher.findUnique({ where: { code: 17 } });
  if (hilmy) {
    const hilmyAllocs = allocs.filter((a) => a.teacherId === hilmy.id).map((a) => a.id);
    const hilmySlots = slots.filter((s) => hilmyAllocs.includes(s.allocationId));
    const thuStart0 = hilmySlots.some((s) => s.dayOfWeek === 3 && s.periodIdx === 0);
    const teachesThu = hilmySlots.some((s) => s.dayOfWeek === 3);
    const tue = hilmySlots.some((s) => s.dayOfWeek === 1);
    const fri = hilmySlots.some((s) => s.dayOfWeek === 4);
    console.log(`   Hilmy: Thursday@P0=${thuStart0}, teachesThu=${teachesThu}, Tue(blocked)=${tue}, Fri(blocked)=${fri}`);
  }

  // 6) Piket rule check (rule-aware)
  const piket = await prisma.teacherPiket.findMany();
  const loadByTeacher = new Map<string, number>();
  for (const a of allocs) loadByTeacher.set(a.teacherId, (loadByTeacher.get(a.teacherId) ?? 0) + a.weeklyHours);
  for (const p of piket) {
    const load = loadByTeacher.get(p.teacherId) ?? 0;
    const tAllocs = allocs.filter((a) => a.teacherId === p.teacherId).map((a) => a.id);
    const classesThatDay = new Set<string>();
    for (const s of slots) {
      if (tAllocs.includes(s.allocationId) && s.dayOfWeek === p.dayOfWeek) {
        classesThatDay.add(s.classGroupId);
      }
    }
    const t = await prisma.teacher.findUnique({ where: { id: p.teacherId } });
    if (piketRule === "blockUnder33") {
      // Proposed rule: load<=33 must teach 0 classes; load>33 unrestricted.
      if (load <= 33) {
        const pass = classesThatDay.size === 0;
        console.log(`   blockUnder33 ${t?.code} (load ${load}) day ${p.dayOfWeek}: ${classesThatDay.size} class(es) ${pass ? "✓ blocked" : "✗ NOT blocked"}`);
      } else {
        console.log(`   blockUnder33 ${t?.code} (load ${load}>33) day ${p.dayOfWeek}: exempt, ${classesThatDay.size} class(es)`);
      }
    } else {
      // Default: load>30 capped to <=1 class.
      if (load <= 30) continue;
      console.log(`   capOver30 ${t?.code} (load ${load}) day ${p.dayOfWeek}: ${classesThatDay.size} class(es) ${classesThatDay.size <= 1 ? "✓" : "✗ VIOLATION"}`);
    }
  }

  const ok = classClashes === 0 && teacherClashes === 0 && jpOk && oob.length === 0;
  console.log(`\n${ok ? "✅ VALID timetable" : "⚠️  Issues found"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
