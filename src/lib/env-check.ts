import { execFileSync } from "node:child_process";
import { getPythonBin, SOLVER_SCRIPT_PATH } from "@/lib/python-runner";
import { existsSync } from "node:fs";

/**
 * Validates critical environment variables and runtime dependencies at startup.
 * Called once from the instrumentation hook to fail fast with clear messages.
 */
export function validateEnvironment() {
  const errors: string[] = [];

  // 1. DATABASE_URL
  if (!process.env.DATABASE_URL) {
    errors.push(
      "DATABASE_URL is not set. Copy .env.example to .env and configure your PostgreSQL connection.",
    );
  }

  // 2. Python binary
  const pythonBin = getPythonBin();
  try {
    execFileSync(pythonBin, ["--version"], { stdio: "pipe", timeout: 5000 });
  } catch {
    errors.push(
      `Python binary "${pythonBin}" is not available. Install Python 3 or set PYTHON_BIN in .env.`,
    );
  }

  // 3. Solver script
  if (!existsSync(SOLVER_SCRIPT_PATH)) {
    errors.push(
      `Solver script not found at "${SOLVER_SCRIPT_PATH}". Ensure scripts/solver.py is present.`,
    );
  }

  if (errors.length > 0) {
    console.error("\n╔══════════════════════════════════════════════════╗");
    console.error("║  ScheduleCraft — Environment Validation Failed  ║");
    console.error("╚══════════════════════════════════════════════════╝\n");
    for (const err of errors) {
      console.error(`  ✗ ${err}`);
    }
    console.error("");
  }
}
