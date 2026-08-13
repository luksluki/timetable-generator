import type { SlotView } from "@/lib/schedule-data";
import { PERIODS_PER_DAY, DAYS_PER_WEEK } from "@/lib/schedule-config";

export type BlockMoveResult =
  | { ok: true; slots: SlotView[] }
  | { ok: false; reason: string };

/**
 * Pure client-side application of a block move (mirrors the server action).
 * Returns the new slot list, or a rejection reason.
 */
export function applyBlockMove(
  slots: SlotView[],
  slotId: string,
  toDay: number,
  toPeriod: number,
): BlockMoveResult {
  const dragged = slots.find((s) => s.id === slotId);
  if (!dragged) return { ok: false, reason: "Slot not found." };
  if (dragged.isLocked) {
    return { ok: false, reason: "This slot is locked and cannot be moved." };
  }
  if (
    toDay < 0 ||
    toDay >= DAYS_PER_WEEK ||
    toPeriod < 0 ||
    toPeriod >= PERIODS_PER_DAY
  ) {
    return { ok: false, reason: "Target is outside the grid." };
  }

  const block = slots.filter(
    (s) =>
      s.allocationId === dragged.allocationId &&
      s.dayOfWeek === dragged.dayOfWeek,
  );
  const minP = Math.min(...block.map((s) => s.periodIdx));
  const offset = dragged.periodIdx - minP;
  const newStart = toPeriod - offset;
  const blockLen = block.length;

  if (newStart < 0 || newStart + blockLen > PERIODS_PER_DAY) {
    return { ok: false, reason: "The block does not fit at the target." };
  }

  const movedIds = new Set(block.map((s) => s.id));
  const next = slots.map((s) => {
    if (!movedIds.has(s.id)) return s;
    const rel = s.periodIdx - minP;
    return {
      ...s,
      dayOfWeek: toDay,
      periodIdx: newStart + rel,
      blockTag: `${s.allocationId}_${toDay}`,
    };
  });
  return { ok: true, slots: next };
}
