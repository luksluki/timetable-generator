"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/locale-provider";

export type FieldDef =
  | { name: string; label: string; type: "text"; placeholder?: string; description?: string }
  | { name: string; label: string; type: "number"; placeholder?: string; description?: string }
  | { name: string; label: string; type: "nullable-number"; placeholder?: string; description?: string }
  | { name: string; label: string; type: "checkbox"; description?: string }
  | { name: string; label: string; type: "select"; options: { label: string; value: string }[]; description?: string }
  | { name: string; label: string; type: "nullable-select"; options: { label: string; value: string }[]; description?: string }
  | { name: string; label: string; type: "days"; description?: string };

type ActionResult = { ok: boolean; error?: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  defaultValues: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<ActionResult>;
};

export function EntitySheet({
  open,
  onOpenChange,
  title,
  description,
  fields,
  defaultValues,
  onSubmit,
}: Props) {
  const [pending, setPending] = useState(false);
  const { t } = useT();
  const form = useForm<Record<string, unknown>>({ defaultValues });

  function handleOpenChange(v: boolean) {
    if (v) form.reset(defaultValues);
    onOpenChange(v);
  }

  async function handleSubmit(values: Record<string, unknown>) {
    const cleaned = { ...values };
    for (const f of fields) {
      if (
        (f.type === "nullable-select" || f.type === "nullable-number") &&
        (cleaned[f.name] === "" || cleaned[f.name] === undefined)
      ) {
        cleaned[f.name] = null;
      }
    }
    setPending(true);
    try {
      const res = await onSubmit(cleaned);
      if (res.ok) {
        toast.success(String(t("common.saved")));
        onOpenChange(false);
      } else {
        toast.error(String(t("common.saveFailed")), { description: res.error });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 px-1">
          {fields.map((f) => (
            <FieldRenderer key={f.name} def={f} form={form} />
          ))}

          <SheetFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {String(t("common.cancel"))}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {String(t("common.save"))}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function FieldRenderer({
  def,
  form,
}: {
  def: FieldDef;
  form: ReturnType<typeof useForm<Record<string, unknown>>>;
}) {
  const { t } = useT();
  const value = form.watch(def.name);
  const description = "description" in def && def.description ? (
    <p className="text-xs text-muted-foreground">{def.description}</p>
  ) : null;

  const labelEl = <Label htmlFor={def.name}>{def.label}</Label>;

  if (def.type === "checkbox") {
    return (
      <div className="flex flex-row items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          {labelEl}
          {description}
        </div>
        <Checkbox
          id={def.name}
          checked={Boolean(value)}
          onCheckedChange={(v) => form.setValue(def.name, Boolean(v))}
        />
      </div>
    );
  }

  if (def.type === "days") {
    const current = (Array.isArray(value) ? value : []) as number[];
    return (
      <div className="space-y-1.5">
        {labelEl}
        {description}
        <div className="flex flex-wrap gap-3">
          {(t("common.days") as string[]).map((day, d) => (
            <label key={day} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={current.includes(d)}
                onCheckedChange={(v) =>
                  form.setValue(
                    def.name,
                    v ? [...current, d] : current.filter((x) => x !== d),
                  )
                }
              />
              {day}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (def.type === "select" || def.type === "nullable-select") {
    return (
      <div className="space-y-1.5">
        {labelEl}
        {description}
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => form.setValue(def.name, v)}
        >
          <SelectTrigger id={def.name}>
            <SelectValue placeholder={String(t("common.selectPlaceholder"))} />
          </SelectTrigger>
          <SelectContent>
            {def.type === "nullable-select" && <SelectItem value="">{String(t("common.none"))}</SelectItem>}
            {def.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // text / number / nullable-number
  return (
    <div className="space-y-1.5">
      {labelEl}
      {description}
      <Input
        id={def.name}
        type={def.type === "text" ? "text" : "number"}
        placeholder={"placeholder" in def ? def.placeholder : undefined}
        {...form.register(def.name)}
      />
    </div>
  );
}
