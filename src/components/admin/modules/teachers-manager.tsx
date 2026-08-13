"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EntitySheet, type FieldDef } from "@/components/admin/entity-sheet";
import { RowActions } from "@/components/admin/row-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { upsertTeacher, deleteTeacher } from "@/app/actions/teachers";
import { useT } from "@/components/i18n/locale-provider";

export type TeacherRow = {
  id: string;
  code: number;
  name: string;
  subjectName: string;
  maxHoursPerDay: number;
  blockedDays: number[];
  forceStartDay: number | null;
  forceStartPeriod: number | null;
  isFixedSchedule: boolean;
};

export function TeachersManager({ teachers }: { teachers: TeacherRow[] }) {
  const router = useRouter();
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const days = t("common.days") as string[];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);

  const CREATE_DEFAULTS = {
    code: "", name: "", subjectName: "", maxHoursPerDay: 9,
    blockedDays: [], forceStartDay: "", forceStartPeriod: "", isFixedSchedule: false,
  };
  const defaultValues = editing
    ? {
        code: editing.code, name: editing.name, subjectName: editing.subjectName,
        maxHoursPerDay: editing.maxHoursPerDay, blockedDays: editing.blockedDays,
        forceStartDay: editing.forceStartDay != null ? String(editing.forceStartDay) : "",
        forceStartPeriod: editing.forceStartPeriod != null ? String(editing.forceStartPeriod) : "",
        isFixedSchedule: editing.isFixedSchedule,
      }
    : CREATE_DEFAULTS;

  const FIELDS: FieldDef[] = [
    { name: "code", label: s("admin.teachers.fCode"), type: "number" },
    { name: "name", label: s("admin.teachers.fName"), type: "text" },
    { name: "subjectName", label: s("admin.teachers.fSubject"), type: "text" },
    { name: "maxHoursPerDay", label: s("admin.teachers.fMax"), type: "number" },
    { name: "blockedDays", label: s("admin.teachers.blocked"), type: "days", description: s("admin.teachers.fBlockedDesc") },
    {
      name: "forceStartDay", label: s("admin.teachers.fForceDay"), type: "nullable-select",
      options: days.map((n, i) => ({ label: n, value: String(i) })), description: s("admin.teachers.fForceDayDesc"),
    },
    {
      name: "forceStartPeriod", label: s("admin.teachers.fForcePeriod"), type: "nullable-select",
      options: Array.from({ length: 9 }).map((_, i) => ({ label: `JP ${i + 1}`, value: String(i) })),
    },
    { name: "isFixedSchedule", label: s("admin.teachers.fFixed"), type: "checkbox", description: s("admin.teachers.fFixedDesc") },
  ];

  async function onSubmit(values: Record<string, unknown>) {
    const res = await upsertTeacher(values, editing?.id);
    if (res.ok) router.refresh();
    return res;
  }

  const columns: Column<TeacherRow>[] = [
    { key: "code", header: s("admin.teachers.code"), sortValue: (x) => x.code, render: (x) => <span className="font-mono">{x.code}</span> },
    { key: "name", header: s("admin.teachers.name"), sortValue: (x) => x.name, render: (x) => <span className="font-medium">{x.name}</span> },
    { key: "subject", header: s("admin.teachers.subject"), sortValue: (x) => x.subjectName, render: (x) => x.subjectName || s("common.dash") },
    { key: "max", header: s("admin.teachers.maxDay"), sortValue: (x) => x.maxHoursPerDay },
    {
      key: "blocked", header: s("admin.teachers.blocked"),
      render: (x) =>
        x.blockedDays.length ? (
          <div className="flex flex-wrap gap-1">
            {x.blockedDays.map((d) => (
              <Badge key={d} variant="destructive" className="px-1.5 text-[10px]">{(days[d] ?? "").slice(0, 3)}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">{s("common.dash")}</span>
        ),
    },
    {
      key: "fixed", header: s("admin.teachers.fixed"),
      render: (x) => (x.isFixedSchedule ? <Badge variant="secondary">{s("admin.teachers.locked")}</Badge> : s("common.dash")),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title={s("admin.teachers.title")}
        description={s("admin.teachers.desc")}
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> {s("admin.teachers.add")}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={teachers}
        getRowId={(x) => x.id}
        searchKeys={(x) => `${x.code} ${x.name} ${x.subjectName}`}
        actions={(x) => (
          <RowActions
            onEdit={() => { setEditing(x); setOpen(true); }}
            onDelete={async () => {
              const res = await deleteTeacher(x.id);
              if (res.ok) router.refresh(); else alert(res.error);
            }}
          />
        )}
      />
      <EntitySheet
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        title={editing ? (t("admin.teachers.edit") as (c: number) => string)(editing.code) : s("admin.teachers.add")}
        description={s("admin.teachers.desc")}
        fields={FIELDS}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
      />
    </div>
  );
}
