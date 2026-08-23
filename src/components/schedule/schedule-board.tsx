"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  Sparkles,
} from "lucide-react";

import type { ScheduleData, SlotView } from "@/lib/schedule-data";
import type { ScheduleConfigData } from "@/lib/schedule-time";
import { detectConflicts, slotConflictLevels } from "@/lib/conflicts";
import { applyBlockMove } from "@/lib/slot-utils";
import {
  getScheduleDataAction,
  moveScheduleBlock,
} from "@/app/actions/schedule";
import { exportScheduleToExcel } from "@/lib/export-excel";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScheduleGrid, type ViewMode } from "@/components/schedule/schedule-grid";
import { SnapshotManager } from "@/components/schedule/snapshot-manager";
import { useT } from "@/components/i18n/locale-provider";

type Props = { initialData: ScheduleData; config: ScheduleConfigData };

const TIMEOUTS = [
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
];

type PiketRule = "capOver30" | "blockUnder33";

export function ScheduleBoard({ initialData, config }: Props) {
  const { t } = useT();
  const s = useCallback((k: string) => String(t(k)), [t]);

  const [data, setData] = useState<ScheduleData>(initialData);
  const [viewMode, setViewMode] = useState<ViewMode>("class");
  const [classId, setClassId] = useState<string>(initialData.classes[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState<string>(initialData.teachers[0]?.id ?? "");
  const [roomId, setRoomId] = useState<string>(initialData.rooms[0]?.id ?? "");
  const [timeout, setTimeoutSec] = useState<number>(30);
  const [piketRule, setPiketRule] = useState<PiketRule>("capOver30");
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const conflicts = useMemo(() => detectConflicts(data.slots), [data.slots]);
  const conflictLevels = useMemo(() => slotConflictLevels(conflicts), [conflicts]);
  const hardCount = conflicts.filter((c) => c.level === "hard").length;
  const softCount = conflicts.filter((c) => c.level === "soft").length;

  const resources = useMemo(() => {
    if (viewMode === "class") return data.classes.map((c) => ({ id: c.id, label: `${s("schedule.byClass").split(" ")[1] ?? ""} ${c.name}` }));
    if (viewMode === "teacher")
      return data.teachers.map((tt) => ({ id: tt.id, label: `${tt.code} · ${tt.name}` }));
    return data.rooms.map((r) => ({ id: r.id, label: r.name }));
  }, [viewMode, data, s]);

  const selectedId =
    viewMode === "class" ? classId : viewMode === "teacher" ? teacherId : roomId;
  const effectiveId = resources.some((r) => r.id === selectedId)
    ? selectedId
    : (resources[0]?.id ?? "");

  const visibleSlots: SlotView[] = useMemo(() => {
    if (viewMode === "class") return data.slots.filter((x) => x.classGroupId === effectiveId);
    if (viewMode === "teacher") return data.slots.filter((x) => x.teacherId === effectiveId);
    return data.slots.filter((x) => x.roomId === effectiveId);
  }, [data.slots, viewMode, effectiveId]);

  function setSelection(id: string) {
    if (viewMode === "class") setClassId(id);
    else if (viewMode === "teacher") setTeacherId(id);
    else setRoomId(id);
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const t0 = Date.now();
    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timeoutSeconds: timeout, piketRule }),
        signal: controller.signal,
      });
      
      if (res.status === 429) {
        const errJson = await res.json().catch(() => ({ message: "Generation in progress by another user." }));
        toast.error("Generation blocked", { description: errJson.message });
        return;
      }
      
      const json = (await res.json()) as {
        ok: boolean;
        status?: string;
        objective?: number;
        stats?: Record<string, number>;
        message?: string;
        conflicts?: string[];
      };
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (json.ok) {
        const stats = json.stats ?? {};
        const ruleLabel = piketRule === "blockUnder33" ? s("schedule.piketBlock") : s("schedule.piketCap");
        toast.success(
          (t("schedule.toastGenerated") as (a: string, b: string) => string)(json.status?.toLowerCase() ?? "", secs),
          {
            description: `${s("schedule.title")}: ${ruleLabel} · ${stats.classGapPenalty ?? 0} · ${stats.teacherGapPenalty ?? 0} · ${stats.consecutivePenalty ?? 0}`,
          },
        );
        const fresh = await getScheduleDataAction();
        setData(fresh);
      } else {
        toast.error(s("schedule.toastFailed"), {
          description: json.message ?? json.conflicts?.join(" "),
        });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") toast.info(s("schedule.toastCancelled"));
      else toast.error(s("schedule.toastError"), { description: (e as Error).message });
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  async function handleMove(slotId: string, toDay: number, toPeriod: number) {
    const prev = data;
    const attempt = applyBlockMove(data.slots, slotId, toDay, toPeriod);
    if (!attempt.ok) {
      toast.error(s("schedule.toastCannotMove"), { description: attempt.reason });
      return;
    }
    setData({ ...data, slots: attempt.slots });
    const res = await moveScheduleBlock({ slotId, toDay, toPeriod });
    if (!res.ok) {
      setData(prev);
      toast.error(s("schedule.toastMoveBlocked"), { description: res.message });
    } else if (res.conflicts.length) {
      toast.warning(s("schedule.toastMovedWarn"), {
        description: res.conflicts.slice(0, 2).map((c) => c.message).join(" · "),
      });
    }
  }

  function handleExport() {
    try {
      exportScheduleToExcel(data, config);
      toast.success(s("schedule.toastExported"));
    } catch (e) {
      toast.error(s("schedule.toastExportFailed"), { description: (e as Error).message });
    }
  }

  const hasSlots = data.slots.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{s("schedule.title")}</h1>
          <p className="text-sm text-muted-foreground">{s("schedule.desc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(timeout)} onValueChange={(v) => v && setTimeoutSec(Number(v))}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEOUTS.map((tt) => (
                <SelectItem key={tt.value} value={String(tt.value)}>{tt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={piketRule} onValueChange={(v) => setPiketRule(v as PiketRule)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="capOver30">{s("schedule.piketCap")}</SelectItem>
              <SelectItem value="blockUnder33">{s("schedule.piketBlock")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? s("schedule.generating") : s("schedule.generate")}
          </Button>
          <SnapshotManager onRestored={(fresh) => setData(fresh)} disabled={generating} />
          <Button variant="outline" onClick={handleExport} disabled={!hasSlots}>
            <Download className="mr-2 h-4 w-4" /> {s("schedule.excel")}
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={!hasSlots}>
            <Printer className="mr-2 h-4 w-4" /> {s("schedule.print")}
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="class">{s("schedule.byClass")}</TabsTrigger>
            <TabsTrigger value="teacher">{s("schedule.byTeacher")}</TabsTrigger>
            <TabsTrigger value="room">{s("schedule.byRoom")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={effectiveId} onValueChange={(v) => v && setSelection(v)}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {resources.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {hardCount === 0 ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {(t("schedule.hardBadge") as (n: number) => string)(0)}
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {(t("schedule.hardBadge") as (n: number) => string)(hardCount)}
            </Badge>
          )}
          {softCount > 0 && (
            <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> {(t("schedule.softBadge") as (n: number) => string)(softCount)}
            </Badge>
          )}
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-3">
          <h2 className="mb-2 hidden text-center text-lg font-bold print:block">
            JADWAL KBM — {currentResourceLabel()}
          </h2>
          {hasSlots ? (
            <ScheduleGrid
              viewMode={viewMode}
              slots={visibleSlots}
              conflictLevels={conflictLevels}
              onMove={handleMove}
              config={config}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8" />
              <p className="font-medium">{s("schedule.emptyTitle")}</p>
              <p className="text-sm">{s("schedule.emptyDesc")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground print:hidden">{s("schedule.tip")}</p>
    </div>
  );

  function currentResourceLabel() {
    return resources.find((r) => r.id === effectiveId)?.label ?? "";
  }
}
