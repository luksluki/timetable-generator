// Validates the pure conflict-detection + block-move logic used by both the
// live client preview and the server action. No DB / Next runtime required.
import { detectConflicts, slotConflictLevels, hasHardConflict } from "../src/lib/conflicts";
import { applyBlockMove } from "../src/lib/slot-utils";
import type { SlotView } from "../src/lib/schedule-data";

function slot(partial: Partial<SlotView>): SlotView {
  return {
    id: "id",
    allocationId: "a1",
    classGroupId: "c1",
    classGroupName: "7A",
    teacherId: "t1",
    teacherCode: 3,
    teacherName: "Siti",
    subjectId: "s1",
    subjectName: "Informatika",
    subjectCode: "INF",
    isHeavy: false,
    roomId: null,
    roomName: null,
    dayOfWeek: 0,
    periodIdx: 0,
    isLocked: false,
    blockTag: "a1_0",
    ...partial,
  };
}

function show(label: string, slots: SlotView[]) {
  const c = detectConflicts(slots);
  console.log(
    `\n${label}: ${c.length} conflict(s), hard=${hasHardConflict(c)}`,
  );
  for (const x of c) console.log(`   [${x.level}] ${x.kind}: ${x.message}`);
}

const base: SlotView[] = [
  slot({ id: "a", periodIdx: 0, dayOfWeek: 0, blockTag: "a1_0" }),
  slot({ id: "b", periodIdx: 1, dayOfWeek: 0, blockTag: "a1_0" }),
  slot({ id: "c", periodIdx: 2, dayOfWeek: 0, blockTag: "a1_0" }), // 3-block Informatika Mon
  slot({
    id: "d",
    allocationId: "a2",
    teacherCode: 7,
    teacherId: "t7",
    subjectName: "Matematika",
    isHeavy: true,
    periodIdx: 4,
    dayOfWeek: 0,
    blockTag: "a2_0",
  }),
];

show("baseline (Matematika heavy not morning)", base);

// Move the 3-block to Wednesday period 0 (should succeed, no conflicts)
const m1 = applyBlockMove(base, "a", 2, 0);
console.log("\nmove a -> Wed/P0:", m1.ok);
if (m1.ok) show("after move", m1.slots);

// Try to move a locked slot
const locked = base.map((s) => (s.id === "a" ? { ...s, isLocked: true } : s));
const m2 = applyBlockMove(locked, "a", 2, 0);
console.log("\nmove locked:", m2.ok, m2.ok ? "" : m2.reason);

// Create a teacher double-booking synthetically and detect
const clash: SlotView[] = [
  slot({ id: "x", teacherId: "t1", teacherCode: 3, dayOfWeek: 1, periodIdx: 0 }),
  slot({
    id: "y",
    allocationId: "a9",
    teacherId: "t1",
    teacherCode: 3,
    classGroupId: "c2",
    classGroupName: "7B",
    dayOfWeek: 1,
    periodIdx: 0,
  }),
];
show("teacher double-book (hard)", clash);
const levels = slotConflictLevels(detectConflicts(clash));
console.log("   levels:", Object.fromEntries(levels));
