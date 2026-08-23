import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildSolverPayload } from "@/lib/solver-payload";
import { runSolver, type SolverSlot } from "@/lib/python-runner";

// Long-running: must run on the Node.js runtime (spawns the Python process).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

let isGenerating = false;

export async function POST(request: Request) {
  if (isGenerating) {
    return NextResponse.json(
      { ok: false, status: "ERROR", message: "A timetable generation is currently in progress. Please wait." },
      { status: 429 },
    );
  }
  isGenerating = true;
  
  let timeoutSeconds = 30;
  let piketRule: "capOver30" | "blockUnder33" = "capOver30";
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.timeoutSeconds === "number") {
      timeoutSeconds = Math.min(Math.max(body.timeoutSeconds, 10), 120);
    }
    if (body?.piketRule === "blockUnder33") {
      piketRule = "blockUnder33";
    }
  } catch {
    /* fall back to defaults */
  }

  try {
    const payload = await buildSolverPayload({ timeoutSeconds, piketRule });
    const result = await runSolver(payload, timeoutSeconds);

    if (result.status === "INFEASIBLE" || result.status === "ERROR") {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          conflicts: result.conflicts,
          message: result.message ?? "Solver returned no feasible timetable.",
        },
        { status: 422 },
      );
    }

    await persistSlots(result.slots);
    revalidatePath("/schedule");
    revalidatePath("/");

    return NextResponse.json({
      ok: true,
      status: result.status,
      objective: result.objective,
      stats: result.stats,
      slotCount: result.slots.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown solver error.";
    return NextResponse.json(
      { ok: false, status: "ERROR", message },
      { status: 500 },
    );
  } finally {
    isGenerating = false;
  }
}

/** Replace the entire timetable atomically. */
async function persistSlots(slots: SolverSlot[]) {
  const rows = slots.map((s) => ({
    allocationId: s.allocationId,
    classGroupId: s.classGroupId,
    roomId: s.roomId ?? null,
    dayOfWeek: s.dayOfWeek,
    periodIdx: s.periodIdx,
    isLocked: s.isLocked,
    blockTag: s.blockTag ?? null,
  }));

  await prisma.$transaction(async (tx) => {
    // Acquire a transaction-level advisory lock to prevent concurrent timetable replacement race conditions
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20240824)`;
    await tx.scheduleSlot.deleteMany();
    await tx.scheduleSlot.createMany({ data: rows });
  });
}
