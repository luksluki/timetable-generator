"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useT } from "@/components/i18n/locale-provider";
import { DAY_NAMES_ID } from "@/lib/schedule-config";
import {
  buildTimeline,
  ensureConfigRows,
  getTotalWeeklyJp,
  type ScheduleConfigData,
  type PeriodDef,
  type BreakDef,
} from "@/lib/schedule-time";
import { saveScheduleConfig, resetScheduleConfig } from "@/app/actions/settings";

type Props = { initial: ScheduleConfigData };

export function SettingsManager({ initial }: Props) {
  const router = useRouter();
  const { t } = useT();
  const [config, setConfig] = useState<ScheduleConfigData>(() =>
    ensureConfigRows(initial),
  );
  const [saving, setSaving] = useState(false);

  function updatePeriod(idx: number, field: keyof PeriodDef, value: string) {
    setConfig((c) => ({
      ...c,
      periods: c.periods.map((p) =>
        p.index === idx ? { ...p, [field]: value } : p,
      ),
    }));
  }
  function addPeriod() {
    setConfig((c) => {
      const next = [...c.periods, { index: c.periods.length, start: "", end: "" }];
      return { ...c, periods: next };
    });
  }
  function removePeriod(idx: number) {
    setConfig((c) => ({
      ...c,
      periods: c.periods.filter((p) => p.index !== idx).map((p, i) => ({ ...p, index: i })),
      breaks: c.breaks.filter((b) => b.afterIndex !== idx),
    }));
  }

  function updateBreak(id: string, field: keyof BreakDef, value: string) {
    setConfig((c) => ({
      ...c,
      breaks: c.breaks.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    }));
  }
  function addBreak() {
    setConfig((c) => ({
      ...c,
      breaks: [
        ...c.breaks,
        {
          id: `b${Date.now()}`,
          afterIndex: 0,
          start: "",
          end: "",
          label: String(t("schedule.breakLabel") ?? "Break"),
        },
      ],
    }));
  }
  function removeBreak(id: string) {
    setConfig((c) => ({ ...c, breaks: c.breaks.filter((b) => b.id !== id) }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await saveScheduleConfig({
        periods: config.periods,
        breaks: config.breaks,
        academicYear: config.academicYear,
        semester: config.semester,
        activePeriodsPerDay: config.activePeriodsPerDay,
      });
      if (res.ok) {
        toast.success(String(t("common.saved")));
        router.refresh();
      } else {
        toast.error(String(t("common.saveFailed")), { description: res.error });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    await resetScheduleConfig();
    toast.success(String(t("common.saved")));
    router.refresh();
  }

  const s = (k: string) => String(t(k));
  const timeline = buildTimeline(config);

  return (
    <div>
      <AdminPageHeader
        title={s("admin.settings.title")}
        description={s("admin.settings.description")}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" /> {s("admin.settings.reset")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {s("admin.settings.save")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Settings */}
        <div className="rounded-md border lg:col-span-2">
          <div className="border-b px-3 py-2 text-sm font-semibold">{s("admin.settings.general")}</div>
          <div className="flex flex-wrap gap-4 p-4">
            <div className="space-y-1.5">
              <Label>{s("admin.settings.academicYear")}</Label>
              <Input
                className="w-[200px]"
                value={config.academicYear}
                onChange={(e) => setConfig((c) => ({ ...c, academicYear: e.target.value }))}
                placeholder="2026-2027"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{s("admin.settings.semester")}</Label>
              <Select
                value={config.semester}
                onValueChange={(v) => setConfig((c) => ({ ...c, semester: v || "Ganjil" }))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue>
                    {config.semester === "Ganjil" ? "Ganjil (Odd)" : "Genap (Even)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ganjil">Ganjil (Odd)</SelectItem>
                  <SelectItem value="Genap">Genap (Even)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Active Periods Per Day */}
        <div className="rounded-md border lg:col-span-2">
          <div className="border-b px-3 py-2 text-sm font-semibold">Total JP / Hari</div>
          <div className="flex flex-wrap gap-4 p-4">
            {DAY_NAMES_ID.map((dayName, idx) => (
              <div key={idx} className="space-y-1.5 flex flex-col">
                <Label className="text-xs text-muted-foreground">{dayName}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="w-[80px]"
                  value={config.activePeriodsPerDay[idx]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 0;
                    setConfig((c) => {
                      const newArr = [...c.activePeriodsPerDay];
                      newArr[idx] = v;
                      return { ...c, activePeriodsPerDay: newArr };
                    });
                  }}
                />
              </div>
            ))}
            <div className="ml-auto flex flex-col justify-end">
              <span className="text-xs text-muted-foreground">Total Mingguan</span>
              <span className="text-lg font-bold">{getTotalWeeklyJp(config)} JP</span>
            </div>
          </div>
        </div>

        {/* JP time periods */}
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">{s("admin.settings.period")}</span>
            <Button size="sm" variant="outline" onClick={addPeriod}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {s("admin.settings.addPeriod")}
            </Button>
          </div>
          <div className="p-3 space-y-2">
            {config.periods.map((p) => (
              <div key={p.index} className="flex items-center gap-2">
                <span className="w-12 text-sm font-medium">JP {p.index + 1}</span>
                <Input
                  type="time"
                  className="w-[120px]"
                  value={p.start}
                  onChange={(e) => updatePeriod(p.index, "start", e.target.value)}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  className="w-[120px]"
                  value={p.end}
                  onChange={(e) => updatePeriod(p.index, "end", e.target.value)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removePeriod(p.index)}
                  title={s("admin.settings.remove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Breaks */}
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">{s("admin.settings.breaks")}</span>
            <Button size="sm" variant="outline" onClick={addBreak}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {s("admin.settings.addBreak")}
            </Button>
          </div>
          <div className="p-3 space-y-2">
            {config.breaks.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {s("common.noRecords")}
              </p>
            )}
            {config.breaks.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col">
                  <Label className="text-[10px] text-muted-foreground">{s("admin.settings.label")}</Label>
                  <Input
                    className="h-8 w-[130px]"
                    value={b.label}
                    onChange={(e) => updateBreak(b.id, "label", e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-[10px] text-muted-foreground">{s("admin.settings.after")}</Label>
                  <Select
                    value={String(b.afterIndex)}
                    onValueChange={(v) => v && updateBreak(b.id, "afterIndex", v)}
                  >
                    <SelectTrigger className="h-8 w-[90px]">
                      <SelectValue>
                        {String(b.afterIndex) ? `JP ${Number(b.afterIndex) + 1}` : ""}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {config.periods.map((p) => (
                        <SelectItem key={p.index} value={String(p.index)}>
                          JP {p.index + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col">
                  <Label className="text-[10px] text-muted-foreground">{s("admin.settings.start")}</Label>
                  <Input
                    type="time"
                    className="h-8 w-[110px]"
                    value={b.start}
                    onChange={(e) => updateBreak(b.id, "start", e.target.value)}
                  />
                </div>
                <div className="flex flex-col">
                  <Label className="text-[10px] text-muted-foreground">{s("admin.settings.end")}</Label>
                  <Input
                    type="time"
                    className="h-8 w-[110px]"
                    value={b.end}
                    onChange={(e) => updateBreak(b.id, "end", e.target.value)}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 self-end text-destructive"
                  onClick={() => removeBreak(b.id)}
                  title={s("admin.settings.remove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day timeline preview */}
      <div className="mt-6 rounded-md border p-3">
        <div className="mb-2 text-sm font-semibold">{s("admin.settings.timelineTitle")}</div>
        <div className="flex flex-col gap-1">
          {timeline.map((entry, i) =>
            entry.kind === "period" ? (
              <div key={i} className="flex items-center gap-3 rounded bg-primary/5 px-2 py-1 text-sm">
                <span className="w-12 font-medium">JP {entry.period.index + 1}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {entry.period.start}–{entry.period.end}
                </span>
              </div>
            ) : (
              <div key={i} className="flex items-center gap-3 rounded bg-amber-100 px-2 py-1 text-sm dark:bg-amber-950/40">
                <span className="w-12 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {s("schedule.breakLabel")}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {entry.brk.label} · {entry.brk.start}–{entry.brk.end}
                </span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
