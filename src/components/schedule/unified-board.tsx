"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Info, Printer } from "lucide-react";
import { toast } from "sonner";
import type { ScheduleData, SlotView } from "@/lib/schedule-data";
import type { ScheduleConfigData } from "@/lib/schedule-time";
import { buildTimeline } from "@/lib/schedule-time";
import { DAYS_PER_WEEK } from "@/lib/schedule-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportScheduleToExcel } from "@/lib/export-excel";
import { useT } from "@/components/i18n/locale-provider";

const PALETTE = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  "bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200",
  "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
];

function subjectColor(subjectId: string): string {
  let h = 0;
  for (let i = 0; i < subjectId.length; i++) h = (h * 31 + subjectId.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function matrixFor(slots: SlotView[], keyFn: (s: SlotView) => boolean, periodCount: number) {
  const m: (SlotView | null)[][] = Array.from({ length: DAYS_PER_WEEK }, () =>
    Array.from({ length: periodCount }, () => null),
  );
  for (const s of slots) {
    if (!keyFn(s)) continue;
    if (s.dayOfWeek >= 0 && s.dayOfWeek < DAYS_PER_WEEK && s.periodIdx >= 0 && s.periodIdx < periodCount) {
      m[s.dayOfWeek][s.periodIdx] = s;
    }
  }
  return m;
}

export function UnifiedTimetableBoard({
  data,
  config,
}: {
  data: ScheduleData;
  config: ScheduleConfigData;
}) {
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const days = (t("common.days") as string[]).slice(0, DAYS_PER_WEEK);
  const hasSlots = data.slots.length > 0;
  const [legendOpen, setLegendOpen] = useState(true);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{s("unified.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {(t("unified.subtitle") as (c: number, r: number, g: number) => string)(
              data.classes.length,
              data.rooms.length,
              data.teachers.length,
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLegendOpen((v) => !v)}>
            <Info className="mr-2 h-4 w-4" /> {s("unified.legend")}
          </Button>
          <Link href="/timetable/print" className={buttonVariants({ variant: "outline" })}>
            <Printer className="mr-2 h-4 w-4" /> {s("unified.print")}
          </Link>
          <Button
            variant="outline"
            disabled={!hasSlots}
            onClick={() => {
              try {
                exportScheduleToExcel(data, config);
              } catch (e) {
                toast.error(s("schedule.toastExportFailed"), { description: (e as Error).message });
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" /> {s("unified.export")}
          </Button>
        </div>
      </div>

      {legendOpen && <Legend data={data} />}

      {!hasSlots ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          {s("unified.empty")}
        </div>
      ) : (
        <Tabs defaultValue="wall">
          <TabsList>
            <TabsTrigger value="wall">{s("unified.tabs.wall")}</TabsTrigger>
            <TabsTrigger value="rooms">{s("unified.tabs.rooms")}</TabsTrigger>
            <TabsTrigger value="teachers">{s("unified.tabs.teachers")}</TabsTrigger>
            <TabsTrigger value="table">{s("unified.tabs.table")}</TabsTrigger>
          </TabsList>
          <TabsContent value="wall" className="mt-4"><ClassWall data={data} days={days} config={config} /></TabsContent>
          <TabsContent value="rooms" className="mt-4"><RoomMatrix data={data} days={days} periodCount={config.periods.length} /></TabsContent>
          <TabsContent value="teachers" className="mt-4"><TeacherHeatmap data={data} days={days} periodCount={config.periods.length} /></TabsContent>
          <TabsContent value="table" className="mt-4"><AdvancedTable data={data} days={days} config={config} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Legend({ data }: { data: ScheduleData }) {
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const teachersBySubject = useMemo(() => {
    const m = new Map<string, { code: number; name: string }[]>();
    for (const tt of data.teachers) {
      const subj = data.subjects.find((x) => x.name === tt.subjectName);
      if (!subj) continue;
      const arr = m.get(subj.id) ?? [];
      arr.push({ code: tt.code, name: tt.name });
      m.set(subj.id, arr);
    }
    for (const sl of data.slots) {
      const arr = m.get(sl.subjectId);
      if (arr && !arr.some((x) => x.code === sl.teacherCode)) {
        arr.push({ code: sl.teacherCode, name: sl.teacherName });
      }
    }
    return m;
  }, [data]);

  return (
    <div className="mb-5 space-y-3 rounded-md border bg-muted/30 p-4">
      <div>
        <h2 className="text-sm font-semibold">{s("unified.legendTitle")}</h2>
        <p className="text-xs text-muted-foreground">{s("unified.legendDesc")}</p>
      </div>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {data.subjects.map((subj) => {
          const teachers = (teachersBySubject.get(subj.id) ?? []).sort((a, b) => a.code - b.code);
          return (
            <div key={subj.id} className="flex items-start gap-2 rounded-md border bg-background p-2">
              <span className={`mt-0.5 h-5 w-5 shrink-0 rounded ${subjectColor(subj.id)}`} />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{subj.name}</span>
                  <code className="rounded bg-muted px-1 text-[10px]">{subj.code}</code>
                  <span className="text-[10px] text-muted-foreground">{subj.totalJp} JP</span>
                  {subj.isHeavy && <Badge variant="secondary" className="px-1 text-[9px]">{s("admin.classes.heavy")}</Badge>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {teachers.length ? (
                    teachers.map((tt) => (
                      <span key={tt.code} title={tt.name} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                        {tt.code} · {tt.name.split(",")[0]}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{s("unified.noTeacher")}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
        <span><strong>{s("unified.reading.wall")}</strong></span>
        <span><strong>{s("unified.reading.room")}</strong></span>
        <span><strong>{s("unified.reading.teacher")}</strong></span>
        <span><strong>{s("unified.reading.table")}</strong></span>
        <span>{s("unified.reading.lab")}</span>
      </div>
    </div>
  );
}

function ClassWall({ data, days, config }: { data: ScheduleData; days: string[]; config: ScheduleConfigData }) {
  const pc = config.periods.length;
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
      {data.classes.map((c) => {
        const m = matrixFor(data.slots, (x) => x.classGroupId === c.id, pc);
        return (
          <div key={c.id} className="rounded-md border p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">{days.map((d) => d[0]).join(" ")}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {config.periods.map((p) => (
                <div key={p.index} className="grid grid-cols-5 gap-0.5">
                  {days.map((_, d) => {
                    const sl = m[d][p.index];
                    return (
                      <div
                        key={d}
                        title={sl ? `${sl.subjectName} / ${sl.teacherCode}${sl.roomName ? " · " + sl.roomName : ""}` : ""}
                        className={`flex h-6 items-center justify-center rounded text-[10px] font-medium ${
                          sl ? subjectColor(sl.subjectId) : "bg-muted/40"
                        }`}
                      >
                        {sl ? sl.teacherCode : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoomMatrix({ data, days, periodCount }: { data: ScheduleData; days: string[]; periodCount: number }) {
  const { t } = useT();
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-center text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background px-2 text-left text-xs">{String(t("unified.roomHeader"))}</th>
            {days.map((d) => (
              <th key={d} colSpan={periodCount} className="border-b border-l border-border bg-muted px-1 text-xs">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rooms.map((r) => {
            const m = matrixFor(data.slots, (x) => x.roomId === r.id, periodCount);
            return (
              <tr key={r.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-2 text-left text-xs font-medium">
                  {r.name}{r.isLab && <span className="ml-1">🧪</span>}
                </td>
                {days.map((_, d) =>
                  Array.from({ length: periodCount }).map((_, p) => {
                    const sl = m[d][p];
                    return (
                      <td key={`${d}-${p}`} className="p-0">
                        <div
                          title={sl ? `${sl.classGroupName} · ${sl.subjectName} / ${sl.teacherCode}` : ""}
                          className={`flex h-7 min-w-[44px] items-center justify-center rounded px-1 ${
                            sl ? subjectColor(sl.subjectId) : "bg-muted/30"
                          }`}
                        >
                          {sl ? sl.classGroupName : ""}
                        </div>
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// (helpers inlined above)

function TeacherHeatmap({ data, days, periodCount }: { data: ScheduleData; days: string[]; periodCount: number }) {
  const { t } = useT();
  const loadByTeacher = useMemo(() => {
    const m = new Map<string, number>();
    for (const sl of data.slots) m.set(sl.teacherId, (m.get(sl.teacherId) ?? 0) + 1);
    return m;
  }, [data.slots]);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-center text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background px-2 text-left text-xs">{String(t("unified.teacherHeader"))}</th>
            {days.map((d) => (
              <th key={d} colSpan={periodCount} className="border-b border-l border-border bg-muted px-1 text-xs">{d}</th>
            ))}
            <th className="bg-background px-2 text-xs">{String(t("unified.load"))}</th>
          </tr>
        </thead>
        <tbody>
          {data.teachers.map((tt) => {
            const m = matrixFor(data.slots, (x) => x.teacherId === tt.id, periodCount);
            const load = loadByTeacher.get(tt.id) ?? 0;
            return (
              <tr key={tt.id}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-2 text-left text-xs">
                  <span className="font-mono text-muted-foreground">{tt.code}</span>{" "}
                  <span className="font-medium">{tt.name.split(",")[0]}</span>
                </td>
                {days.map((_, d) =>
                  Array.from({ length: periodCount }).map((_, p) => {
                    const sl = m[d][p];
                    return (
                      <td key={`${d}-${p}`} className="p-0">
                        <div
                          title={sl ? `${sl.classGroupName} · ${sl.subjectName}` : ""}
                          className={`h-6 min-w-[18px] rounded ${sl ? subjectColor(sl.subjectId) : "bg-muted/30"}`}
                        />
                      </td>
                    );
                  }),
                )}
                <td className="bg-background px-2">
                  <Badge variant="outline" className="text-[10px]">{load}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdvancedTable({ data, days, config }: { data: ScheduleData; days: string[]; config: ScheduleConfigData }) {
  const { t } = useT();
  const breakLabel = String(t("schedule.breakLabel"));
  const timeline = buildTimeline(config);

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-muted px-3 py-2 text-left font-semibold">{String(t("unified.classHeader"))}</th>
            {days.map((d) => (
              <th key={d} className="min-w-[170px] border-l border-border bg-muted px-2 py-2 font-semibold">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.classes.map((c) => (
            <tr key={c.id} className="align-top">
              <td className="sticky left-0 z-10 bg-background px-3 py-2 font-semibold">{c.name}</td>
              {days.map((_, d) => {
                const daySlots = data.slots.filter((x) => x.classGroupId === c.id && x.dayOfWeek === d);
                const byPeriod = new Map(daySlots.map((x) => [x.periodIdx, x]));
                return (
                  <td key={d} className="border-l border-t border-border p-1">
                    <div className="flex flex-col gap-0.5">
                      {timeline.map((entry, ti) =>
                        entry.kind === "break" ? (
                          <div
                            key={`b${ti}`}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                          >
                            {breakLabel} · {entry.brk.label}
                          </div>
                        ) : (
                          (() => {
                            const p = entry.period;
                            const sl = byPeriod.get(p.index);
                            return (
                              <div
                                key={`p${ti}`}
                                title={sl ? `${sl.subjectName} / ${sl.teacherCode} · ${sl.teacherName}${sl.roomName ? " @ " + sl.roomName : ""}` : ""}
                                className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 ${
                                  sl ? subjectColor(sl.subjectId) : "bg-muted/40 text-muted-foreground"
                                }`}
                              >
                                <span className="truncate">
                                  <span className="font-mono text-[10px] opacity-70">{p.start || `JP${p.index + 1}`} </span>
                                  {sl ? sl.subjectName : "—"}
                                </span>
                                {sl && <span className="font-mono opacity-80">/{sl.teacherCode}</span>}
                              </div>
                            );
                          })()
                        ),
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
