"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/page-header";
import { setPiket, removePiket } from "@/app/actions/piket";
import { useT } from "@/components/i18n/locale-provider";

type TeacherRow = {
  id: string;
  code: number;
  name: string;
  weeklyLoad: number;
  piketDays: number[];
};

export function PiketManager({ teachers }: { teachers: TeacherRow[] }) {
  const router = useRouter();
  const { t } = useT();
  const s = (k: string) => String(t(k));
  const days = t("common.days") as string[];
  const [assign, setAssign] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(teachers.map((x) => [x.id, [...x.piketDays]])),
  );

  const perDay = useMemo(() => {
    const counts = new Array(days.length).fill(0);
    for (const x of teachers) for (const d of assign[x.id] ?? []) counts[d]++;
    return counts;
  }, [assign, teachers, days.length]);

  async function toggle(teacherId: string, day: number, on: boolean) {
    const prev = assign[teacherId] ?? [];
    setAssign((st) => ({ ...st, [teacherId]: on ? [...prev, day] : prev.filter((x) => x !== day) }));
    const res = on ? await setPiket({ teacherId, dayOfWeek: day }) : await removePiket(teacherId, day);
    if (!res.ok) {
      alert(res.error);
      setAssign((st) => ({ ...st, [teacherId]: prev }));
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <AdminPageHeader title={s("admin.piket.title")} description={s("admin.piket.desc")} />
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left font-medium">{s("admin.piket.teacher")}</th>
              {days.map((d) => (
                <th key={d} className="p-2 text-center font-medium">{d}</th>
              ))}
              <th className="p-2 text-center font-medium">{s("admin.piket.load")}</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((x) => {
              const ds = assign[x.id] ?? [];
              const heavy = x.weeklyLoad > 30;
              return (
                <tr key={x.id} className="border-t">
                  <td className="p-2">
                    <span className="font-mono text-xs text-muted-foreground">{x.code}</span>{" "}
                    <span className="font-medium">{x.name}</span>
                    {heavy && <Badge variant="destructive" className="ml-2 px-1.5 text-[10px]">{s("admin.piket.capped")}</Badge>}
                  </td>
                  {days.map((_, d) => (
                    <td key={d} className="p-2 text-center">
                      <Checkbox checked={ds.includes(d)} onCheckedChange={(v) => toggle(x.id, d, Boolean(v))} />
                    </td>
                  ))}
                  <td className="p-2 text-center"><Badge variant="outline">{x.weeklyLoad} JP</Badge></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/50">
            <tr>
              <td className="p-2 font-medium">{s("admin.piket.assigned")}</td>
              {perDay.map((c, d) => (
                <td key={d} className="p-2 text-center font-semibold">{c}</td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
