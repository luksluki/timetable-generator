import * as XLSX from "xlsx";
import type { ScheduleData, SlotView } from "@/lib/schedule-data";
import {
  DAYS_PER_WEEK,
  PERIODS_PER_DAY,
  DAY_NAMES_ID,
} from "@/lib/schedule-config";
import type { ScheduleConfigData } from "@/lib/schedule-time";

function classMatrix(slots: SlotView[]) {
  const m: (string | null)[][] = Array.from({ length: PERIODS_PER_DAY }, () =>
    Array.from({ length: DAYS_PER_WEEK }, () => null),
  );
  for (const s of slots) {
    if (s.periodIdx < 0 || s.periodIdx >= PERIODS_PER_DAY) continue;
    if (s.dayOfWeek < 0 || s.dayOfWeek >= DAYS_PER_WEEK) continue;
    m[s.periodIdx][s.dayOfWeek] = `${s.subjectName} / ${s.teacherCode}`;
  }
  return m;
}

function buildSheet(titleRows: string[], header: string[], rows: (string | number | null)[][]) {
  const aoa: (string | number | null)[][] = [];
  aoa.push([titleRows[0]]);
  if (titleRows[1]) aoa.push([titleRows[1]]);
  aoa.push([]);
  aoa.push(header);
  for (const r of rows) aoa.push(r);
  return XLSX.utils.aoa_to_sheet(aoa);
}

/** Build and download the Excel workbook matching the school's matrix format. */
export function exportScheduleToExcel(data: ScheduleData, config: ScheduleConfigData) {
  const wb = XLSX.utils.book_new();
  const header = ["JP", ...DAY_NAMES_ID];
  const semesterStr = config.semester.toUpperCase();
  const filename = `Jadwal KBM Semester ${config.semester} - TP ${config.academicYear} (FIX).xlsx`;

  // One sheet per class group
  for (const cls of data.classes) {
    const slots = data.slots.filter((s) => s.classGroupId === cls.id);
    const rows = classMatrix(slots).map((r, i) => [i + 1, ...r]);
    const ws = buildSheet(
      [`JADWAL KBM SEMESTER ${semesterStr}`, `TP ${config.academicYear} — KELAS ${cls.name}`],
      header,
      rows,
    );
    ws["!cols"] = [{ wch: 6 }, ...DAY_NAMES_ID.map(() => ({ wch: 22 }))];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(cls.name));
  }

  // Teacher overview sheet
  const teacherRows = data.teachers.map((t) => {
    const count = data.slots.filter((s) => s.teacherId === t.id).length;
    return [t.code, t.name, t.subjectName ?? "", count];
  });
  const tws = buildSheet(
    ["REKAP BEBAN MENGAJAR GURU", ""],
    ["Kode", "Nama", "Bidang", "JP/Minggu"],
    teacherRows as (string | number)[][],
  );
  tws["!cols"] = [{ wch: 8 }, { wch: 36 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, tws, "Rekap Guru");

  XLSX.writeFile(wb, filename);
}

const FORBIDDEN = /[\\/?*[\]:]/g;
function safeSheetName(name: string): string {
  return name.replace(FORBIDDEN, "_").slice(0, 31);
}
