"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";

export function RowActions({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title={String(t("common.edit"))} disabled={disabled}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => {
          if (confirm(String(t("common.confirmDelete")))) onDelete();
        }}
        title={String(t("common.delete"))}
        disabled={disabled}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
