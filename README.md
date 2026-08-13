# ScheduleCraft

Automated school timetable generator for the **Deputy Head of Curriculum**
(Wakil Kepala Sekolah Bidang Kurikulum). Generates a fully-constrained weekly
schedule in seconds using Google OR-Tools CP-SAT, with an interactive
drag-and-drop grid, Excel export and print support.

---

## Features

- **One-click generation** via an embedded Python CP-SAT solver, spawned
  asynchronously from Next.js through `child_process.spawn`.
- **Hard constraints** (always enforced):
  - Forced daily JP splits (`6→3+3`, `5→3+2`, `4→2+2`, `3/2/1` single block).
  - Multi-JP blocks occupy **consecutive** period indices.
  - No teacher / class / room (lab) double-booking.
  - **Piket load cap** — teachers with > 30 weekly JP on duty may teach at most
    one class that day.
  - **Teacher availability** — Hilmy (code 17) blocked Tue & Fri; on Thursday
    his lesson starts at JP 1. Amanda (code 18) schedule is locked.
  - Each class totals exactly **42 JP/week**.
- **Soft constraints** (weighted penalty minimization):
  - Teacher free-period/gap reduction.
  - Heavy subjects (Math / IPA) preferred in morning periods (1–3).
  - Cap consecutive teaching at 3 periods before a break.
- **Interactive grid** (`/schedule`) with three views — **By Class**, **By
  Teacher**, **By Room** — and `@hello-pangea/dnd` drag-and-drop with live
  conflict highlighting (🔴 hard / 🟡 soft).
- **Export** to the school's Excel matrix format and a print-friendly PDF view.

## Management UI (`/admin`)

A dedicated section with a sidebar and full CRUD for every entity, plus a
read-only **Unified Timetable** (`/timetable`).

- **Unified Timetable** — three switchable matrices showing *all classes, days
  and rooms* at once: **Class Wall** (per-class mini-grids), **Room
  Utilization** (rooms × time, reveals lab contention) and **Teacher Heatmap**
  (load per teacher). Excel export reuses the per-class + recap workbook.
- **Teachers** (`/admin/teachers`) — directory with blocked days, force-start
  rule and fixed-schedule flag.
- **Class Groups & Subjects** (`/admin/classes`) — two tabs; classes show a
  live `allocated/42 JP` badge.
- **Rooms & Laboratories** (`/admin/rooms`) — capacity/building/floor + live
  booked-slot counts.
- **Allocations** (`/admin/allocations`) — teacher × class × subject; rejects
  edits that would push a class above 42 JP/week.
- **Piket Shifts** (`/admin/piket`) — day × teacher matrix editor; flags
  > 30 JP teachers (solver-capped).

All mutations run through zod-validated **server actions** that
`revalidatePath` the module, the timetable and the editor so every view stays
consistent. Reusable `DataTable` (search/sort) and a config-driven `EntitySheet`
(react-hook-form) power every module.

---

## Tech stack

| Layer        | Technology                                                  |
| ------------ | ----------------------------------------------------------- |
| Framework    | Next.js 16 (App Router, Turbopack, Server Actions)          |
| Language     | TypeScript (strict)                                         |
| Database     | PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`)             |
| UI           | Tailwind CSS v4, shadcn/ui, Lucide                          |
| Drag & drop  | `@hello-pangea/dnd`                                         |
| Solver       | Python 3 + Google OR-Tools (CP-SAT)                         |
| Export       | `xlsx`                                                      |

---

## Getting started

### Prerequisites
- Node.js ≥ 20.9, npm
- Python ≥ 3.11 with `pip`
- Docker (recommended) **or** a reachable PostgreSQL instance

### 1. Install dependencies
```bash
npm install        # postinstall generates the Prisma client
```

### 2. Start PostgreSQL
The bundled `docker-compose.yml` runs Postgres on **port 5433** (to avoid
conflicts with a native 5432):
```bash
docker compose up -d
```

### 3. Configure environment
Copy `.env.example` → `.env` and adjust if needed:
```env
DATABASE_URL="postgresql://schedulecraft:schedulecraft@localhost:5433/schedulecraft?schema=public"
PYTHON_BIN=""   # "python" on Windows, "python3" elsewhere; blank = auto-detect
```

### 4. Install the Python solver dependency
```bash
pip install ortools
```

### 5. Create the schema and seed the dataset
```bash
npm run db:push     # create tables
npm run db:seed     # load the 17 teachers, 11 classes, allocations & piket
```

### 6. Run the app
```bash
npm run dev         # http://localhost:3000
```
Open **/schedule**, click **Generate**, then drag lessons, export to Excel, or print.

---

## npm scripts

| Script             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `dev`              | Start the dev server (Turbopack)                 |
| `build` / `start`  | Production build & start                         |
| `lint` / `typecheck` | ESLint / `tsc --noEmit`                        |
| `db:push`          | Push the Prisma schema to Postgres               |
| `db:seed`          | Seed master data (teachers, classes, allocations)|
| `db:generate`      | Regenerate the Prisma client                     |
| `db:studio`        | Open Prisma Studio                               |

Helper scripts (run with `npx tsx`): `scripts/test-solver.ts` (validates the
solver end-to-end), `scripts/test-logic.ts` (conflict/move logic).

---

## Architecture

```
Browser  ──POST /api/schedule/generate──►  Next.js Route Handler
                                              │
                  build payload (Prisma) ◄────┘
                                              │ spawn('python', solver.py)
                                              ▼
                                   scripts/solver.py (CP-SAT)
                                              │ JSON result on stdout
                                              ▼
                  persist ScheduleSlot (txn) ◄┘  + revalidatePath
```

- **`scripts/solver.py`** — reads JSON on stdin, writes JSON on stdout. Builds
  interval variables per lesson chunk, enforces hard constraints and minimises
  a weighted soft-penalty objective.
- **`src/lib/solver-payload.ts`** — assembles the problem from Prisma.
- **`src/lib/python-runner.ts`** — spawns Python, resolves the binary, parses
  the result.
- **`src/app/api/schedule/generate/route.ts`** — orchestrates and persists.
- **`src/app/actions/schedule.ts`** — `moveScheduleBlock` server action for
  drag-and-drop with live conflict validation.
- **`src/lib/conflicts.ts`** — pure conflict detection shared by client & server.

---

## Key design decisions

- **9 periods/day.** The school provisions require **42 JP/class** (the forced
  subject splits `6+5+5+4+4+3+3+3+3+3+2+1 = 42`). Over a 5-day week this needs
  `ceil(42/5) = 9` periods/day (45 slots); 8 periods (40) is infeasible. Kept
  configurable in `src/lib/schedule-config.ts`.
- **Two IPA labs.** 11 classes × 5 JP = 55 IPA lab-periods/week > 45 slots of a
  single lab, so a second IPA lab is provided and the solver bin-packs lab
  blocks across rooms (`NewOptionalIntervalVar`).
- **Prisma 7** uses the new `prisma-client` generator (output
  `src/generated/prisma`) and the `@prisma/adapter-pg` driver adapter.
- **Next.js 16** async request APIs (`params`, `searchParams`, `cookies`) are
  awaited; Turbopack is the default bundler; ESLint is run directly.
