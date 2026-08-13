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
import { upsertRoom, deleteRoom } from "@/app/actions/rooms";
import { ROOM_TYPES } from "@/lib/validators";
import { useT } from "@/components/i18n/locale-provider";

type RoomRow = {
  id: string; name: string; isLab: boolean; roomType: string | null;
  capacity: number | null; building: string | null; floor: number | null; used: number;
};

export function RoomsManager({ rooms }: { rooms: RoomRow[] }) {
  const router = useRouter();
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);

  const CREATE_DEFAULTS = { name: "", isLab: false, roomType: "", capacity: "", building: "", floor: "" };
  const defaultValues = editing
    ? { name: editing.name, isLab: editing.isLab, roomType: editing.roomType ?? "", capacity: editing.capacity ?? "", building: editing.building ?? "", floor: editing.floor ?? "" }
    : CREATE_DEFAULTS;

  const FIELDS: FieldDef[] = [
    { name: "name", label: s("admin.rooms.roomName"), type: "text", placeholder: "Lab IPA" },
    { name: "isLab", label: s("admin.rooms.isLab"), type: "checkbox" },
    { name: "roomType", label: s("admin.rooms.roomType"), type: "nullable-select", options: ROOM_TYPES.map((x) => ({ label: x, value: x })) },
    { name: "capacity", label: s("admin.rooms.capacity"), type: "nullable-number" },
    { name: "building", label: s("admin.rooms.building"), type: "text" },
    { name: "floor", label: s("admin.rooms.floor"), type: "nullable-number" },
  ];

  const columns: Column<RoomRow>[] = [
    { key: "name", header: s("admin.rooms.room"), sortValue: (x) => x.name, render: (x) => <span className="font-medium">{x.name}</span> },
    { key: "lab", header: s("admin.rooms.type"), render: (x) => (x.isLab ? <Badge variant="secondary">Lab</Badge> : <span className="text-muted-foreground">{s("admin.rooms.classroom")}</span>) },
    { key: "roomType", header: s("admin.rooms.roomType"), sortValue: (x) => x.roomType ?? "", render: (x) => x.roomType ?? s("common.dash") },
    { key: "capacity", header: s("admin.rooms.capacity"), sortValue: (x) => x.capacity ?? 0, render: (x) => x.capacity ?? s("common.dash") },
    { key: "used", header: s("admin.rooms.booked"), sortValue: (x) => x.used, render: (x) => <Badge variant={x.used > 0 ? "outline" : "secondary"}>{x.used}</Badge> },
  ];

  return (
    <div>
      <AdminPageHeader
        title={s("admin.rooms.title")}
        description={s("admin.rooms.desc")}
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> {s("admin.rooms.add")}</Button>}
      />
      <DataTable
        columns={columns}
        rows={rooms}
        getRowId={(x) => x.id}
        searchKeys={(x) => `${x.name} ${x.roomType ?? ""}`}
        actions={(x) => (
          <RowActions
            onEdit={() => { setEditing(x); setOpen(true); }}
            onDelete={async () => { const r = await deleteRoom(x.id); if (r.ok) router.refresh(); else alert(r.error); }}
          />
        )}
      />
      <EntitySheet
        key={editing?.id ?? "new"}
        open={open} onOpenChange={setOpen}
        title={editing ? (t("admin.rooms.edit") as (n: string) => string)(editing.name) : s("admin.rooms.add")}
        fields={FIELDS} defaultValues={defaultValues}
        onSubmit={async (v) => { const r = await upsertRoom(v, editing?.id); if (r.ok) router.refresh(); return r; }}
      />
    </div>
  );
}
