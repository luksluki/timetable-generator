"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EntitySheet, type FieldDef } from "@/components/admin/entity-sheet";
import { RowActions } from "@/components/admin/row-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { upsertClassGroup, deleteClassGroup } from "@/app/actions/classes";
import { upsertSubject, deleteSubject } from "@/app/actions/subjects";
import { useT } from "@/components/i18n/locale-provider";

type ClassRow = { id: string; name: string; grade: number; totalJp: number };
type SubjectRow = {
  id: string; name: string; code: string; totalJp: number;
  splitPattern: string; isHeavySubject: boolean; category: string | null;
};

export function ClassesSubjectsManager({
  classes,
  subjects,
  requiredWeeklyJp,
}: {
  classes: ClassRow[];
  subjects: SubjectRow[];
  requiredWeeklyJp: number;
}) {
  const router = useRouter();
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const [cOpen, setCOpen] = useState(false);
  const [cEdit, setCEdit] = useState<ClassRow | null>(null);
  const [sOpen, setSOpen] = useState(false);
  const [sEdit, setSEdit] = useState<SubjectRow | null>(null);

  const CLASS_FIELDS: FieldDef[] = [
    { name: "name", label: s("admin.classes.className"), type: "text", placeholder: s("admin.classes.classPlaceholder") },
    { name: "grade", label: s("admin.classes.grade"), type: "number" },
  ];
  const SUBJECT_FIELDS: FieldDef[] = [
    { name: "name", label: s("admin.classes.subjectName"), type: "text" },
    { name: "code", label: s("admin.classes.code"), type: "text" },
    { name: "totalJp", label: s("admin.classes.weeklyJp"), type: "number" },
    { name: "splitPattern", label: s("admin.classes.splitPattern"), type: "text", placeholder: "3+2", description: s("admin.classes.splitDesc") },
    { name: "isHeavySubject", label: s("admin.classes.heavyLabel"), type: "checkbox", description: s("admin.classes.heavyDesc") },
    {
      name: "category", label: s("admin.classes.category"), type: "nullable-select",
      options: [{ label: "IPA Lab", value: "IPA_LAB" }, { label: "Informatika Lab", value: "INFORMATIKA_LAB" }],
      description: s("admin.classes.categoryDesc"),
    },
  ];

  const cDefaults = cEdit ? { name: cEdit.name, grade: cEdit.grade } : { name: "", grade: 7 };
  const sDefaults = sEdit
    ? { name: sEdit.name, code: sEdit.code, totalJp: sEdit.totalJp, splitPattern: sEdit.splitPattern, isHeavySubject: sEdit.isHeavySubject, category: sEdit.category ?? "" }
    : { name: "", code: "", totalJp: 3, splitPattern: "3", isHeavySubject: false, category: "" };

  const classColumns: Column<ClassRow>[] = [
    { key: "name", header: s("admin.classes.className"), sortValue: (x) => x.name, render: (x) => <span className="font-medium">{x.name}</span> },
    { key: "grade", header: s("admin.classes.grade"), sortValue: (x) => x.grade },
    {
      key: "jp", header: s("admin.classes.jp"), sortValue: (x) => x.totalJp,
      render: (x) => (
        <Badge variant={x.totalJp === requiredWeeklyJp ? "secondary" : "destructive"}>
          {x.totalJp} / {requiredWeeklyJp}
        </Badge>
      ),
    },
  ];
  const subjectColumns: Column<SubjectRow>[] = [
    { key: "name", header: s("admin.classes.subjectName"), sortValue: (x) => x.name, render: (x) => <span className="font-medium">{x.name}</span> },
    { key: "code", header: s("admin.classes.code"), sortValue: (x) => x.code, render: (x) => <span className="font-mono">{x.code}</span> },
    { key: "jp", header: s("admin.classes.weeklyJp"), sortValue: (x) => x.totalJp },
    { key: "split", header: s("admin.classes.split"), sortValue: (x) => x.splitPattern, render: (x) => <code className="text-xs">{x.splitPattern}</code> },
    { key: "heavy", header: s("admin.classes.heavy"), render: (x) => (x.isHeavySubject ? <Badge variant="secondary">{s("common.yes")}</Badge> : s("common.dash")) },
    { key: "cat", header: s("admin.classes.lab"), render: (x) => (x.category ? <Badge variant="outline">{x.category}</Badge> : s("common.dash")) },
  ];

  return (
    <div>
      <AdminPageHeader title={s("admin.classes.title")} description={s("admin.classes.desc")} />
      <Tabs defaultValue="classes">
        <TabsList>
          <TabsTrigger value="classes">{s("admin.classes.tabClasses")}</TabsTrigger>
          <TabsTrigger value="subjects">{s("admin.classes.tabSubjects")}</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setCEdit(null); setCOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> {s("admin.classes.addClass")}
            </Button>
          </div>
          <DataTable
            columns={classColumns}
            rows={classes}
            getRowId={(x) => x.id}
            searchKeys={(x) => `${x.name} ${x.grade}`}
            actions={(x) => (
              <RowActions
                onEdit={() => { setCEdit(x); setCOpen(true); }}
                onDelete={async () => { const r = await deleteClassGroup(x.id); if (r.ok) router.refresh(); else alert(r.error); }}
              />
            )}
          />
          <EntitySheet
            key={cEdit?.id ?? "new-class"}
            open={cOpen} onOpenChange={setCOpen}
            title={cEdit ? (t("admin.classes.editClass") as (n: string) => string)(cEdit.name) : s("admin.classes.addClass")}
            fields={CLASS_FIELDS} defaultValues={cDefaults}
            onSubmit={async (v) => { const r = await upsertClassGroup(v, cEdit?.id); if (r.ok) router.refresh(); return r; }}
          />
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setSEdit(null); setSOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> {s("admin.classes.addSubject")}
            </Button>
          </div>
          <DataTable
            columns={subjectColumns}
            rows={subjects}
            getRowId={(x) => x.id}
            searchKeys={(x) => `${x.name} ${x.code}`}
            actions={(x) => (
              <RowActions
                onEdit={() => { setSEdit(x); setSOpen(true); }}
                onDelete={async () => { const r = await deleteSubject(x.id); if (r.ok) router.refresh(); else alert(r.error); }}
              />
            )}
          />
          <EntitySheet
            key={sEdit?.id ?? "new-subject"}
            open={sOpen} onOpenChange={setSOpen}
            title={sEdit ? (t("admin.classes.editSubject") as (n: string) => string)(sEdit.name) : s("admin.classes.addSubject")}
            fields={SUBJECT_FIELDS} defaultValues={sDefaults}
            onSubmit={async (v) => { const r = await upsertSubject(v, sEdit?.id); if (r.ok) router.refresh(); return r; }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
