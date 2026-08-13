import "dotenv/config";
import { buildSolverPayload } from "../src/lib/solver-payload";
import { runSolver } from "../src/lib/python-runner";

async function trial(label: string, debug: Record<string, boolean>) {
  const payload = await buildSolverPayload({ timeoutSeconds: 15 });
  (payload as unknown as { debug: Record<string, boolean> }).debug = debug;
  const t0 = Date.now();
  const r = await runSolver(payload, 15);
  const dt = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(
    `${label.padEnd(38)} -> ${r.status.padEnd(10)} obj=${r.objective ?? "-"} (${dt}s) slots=${r.slots.length}`,
  );
}

async function main() {
  console.log("Bisecting infeasibility...\n");
  await trial("all ON (full)", {});
  await trial("no soft", { disableSoft: true });
  await trial("no lab", { disableLab: true, disableSoft: true });
  await trial("no piket", { disablePiket: true, disableSoft: true });
  await trial("no special (Hilmy)", { disableSpecial: true, disableSoft: true });
  await trial("no availability", { disableAvailability: true, disableSoft: true });
  await trial("no lab + no piket", { disableLab: true, disablePiket: true, disableSoft: true });
  await trial("no lab + no special", { disableLab: true, disableSpecial: true, disableSoft: true });
  await trial("no piket + no special", { disablePiket: true, disableSpecial: true, disableSoft: true });
  await trial("lab + piket + special OFF", {
    disableLab: true,
    disablePiket: true,
    disableSpecial: true,
    disableSoft: true,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
