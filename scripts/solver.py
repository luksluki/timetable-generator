#!/usr/bin/env python3
"""
ScheduleCraft CP-SAT Solver Worker
==================================

Reads a JSON problem description from stdin and writes a JSON timetable
solution to stdout. Designed to be spawned via Node.js `child_process.spawn`.

Hard constraints (always enforced):
  * Forced daily JP splits (6->[3,3], 5->[3,2], 4->[2,2], 3/2/1 single block)
    via fixed-length interval blocks + AddAllowedAssignments on chunk days.
  * Block contiguity: multi-JP blocks occupy consecutive period indices.
  * No teacher / class / room (lab) double-booking (AddNoOverlap).
  * Teacher piket load cap: >threshold weekly JP + on piket day => at most
    one class taught that day.
  * Teacher availability: blocked days excluded; forceStartDay/Period honored.
  * Fixed schedules remain locked.

Soft constraints (weighted penalty minimization):
  * Teacher gap / idle-period reduction.
  * Heavy subjects (Math / IPA) preferred in morning periods (1-3).
  * Cap consecutive teaching hours at `maxConsecutiveTeaching` (3).

Usage:
    python scripts/solver.py < input.json > output.json
"""

from __future__ import annotations

import json
import sys
from itertools import permutations

from ortools.sat.python import cp_model


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DEFAULT_CHUNKS = {6: [3, 3], 5: [3, 2], 4: [2, 2], 3: [3], 2: [2], 1: [1]}


def parse_chunks(weekly_jp: int, split_pattern: str | None) -> list[int]:
    """Return the daily JP chunks for a subject, e.g. 6 -> [3, 3]."""
    if split_pattern:
        parts = [int(x) for x in split_pattern.replace("+", " ").split()]
        if parts and sum(parts) == weekly_jp:
            return parts
    return DEFAULT_CHUNKS.get(weekly_jp, [weekly_jp])


def allowed_day_tuples(num_chunks: int, allowed_days: list[int]) -> list[list[int]]:
    """Distinct-day tuples (order matters per chunk) for AddAllowedAssignments."""
    if num_chunks == 1:
        return [[d] for d in allowed_days]
    # ordered permutations of distinct days
    return [list(p) for p in permutations(allowed_days, num_chunks)]


def solve(data: dict) -> dict:
    D = int(data["daysPerWeek"])
    P = int(data["periodsPerDay"])
    active_periods = [int(x) for x in data.get("activePeriodsPerDay", [P] * D)]
    TOTAL = D * P
    MAX_CONS = int(data.get("maxConsecutiveTeaching", 3))
    morning = list(data.get("morningPeriods", [0, 1, 2]))
    morning_last = max(morning) if morning else 0

    w = data.get("softWeights", {}) or {}
    WGAP = int(w.get("teacherGap", 3))
    WHEAVY = int(w.get("heavyMorning", 4))
    WCONS = int(w.get("maxConsecutive", 5))
    WCLASSGAP = int(w.get("classGap", 6))
    PIKET_THRESH = int(data.get("piketLoadThreshold", 30))
    timeout = float(data.get("timeoutSeconds", 30))
    enable_gap = bool(data.get("enableGapSoft", True))
    enable_cons = bool(data.get("enableConsecutiveSoft", True))
    enable_class_gap = bool(data.get("enableClassGapSoft", True))

    dbg = data.get("debug", {}) or {}
    DBG_NO_PIKET = bool(dbg.get("disablePiket", False))
    DBG_NO_SPECIAL = bool(dbg.get("disableSpecial", False))
    DBG_NO_LAB = bool(dbg.get("disableLab", False))
    DBG_NO_AVAIL = bool(dbg.get("disableAvailability", False))
    DBG_NO_SOFT = bool(dbg.get("disableSoft", False))

    teachers = {t["id"]: t for t in data["teachers"]}
    subjects = {s["id"]: s for s in data["subjects"]}

    model = cp_model.CpModel()

    # ------------------------------------------------------------------
    # Build blocks (one interval per chunk of every allocation)
    # ------------------------------------------------------------------
    blocks: list[dict] = []
    by_alloc: dict[str, list[dict]] = {}
    by_teacher: dict[str, list[dict]] = {}
    by_class: dict[str, list[dict]] = {}

    teacher_load: dict[str, int] = {}
    for a in data["allocations"]:
        teacher_load[a["teacherId"]] = teacher_load.get(a["teacherId"], 0) + int(a["weeklyHours"])

    # Piket policy: "capOver30" (default, ≤1 class on piket day if load>30) or
    # "blockUnder33" (proposed: no teaching on piket day unless load>33).
    piket_rule = data.get("piketRule", "capOver30")
    piket_days_for_teacher: dict[str, list[int]] = {}
    for p in data.get("piket", []):
        piket_days_for_teacher.setdefault(p["teacherId"], []).append(int(p["dayOfWeek"]))

    for idx, a in enumerate(data["allocations"]):
        tid = a["teacherId"]
        cid = a["classGroupId"]
        sid = a["subjectId"]
        teacher = teachers[tid]
        subject = subjects[sid]
        chunks = parse_chunks(int(a["weeklyHours"]), subject.get("splitPattern"))
        if DBG_NO_AVAIL:
            allowed_days = list(range(D))
        else:
            blocked = set(teacher.get("blockedDays", []))
            # Proposed rule: a piket teacher with load <= 33 does not teach on
            # their duty day at all (the day becomes effectively blocked).
            if piket_rule == "blockUnder33" and teacher_load.get(tid, 0) <= 33:
                blocked |= set(piket_days_for_teacher.get(tid, []))
            allowed_days = [d for d in range(D) if d not in blocked]

        for ci, length in enumerate(chunks):
            b: dict = {
                "idx": idx,
                "ci": ci,
                "alloc": a,
                "teacherId": tid,
                "classId": cid,
                "subject": subject,
                "L": length,
                "allowed_days": allowed_days,
            }
            blocks.append(b)
            by_alloc.setdefault(a["id"], []).append(b)
            by_teacher.setdefault(tid, []).append(b)
            by_class.setdefault(cid, []).append(b)

    # ------------------------------------------------------------------
    # Decision variables: day, start, flattened interval
    # ------------------------------------------------------------------
    for b in blocks:
        L = b["L"]
        allowed = b["allowed_days"] or [0]
        day = model.NewIntVarFromDomain(
            cp_model.Domain.FromValues(allowed), f"d_{b['idx']}_{b['ci']}"
        )
        start = model.NewIntVar(0, P - L, f"s_{b['idx']}_{b['ci']}")
        fs = model.NewIntVar(0, TOTAL - 1, f"fs_{b['idx']}_{b['ci']}")
        model.Add(fs == day * P + start)
        end = model.NewIntVar(0, TOTAL, f"fe_{b['idx']}_{b['ci']}")
        model.Add(end == fs + L)
        interval = model.NewIntervalVar(fs, L, end, f"iv_{b['idx']}_{b['ci']}")
        b["day"], b["start"], b["fs"], b["end"], b["interval"] = day, start, fs, end, interval

    # ------------------------------------------------------------------
    # Forced daily splits: chunk days must be distinct (AddAllowedAssignments)
    # ------------------------------------------------------------------
    for alloc_id, bks in by_alloc.items():
        if len(bks) > 1:
            day_vars = [b["day"] for b in bks]
            tuples = allowed_day_tuples(len(bks), bks[0]["allowed_days"])
            if tuples:
                model.AddAllowedAssignments(day_vars, tuples)
        else:
            # single chunk: day already restricted to allowed days by domain
            pass

    # ------------------------------------------------------------------
    # Active Periods per Day limit
    # ------------------------------------------------------------------
    for b in blocks:
        for d in b["allowed_days"]:
            bd = model.NewBoolVar(f"act_d_{b['idx']}_{b['ci']}_{d}")
            model.Add(b["day"] == d).OnlyEnforceIf(bd)
            model.Add(b["day"] != d).OnlyEnforceIf(bd.Not())
            model.Add(b["end"] <= active_periods[d]).OnlyEnforceIf(bd)

    # ------------------------------------------------------------------
    # No double-booking: class, teacher, shared labs
    # ------------------------------------------------------------------
    for cid, bks in by_class.items():
        if len(bks) > 1:
            model.AddNoOverlap([b["interval"] for b in bks])

    for tid, bks in by_teacher.items():
        if len(bks) > 1:
            model.AddNoOverlap([b["interval"] for b in bks])

    lab_rooms: dict[str, list[str]] = {
        k: (v if isinstance(v, list) else [v])
        for k, v in (data.get("labSubjects", {}) or {}).items()
    }
    # Each lab block is assigned to exactly one lab of its category; labs cannot
    # be double-booked (modelled with optional intervals per candidate room).
    block_lab_use: dict[tuple, list[tuple[str, cp_model.IntVar]]] = {}
    for room_type, room_ids in lab_rooms.items():
        if DBG_NO_LAB:
            break
        lab_blocks = [b for b in blocks if b["subject"].get("category") == room_type]
        if not lab_blocks or not room_ids:
            continue
        per_room_intervals: dict[str, list] = {r: [] for r in room_ids}
        for b in lab_blocks:
            use_vars = []
            uses = []
            for r in room_ids:
                use = model.NewBoolVar(f"use_{b['idx']}_{b['ci']}_{r}")
                opt_iv = model.NewOptionalIntervalVar(
                    b["fs"], b["L"], b["end"], use, f"optiv_{b['idx']}_{b['ci']}_{r}"
                )
                per_room_intervals[r].append(opt_iv)
                use_vars.append(use)
                uses.append((r, use))
            model.AddExactlyOne(use_vars)
            block_lab_use[(b["idx"], b["ci"])] = uses
        for r, ivs in per_room_intervals.items():
            if len(ivs) > 1:
                model.AddNoOverlap(ivs)

    # ------------------------------------------------------------------
    # Piket load cap (default rule only): >threshold JP teacher on piket day
    # teaches <=1 class. The "blockUnder33" rule is enforced earlier via
    # allowed_days, so it is skipped here.
    # ------------------------------------------------------------------
    for tid, load in teacher_load.items():
        if piket_rule != "capOver30" or load <= PIKET_THRESH or DBG_NO_PIKET:
            continue
        for d in piket_days_for_teacher.get(tid, []):
            class_flags: list[cp_model.IntVar] = []
            # group this teacher's blocks by allocation (= class)
            teacher_allocs: dict[str, list[dict]] = {}
            for b in by_teacher.get(tid, []):
                teacher_allocs.setdefault(b["alloc"]["id"], []).append(b)
            for alloc_id, bks in teacher_allocs.items():
                on_d = model.NewBoolVar(f"piket_{tid}_{alloc_id}_{d}")
                day_flags = []
                for b in bks:
                    fb = model.NewBoolVar(f"pdon_{b['idx']}_{b['ci']}_{d}")
                    model.Add(b["day"] == d).OnlyEnforceIf(fb)
                    model.Add(b["day"] != d).OnlyEnforceIf(fb.Not())
                    day_flags.append(fb)
                model.AddMaxEquality(on_d, day_flags)  # allocation active on day d
                class_flags.append(on_d)
            if class_flags:
                model.Add(sum(class_flags) <= 1)

    # ------------------------------------------------------------------
    # Special teacher rules
    # ------------------------------------------------------------------
    for tid, teacher in teachers.items():
        if DBG_NO_SPECIAL:
            continue
        # Hilmy rule: on forceStartDay, a block must start at forceStartPeriod
        fsd = teacher.get("forceStartDay")
        fsp = teacher.get("forceStartPeriod")
        if fsd is not None and fsp is not None:
            flags = []
            for b in by_teacher.get(tid, []):
                fb = model.NewBoolVar(f"fstart_{b['idx']}_{b['ci']}")
                dm = model.NewBoolVar(f"fdm_{b['idx']}_{b['ci']}")
                sm = model.NewBoolVar(f"fsm_{b['idx']}_{b['ci']}")
                model.Add(b["day"] == fsd).OnlyEnforceIf(dm)
                model.Add(b["day"] != fsd).OnlyEnforceIf(dm.Not())
                model.Add(b["start"] == fsp).OnlyEnforceIf(sm)
                model.Add(b["start"] != fsp).OnlyEnforceIf(sm.Not())
                model.AddBoolAnd([dm, sm]).OnlyEnforceIf(fb)
                model.AddBoolOr([dm.Not(), sm.Not()]).OnlyEnforceIf(fb.Not())
                flags.append(fb)
            if flags:
                model.Add(sum(flags) >= 1)

        # Fixed-schedule teacher (e.g. Amanda): pin provided locked slots
        # (lockedSlots are matched by allocation + chunk index when provided)
        pass

    # Locked slots provided by the caller (designated fixed slots)
    for ls in data.get("lockedSlots", []):
        alloc_id = ls["allocationId"]
        ci = int(ls.get("chunkIdx", 0))
        bks = by_alloc.get(alloc_id, [])
        if ci < len(bks):
            b = bks[ci]
            model.Add(b["day"] == int(ls["dayOfWeek"]))
            model.Add(b["start"] == int(ls["periodIdx"]))

    # ------------------------------------------------------------------
    # Soft constraints
    # ------------------------------------------------------------------
    objective_terms: list[cp_model.LinearExpr] = []
    enable_soft = not DBG_NO_SOFT

    # (1) Heavy subjects preferred in morning periods.
    if enable_soft:
        for b in blocks:
            if b["subject"].get("isHeavy"):
                pe = model.NewIntVar(0, P, f"heavy_{b['idx']}_{b['ci']}")
                model.AddMaxEquality(pe, [0, b["start"] - morning_last])
                objective_terms.append(WHEAVY * pe)

    # Build per-(teacher, flattened t) busy booleans for gap & consecutive.
    busy: dict[tuple[str, int], cp_model.IntVar] = {}
    if enable_soft and (enable_gap or enable_cons):
        occ_lists: dict[tuple[str, int], list[cp_model.IntVar]] = {}
        for b in blocks:
            tid = b["teacherId"]
            L = b["L"]
            fs = b["fs"]
            # only iterate t within the block's reachable days
            for d in b["allowed_days"]:
                for p in range(P):
                    t = d * P + p
                    lo = t - L + 1
                    # occ == (lo <= fs <= t)  [block covers flattened slot t]
                    A = model.NewBoolVar(f"A_{b['idx']}_{b['ci']}_{t}")
                    model.Add(fs <= t).OnlyEnforceIf(A)
                    model.Add(fs >= t + 1).OnlyEnforceIf(A.Not())
                    Bb = model.NewBoolVar(f"B_{b['idx']}_{b['ci']}_{t}")
                    model.Add(fs >= lo).OnlyEnforceIf(Bb)
                    model.Add(fs <= lo - 1).OnlyEnforceIf(Bb.Not())
                    occ = model.NewBoolVar(f"occ_{b['idx']}_{b['ci']}_{t}")
                    model.AddBoolAnd([A, Bb]).OnlyEnforceIf(occ)
                    model.AddBoolOr([A.Not(), Bb.Not()]).OnlyEnforceIf(occ.Not())
                    occ_lists.setdefault((tid, t), []).append(occ)
        for key, ocs in occ_lists.items():
            tid, t = key
            bv = model.NewBoolVar(f"busy_{tid}_{t}")
            for occ in ocs:
                model.Add(occ <= bv)
            model.Add(bv <= sum(ocs))
            busy[key] = bv

    # (2) Gap reduction: penalise idle holes (busy-1, free, busy+1) per teacher/day.
    if enable_gap:
        gap_penalties: list[cp_model.LinearExpr] = []
        for tid in by_teacher:
            for d in range(D):
                for p in range(1, P - 1):
                    prev_b = busy.get((tid, d * P + p - 1))
                    cur_b = busy.get((tid, d * P + p))
                    nxt_b = busy.get((tid, d * P + p + 1))
                    if prev_b is None or cur_b is None or nxt_b is None:
                        continue
                    hole = model.NewBoolVar(f"hole_{tid}_{d}_{p}")
                    # hole == prev_b AND nxt_b AND NOT cur_b (an idle hole)
                    model.AddBoolAnd([prev_b, nxt_b, cur_b.Not()]).OnlyEnforceIf(hole)
                    model.AddBoolOr(
                        [prev_b.Not(), nxt_b.Not(), cur_b]
                    ).OnlyEnforceIf(hole.Not())
                    gap_penalties.append(hole)
        objective_terms.extend(WGAP * g for g in gap_penalties)

    # (3) Consecutive teaching cap: every window of (MAX_CONS+1) periods has
    #     at most MAX_CONS busy.
    if enable_cons:
        cons_penalties: list[cp_model.LinearExpr] = []
        window = MAX_CONS + 1
        for tid in by_teacher:
            for d in range(D):
                for p in range(0, P - window + 1):
                    cells = [busy.get((tid, d * P + p + k)) for k in range(window)]
                    if any(c is None for c in cells):
                        continue
                    over = model.NewIntVar(0, window, f"over_{tid}_{d}_{p}")
                    model.AddMaxEquality(over, [0, sum(cells) - MAX_CONS])
                    cons_penalties.append(over)
        objective_terms.extend(WCONS * c for c in cons_penalties)

    # (4) Class-day compactness: penalise blank periods in the MIDDLE of a
    #     class's day, so free periods are pushed to the end of the day.
    #     gap = (lastEnd - firstStart) - taught   for blocks on that day.
    if enable_soft and enable_class_gap:
        class_gaps: list[cp_model.LinearExpr] = []
        BIG = TOTAL + 1
        for cid, bks in by_class.items():
            for d in range(D):
                inds: list[tuple[dict, cp_model.IntVar]] = []
                for b in bks:
                    bd = model.NewBoolVar(f"cd_{b['idx']}_{b['ci']}_{d}")
                    model.Add(b["day"] == d).OnlyEnforceIf(bd)
                    model.Add(b["day"] != d).OnlyEnforceIf(bd.Not())
                    inds.append((b, bd))
                if not inds:
                    continue
                taught = sum(b["L"] * bd for (b, bd) in inds)
                starts: list[cp_model.IntVar] = []
                ends: list[cp_model.IntVar] = []
                for b, bd in inds:
                    v = model.NewIntVar(0, BIG, f"fst_{b['idx']}_{b['ci']}_{d}")
                    model.Add(v == b["fs"]).OnlyEnforceIf(bd)
                    model.Add(v == BIG).OnlyEnforceIf(bd.Not())
                    starts.append(v)
                    u = model.NewIntVar(-1, TOTAL, f"fen_{b['idx']}_{b['ci']}_{d}")
                    model.Add(u == b["end"]).OnlyEnforceIf(bd)
                    model.Add(u == -1).OnlyEnforceIf(bd.Not())
                    ends.append(u)
                first_start = model.NewIntVar(0, BIG, f"fstart_{cid}_{d}")
                last_end = model.NewIntVar(-1, TOTAL, f"lend_{cid}_{d}")
                model.AddMinEquality(first_start, starts)
                model.AddMaxEquality(last_end, ends)
                raw = model.NewIntVar(-BIG, P, f"cgraw_{cid}_{d}")
                model.Add(raw == last_end - first_start - taught)
                gap = model.NewIntVar(0, P, f"cgap_{cid}_{d}")
                model.AddMaxEquality(gap, [0, raw])
                class_gaps.append(gap)
        objective_terms.extend(WCLASSGAP * g for g in class_gaps)

    if objective_terms and not DBG_NO_SOFT:
        model.Minimize(sum(objective_terms))

    # ------------------------------------------------------------------
    # Solve
    # ------------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout
    solver.parameters.num_search_workers = 8
    solver.parameters.log_search_progress = False

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "INFEASIBLE",
            "objective": None,
            "slots": [],
            "stats": {},
            "conflicts": [
                "No valid timetable satisfies all hard constraints. "
                "Try increasing the period count, relaxing availability, or the solver timeout."
            ],
        }

    class_rooms: dict[str, str | None] = data.get("classRooms", {}) or {}
    out_slots: list[dict] = []
    for b in blocks:
        day_v = solver.Value(b["day"])
        start_v = solver.Value(b["start"])
        L = b["L"]
        a = b["alloc"]
        subject = b["subject"]
        room_type = subject.get("category")
        if room_type and room_type in lab_rooms:
            room_id = None
            for r, use in block_lab_use.get((b["idx"], b["ci"]), []):
                if solver.Value(use) == 1:
                    room_id = r
                    break
        else:
            room_id = class_rooms.get(b["classId"])
        is_locked = bool(teachers[b["teacherId"]].get("isFixedSchedule")) or bool(a.get("locked"))
        block_tag = f"{a['id']}_{day_v}"
        for p in range(start_v, start_v + L):
            out_slots.append(
                {
                    "allocationId": a["id"],
                    "classGroupId": b["classId"],
                    "roomId": room_id,
                    "dayOfWeek": day_v,
                    "periodIdx": p,
                    "isLocked": is_locked,
                    "blockTag": block_tag,
                }
            )

    # Compute realised soft-penalty breakdown for reporting
    stats = compute_stats(out_slots, blocks, D, P, MAX_CONS, morning_last, solver)

    return {
        "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
        "objective": int(solver.ObjectiveValue()) if objective_terms else 0,
        "slots": out_slots,
        "stats": stats,
        "conflicts": [],
    }


def compute_stats(slots, blocks, D, P, MAX_CONS, morning_last, solver):
    """Recompute realised soft penalties from the produced slots (for reporting)."""
    busy_grid: dict[str, set] = {}
    heavy_late = 0
    for b in blocks:
        try:
            d = solver.Value(b["day"])
            st = solver.Value(b["start"])
        except Exception:
            continue
        tid = b["teacherId"]
        for p in range(st, st + b["L"]):
            busy_grid.setdefault(tid, set()).add((d, p))
        if b["subject"].get("isHeavy") and st > morning_last:
            heavy_late += 1

    gaps = 0
    cons_violations = 0
    for tid, cells in busy_grid.items():
        for d in range(D):
            day_cells = sorted(p for (dd, p) in cells if dd == d)
            if not day_cells:
                continue
            span = day_cells[-1] - day_cells[0] + 1
            gaps += span - len(day_cells)
            run = 1
            for i in range(1, len(day_cells)):
                if day_cells[i] == day_cells[i - 1] + 1:
                    run += 1
                else:
                    if run > MAX_CONS:
                        cons_violations += run - MAX_CONS
                    run = 1
            if run > MAX_CONS:
                cons_violations += run - MAX_CONS

    # Class-day internal gaps (blank periods between lessons).
    class_cells: dict[tuple, list] = {}
    for s in slots:
        class_cells.setdefault((s["classGroupId"], s["dayOfWeek"]), []).append(
            s["periodIdx"]
        )
    class_gaps = 0
    for _, periods in class_cells.items():
        if not periods:
            continue
        ps = sorted(periods)
        class_gaps += (ps[-1] - ps[0] + 1) - len(ps)

    return {
        "teacherGapPenalty": gaps,
        "heavyMorningPenalty": heavy_late,
        "consecutivePenalty": cons_violations,
        "classGapPenalty": class_gaps,
    }


def main() -> None:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(json.dumps({"status": "ERROR", "message": f"Invalid JSON input: {exc}"}))
        sys.exit(1)
    result = solve(data)
    print(json.dumps(result, default=int))


if __name__ == "__main__":
    main()
