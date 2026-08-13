"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Lock } from "lucide-react";
import type { SlotView } from "@/lib/schedule-data";
import { DAYS_PER_WEEK } from "@/lib/schedule-config";
import { buildTimeline, type ScheduleConfigData } from "@/lib/schedule-time";
import { useT } from "@/components/i18n/locale-provider";

export type ViewMode = "class" | "teacher" | "room";

type Props = {
  viewMode: ViewMode;
  slots: SlotView[];
  conflictLevels: Map<string, "hard" | "soft">;
  onMove: (slotId: string, toDay: number, toPeriod: number) => void;
  config: ScheduleConfigData;
};

function cellText(viewMode: ViewMode, s: SlotView): { primary: string; secondary: string } {
  if (viewMode === "class") return { primary: s.subjectName, secondary: `/ ${s.teacherCode}` };
  if (viewMode === "teacher") return { primary: s.subjectName, secondary: `/ ${s.classGroupName}` };
  return { primary: s.subjectName, secondary: `/ ${s.classGroupName} · ${s.teacherCode}` };
}

export function ScheduleGrid({ viewMode, slots, conflictLevels, onMove, config }: Props) {
  const { t } = useT();
  const days = (t("common.days") as string[]).slice(0, DAYS_PER_WEEK);
  const breakLabel = String(t("schedule.breakLabel"));
  const timeline = buildTimeline(config);

  const matrix: (SlotView | null)[][] = Array.from({ length: DAYS_PER_WEEK }, () =>
    Array.from({ length: config.periods.length }, () => null),
  );
  for (const s of slots) {
    if (s.dayOfWeek >= 0 && s.dayOfWeek < DAYS_PER_WEEK && s.periodIdx >= 0 && s.periodIdx < config.periods.length) {
      matrix[s.dayOfWeek][s.periodIdx] = s;
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const slotId = result.draggableId;
    const [day, period] = result.destination.droppableId.split("-").map(Number);
    onMove(slotId, day, period);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center text-xs">
          <thead>
            <tr>
              <th className="w-20 shrink-0 rounded-md bg-muted p-2 font-medium text-muted-foreground">
                JP
              </th>
              {days.map((day) => (
                <th key={day} className="min-w-[140px] rounded-md bg-muted p-2 font-semibold">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((entry, ti) => {
              if (entry.kind === "break") {
                return (
                  <tr key={`brk-${ti}`}>
                    <td
                      colSpan={days.length + 1}
                      className="rounded-md bg-amber-100 px-3 py-1 text-center text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      {breakLabel} · {entry.brk.label} ({entry.brk.start}–{entry.brk.end})
                    </td>
                  </tr>
                );
              }
              const p = entry.period;
              return (
                <tr key={`jp-${ti}`}>
                  <td className="rounded-md bg-muted p-2 text-muted-foreground">
                    <div className="font-medium">JP {p.index + 1}</div>
                    {p.start && (
                      <div className="text-[10px] font-mono opacity-70">
                        {p.start}–{p.end}
                      </div>
                    )}
                  </td>
                  {days.map((_, d) => {
                    const slot = matrix[d][p.index];
                    const key = `${d}-${p.index}`;
                    return (
                      <td key={d} className="p-0 align-top">
                        <Droppable droppableId={key}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`relative flex min-h-[56px] items-center justify-center rounded-md border p-1 transition-colors ${
                                snapshot.isDraggingOver
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card"
                              }`}
                            >
                              {slot ? (
                                <Draggable draggableId={slot.id} index={0} isDragDisabled={slot.isLocked}>
                                  {(drag, snap) => {
                                    const level = conflictLevels.get(slot.id);
                                    const cls =
                                      level === "hard"
                                        ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                                        : level === "soft"
                                          ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                                          : "border-transparent bg-primary/10 text-primary-foreground";
                                    const { primary, secondary } = cellText(viewMode, slot);
                                    return (
                                      <div
                                        ref={drag.innerRef}
                                        {...drag.draggableProps}
                                        {...drag.dragHandleProps}
                                        className={`relative flex w-full flex-col gap-0.5 rounded-md border-2 px-2 py-1 text-left shadow-sm ${
                                          snap.isDragging ? "opacity-80" : ""
                                        } ${cls}`}
                                        style={drag.draggableProps.style}
                                        title={`${slot.subjectName} — ${slot.teacherName}${slot.roomName ? ` @ ${slot.roomName}` : ""}`}
                                      >
                                        <span className="font-semibold leading-tight">{primary}</span>
                                        <span className="leading-tight opacity-90">{secondary}</span>
                                        {slot.isLocked && (
                                          <Lock className="absolute right-1 top-1 h-3 w-3 opacity-60" />
                                        )}
                                      </div>
                                    );
                                  }}
                                </Draggable>
                              ) : null}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DragDropContext>
  );
}
