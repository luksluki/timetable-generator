import { spawn } from "node:child_process";
import path from "node:path";

export type SolverSlot = {
  allocationId: string;
  classGroupId: string;
  roomId: string | null;
  dayOfWeek: number;
  periodIdx: number;
  isLocked: boolean;
  blockTag: string;
};

export type SolverStats = {
  teacherGapPenalty?: number;
  heavyMorningPenalty?: number;
  consecutivePenalty?: number;
};

export type SolverResult = {
  status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "ERROR";
  objective: number | null;
  slots: SolverSlot[];
  stats: SolverStats;
  conflicts: string[];
  message?: string;
};

/**
 * Resolve the Python executable. Honours PYTHON_BIN env var, otherwise falls
 * back to platform default (`python` on Windows, `python3` elsewhere).
 */
export function getPythonBin(): string {
  const fromEnv = process.env.PYTHON_BIN?.trim();
  if (fromEnv) return fromEnv;
  return process.platform === "win32" ? "python" : "python3";
}

export const SOLVER_SCRIPT_PATH = path.join(process.cwd(), "scripts", "solver.py");

/**
 * Spawn the Python CP-SAT solver, stream the JSON payload to stdin and parse
 * the JSON result from stdout.
 */
export async function runSolver(
  payload: unknown,
  timeoutSeconds = 30,
): Promise<SolverResult> {
  const bin = getPythonBin();
  const script = SOLVER_SCRIPT_PATH;
  const child = spawn(bin, [script], {
    cwd: process.cwd(),
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const hardTimeout = (timeoutSeconds + 90) * 1000;
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }, hardTimeout);

  const finished = new Promise<{ code: number | null }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code }));
  });

  try {
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  } catch {
    // stdin write errors are non-fatal; the promise will reject on 'error'
  }

  try {
    const { code } = await finished;
    if (code !== 0) {
      throw new Error(
        stderr.trim() ||
          `Solver process exited with code ${code} (python binary: ${bin}).`,
      );
    }
    const trimmed = stdout.trim();
    if (!trimmed) {
      throw new Error("Solver produced no output.");
    }
    const result = JSON.parse(trimmed) as SolverResult;
    return result;
  } finally {
    clearTimeout(timer);
  }
}
