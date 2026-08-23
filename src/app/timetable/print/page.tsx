import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getScheduleData } from "@/lib/schedule-data";
import { getScheduleConfig } from "@/lib/schedule-time-server";
import { buildTimeline } from "@/lib/schedule-time";
import { DAYS_PER_WEEK, DAY_NAMES_ID } from "@/lib/schedule-config";
import type { SlotView } from "@/lib/schedule-data";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PrintTimetablePage() {
  const [data, config] = await Promise.all([
    getScheduleData(),
    getScheduleConfig(),
  ]);
  const timeline = buildTimeline(config);
  const days = DAY_NAMES_ID.slice(0, DAYS_PER_WEEK);

  return (
    <>
      {/* Header — hidden when printing */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 print:hidden">
        <Link
          href="/timetable"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Jadwal
        </Link>
        <PrintButton label="Cetak / Simpan PDF" />
      </div>

      {/* Print content */}
      <div className="mx-auto max-w-7xl px-4 pb-8 print:max-w-none print:px-0">
        {data.classes.map((cls) => {
          const classSlots = data.slots.filter(
            (s) => s.classGroupId === cls.id,
          );
          return (
            <section
              key={cls.id}
              className="mb-8 break-inside-avoid print:mb-4"
            >
              <h2 className="mb-2 text-center text-lg font-bold print:text-base">
                JADWAL KBM — KELAS {cls.name}
              </h2>
              <table className="w-full border-collapse border border-gray-400 text-xs">
                <thead>
                  <tr>
                    <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-center dark:bg-gray-800">
                      JP
                    </th>
                    {days.map((day) => (
                      <th
                        key={day}
                        className="border border-gray-400 bg-gray-100 px-2 py-1 text-center dark:bg-gray-800"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((entry, ti) => {
                    if (entry.kind === "break") {
                      return (
                        <tr key={`brk-${ti}`}>
                          <td
                            colSpan={days.length + 1}
                            className="border border-gray-400 bg-amber-50 px-2 py-0.5 text-center text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          >
                            {entry.brk.label} ({entry.brk.start}–
                            {entry.brk.end})
                          </td>
                        </tr>
                      );
                    }
                    const p = entry.period;
                    return (
                      <tr key={`jp-${ti}`}>
                        <td className="border border-gray-400 bg-gray-50 px-2 py-1 text-center font-medium dark:bg-gray-900">
                          <div>JP {p.index + 1}</div>
                          {p.start && (
                            <div className="text-[9px] text-gray-500">
                              {p.start}–{p.end}
                            </div>
                          )}
                        </td>
                        {days.map((_, d) => {
                          const slot = classSlots.find(
                            (s) =>
                              s.dayOfWeek === d && s.periodIdx === p.index,
                          );
                          return (
                            <td
                              key={d}
                              className="border border-gray-400 px-1.5 py-1 text-center"
                            >
                              {slot ? (
                                <>
                                  <div className="font-medium">
                                    {slot.subjectName}
                                  </div>
                                  <div className="text-[10px] text-gray-600 dark:text-gray-400">
                                    / {slot.teacherCode}
                                    {slot.roomName
                                      ? ` · ${slot.roomName}`
                                      : ""}
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}

        {/* Teacher summary table */}
        <section className="break-inside-avoid">
          <h2 className="mb-2 text-center text-lg font-bold print:text-base">
            REKAP BEBAN MENGAJAR GURU
          </h2>
          <table className="w-full border-collapse border border-gray-400 text-xs">
            <thead>
              <tr>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-center dark:bg-gray-800">
                  Kode
                </th>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left dark:bg-gray-800">
                  Nama Guru
                </th>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-left dark:bg-gray-800">
                  Bidang
                </th>
                <th className="border border-gray-400 bg-gray-100 px-2 py-1 text-center dark:bg-gray-800">
                  JP/Minggu
                </th>
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((tt) => {
                const load = data.slots.filter(
                  (s) => s.teacherId === tt.id,
                ).length;
                return (
                  <tr key={tt.id}>
                    <td className="border border-gray-400 px-2 py-1 text-center font-mono">
                      {tt.code}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {tt.name}
                    </td>
                    <td className="border border-gray-400 px-2 py-1">
                      {tt.subjectName ?? ""}
                    </td>
                    <td className="border border-gray-400 px-2 py-1 text-center font-bold">
                      {load}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
