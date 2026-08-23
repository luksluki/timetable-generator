"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPageHeader } from "@/components/admin/page-header";
import { useT } from "@/components/i18n/locale-provider";
import { importMasterData, type ImportPayload } from "@/app/actions/import";

export function ImportManager() {
  const { t } = useT();
  const s = (k: string) => String(t(k));
  
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function handleDownloadTemplate() {
    const wb = XLSX.utils.book_new();

    // Teachers
    const wsTeachers = XLSX.utils.json_to_sheet([
      { code: 1, name: "Pak Guru", subjectName: "Matematika", maxHoursPerDay: 6 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsTeachers, "Teachers");

    // Classes
    const wsClasses = XLSX.utils.json_to_sheet([
      { name: "7A", grade: 7 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsClasses, "Classes");

    // Subjects
    const wsSubjects = XLSX.utils.json_to_sheet([
      { code: "MAT", name: "Matematika", totalJp: 4, splitPattern: "2+2", isHeavySubject: true, category: "" }
    ]);
    XLSX.utils.book_append_sheet(wb, wsSubjects, "Subjects");

    // Rooms
    const wsRooms = XLSX.utils.json_to_sheet([
      { name: "Lab Komputer 1", isLab: true, roomType: "INFORMATIKA_LAB", capacity: 40, building: "A" }
    ]);
    XLSX.utils.book_append_sheet(wb, wsRooms, "Rooms");

    // Allocations
    const wsAllocations = XLSX.utils.json_to_sheet([
      { teacherCode: 1, class: "7A", subjectCode: "MAT", weeklyHours: 4 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsAllocations, "Allocations");

    XLSX.writeFile(wb, "schedulecraft-template.xlsx");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setLogs([]);
    setStatus("idle");

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });

      const getSheetData = (name: string) => {
        const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
        if (!sheetName) return [];
        return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      };

      const payload: ImportPayload = {
        teachers: getSheetData("teachers") as ImportPayload["teachers"],
        classes: getSheetData("classes") as ImportPayload["classes"],
        subjects: getSheetData("subjects") as ImportPayload["subjects"],
        rooms: getSheetData("rooms") as ImportPayload["rooms"],
        allocations: getSheetData("allocations") as ImportPayload["allocations"],
      };

      const res = await importMasterData(payload);
      
      if (res.ok) {
        setStatus("success");
        setLogs(res.logs || []);
        toast.success(s("import.success"));
      } else {
        setStatus("error");
        setLogs([res.message || "Unknown error"]);
        toast.error(s("import.error"));
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setLogs([(err as Error).message]);
      toast.error(s("import.error"));
    } finally {
      setImporting(false);
      // Reset input
      e.target.value = "";
    }
  }

  return (
    <div>
      <AdminPageHeader
        title={s("import.title")}
        description={s("import.description")}
        action={
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> {s("import.downloadTemplate")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        {/* Upload Zone */}
        <div className="rounded-md border p-6 flex flex-col items-center justify-center space-y-4 text-center bg-card">
          <div className="rounded-full bg-primary/10 p-3">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">{s("import.uploadTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {s("import.uploadDesc")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 w-full max-w-sm">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={handleFileUpload}
              className="cursor-pointer file:cursor-pointer file:border-0 file:bg-primary file:text-primary-foreground file:hover:bg-primary/90 file:h-full file:px-4 file:mr-4 file:-ml-3 file:-my-3 h-10"
            />
            {importing && (
              <div className="flex items-center text-sm text-muted-foreground mt-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {s("import.importing")}
              </div>
            )}
          </div>
        </div>

        {/* Logs / Results */}
        <div className="rounded-md border overflow-hidden flex flex-col h-full min-h-[300px]">
          <div className="border-b bg-muted/30 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center">
              {status === "success" && <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />}
              {status === "error" && <AlertCircle className="mr-2 h-4 w-4 text-red-500" />}
              {s("import.logTitle")}
            </h3>
          </div>
          <div className="p-4 bg-black text-green-400 font-mono text-xs overflow-y-auto flex-1">
            {logs.length === 0 ? (
              <span className="text-muted-foreground opacity-50">No logs yet...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1 leading-relaxed">
                  {log.startsWith("⚠️") ? (
                    <span className="text-yellow-400">{log}</span>
                  ) : log.startsWith("✓") ? (
                    <span className="text-green-300 font-bold">{log}</span>
                  ) : (
                    <span className="text-white">{log}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
