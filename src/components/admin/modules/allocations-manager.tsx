"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EntitySheet, type FieldDef } from "@/components/admin/entity-sheet";
import { RowActions } from "@/components/admin/row-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { upsertAllocation, deleteAllocation } from "@/app/actions/allocations";
import { useT } from "@/components/i18n/locale-provider";

type AllocRow = {
  id: string; teacherId: string; classGroupId: string; subjectId: string; weeklyHours: number;
  teacherCode: number; teacherName: string; className: string; subjectName: string;
};

type Options = {
  teachers: { label: string; value: string }[];
  classes: { label: string; value: string }[];
  subjects: { label: string; value: string }[];
};

export function AllocationsManager({
  allocations,
  options,
}: {
  allocations: AllocRow[];
  options: Options;
}) {
  const router = useRouter();
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AllocRow | null>(null);

  const CREATE_DEFAULTS = { teacherId: "", classGroupId: "", subjectId: "", weeklyHours: 3 };
  const defaultValues = editing
    ? { teacherId: editing.teacherId, classGroupId: editing.classGroupId, subjectId: editing.subjectId, weeklyHours: editing.weeklyHours }
    : CREATE_DEFAULTS;

  const fields: FieldDef[] = [
    { name: "teacherId", label: s("admin.allocations.teacher"), type: "select", options: options.teachers },
    { name: "classGroupId", label: s("admin.allocations.class"), type: "select", options: options.classes },
    { name: "subjectId", label: s("admin.allocations.subject"), type: "select", options: options.subjects },
    { name: "weeklyHours", label: s("admin.allocations.weeklyHours"), type: "number" },
  ];

  const columns: Column<AllocRow>[] = [
    { key: "class", header: s("admin.allocations.class"), sortValue: (x) => x.className, render: (x) => <span className="font-medium">{x.className}</span> },
    { key: "subject", header: s("admin.allocations.subject"), sortValue: (x) => x.subjectName },
    { key: "teacher", header: s("admin.allocations.teacher"), sortValue: (x) => x.teacherName, render: (x) => `${x.teacherCode} · ${x.teacherName}` },
    { key: "jp", header: s("admin.allocations.jpwk"), sortValue: (x) => x.weeklyHours },
  ];

  return (
    <div>
      <AdminPageHeader
        title={s("admin.allocations.title")}
        description={s("admin.allocations.desc")}
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> {s("admin.allocations.add")}</Button>}
      />
      <DataTable
        columns={columns}
        rows={allocations}
        getRowId={(x) => x.id}
        searchKeys={(x) => `${x.teacherCode} ${x.teacherName} ${x.className} ${x.subjectName}`}
        actions={(x) => (
          <RowActions
            onEdit={() => { setEditing(x); setOpen(true); }}
            onDelete={async () => { const r = await deleteAllocation(x.id); if (r.ok) router.refresh(); else alert(r.error); }}
          />
        )}
      />
      <EntitySheet
        key={editing?.id ?? "new"}
        open={open} onOpenChange={setOpen}
        title={editing ? s("common.edit") : s("admin.allocations.add")}
        fields={fields} defaultValues={defaultValues}
        onSubmit={async (v) => { const r = await upsertAllocation(v, editing?.id); if (r.ok) router.refresh(); return r; }}
      />
    </div>
  );
}
