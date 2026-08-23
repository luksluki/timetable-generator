"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ImportPayload = {
  teachers: Array<{ code: number; name: string; subjectName?: string; maxHoursPerDay?: number }>;
  classes: Array<{ name: string; grade: number }>;
  subjects: Array<{ code: string; name: string; totalJp: number; splitPattern: string; isHeavySubject?: boolean; category?: string }>;
  rooms: Array<{ name: string; isLab?: boolean; roomType?: string; capacity?: number; building?: string }>;
  allocations: Array<{ teacherCode: number; class: string; subjectCode: string; weeklyHours: number }>;
};

export async function importMasterData(payload: ImportPayload) {
  try {
    const logs: string[] = [];

    // We process sequentially rather than $transaction for UPSERTs to ensure 
    // unique lookups resolve properly without locking the entire DB, 
    // and to give granular error logs.

    // 1. Teachers
    logs.push("Processing Teachers...");
    for (const t of payload.teachers) {
      if (!t.code || !t.name) continue;
      await prisma.teacher.upsert({
        where: { code: Number(t.code) },
        update: {
          name: String(t.name),
          subjectName: t.subjectName ? String(t.subjectName) : null,
          maxHoursPerDay: t.maxHoursPerDay ? Number(t.maxHoursPerDay) : 6,
        },
        create: {
          code: Number(t.code),
          name: String(t.name),
          subjectName: t.subjectName ? String(t.subjectName) : null,
          maxHoursPerDay: t.maxHoursPerDay ? Number(t.maxHoursPerDay) : 6,
        },
      });
    }
    logs.push(`✓ Processed ${payload.teachers.length} teachers.`);

    // 2. Classes
    logs.push("Processing Classes...");
    for (const c of payload.classes) {
      if (!c.name || !c.grade) continue;
      await prisma.classGroup.upsert({
        where: { name: String(c.name) },
        update: { grade: Number(c.grade) },
        create: { name: String(c.name), grade: Number(c.grade) },
      });
    }
    logs.push(`✓ Processed ${payload.classes.length} classes.`);

    // 3. Subjects
    logs.push("Processing Subjects...");
    for (const s of payload.subjects) {
      if (!s.code || !s.name || !s.totalJp || !s.splitPattern) continue;
      await prisma.subject.upsert({
        where: { code: String(s.code) },
        update: {
          name: String(s.name),
          totalJp: Number(s.totalJp),
          splitPattern: String(s.splitPattern),
          isHeavySubject: Boolean(s.isHeavySubject),
          category: s.category ? String(s.category) : null,
        },
        create: {
          code: String(s.code),
          name: String(s.name),
          totalJp: Number(s.totalJp),
          splitPattern: String(s.splitPattern),
          isHeavySubject: Boolean(s.isHeavySubject),
          category: s.category ? String(s.category) : null,
        },
      });
    }
    logs.push(`✓ Processed ${payload.subjects.length} subjects.`);

    // 4. Rooms
    logs.push("Processing Rooms...");
    for (const r of payload.rooms) {
      if (!r.name) continue;
      await prisma.room.upsert({
        where: { name: String(r.name) },
        update: {
          isLab: Boolean(r.isLab),
          roomType: r.roomType ? String(r.roomType) : null,
          capacity: r.capacity ? Number(r.capacity) : null,
          building: r.building ? String(r.building) : null,
        },
        create: {
          name: String(r.name),
          isLab: Boolean(r.isLab),
          roomType: r.roomType ? String(r.roomType) : null,
          capacity: r.capacity ? Number(r.capacity) : null,
          building: r.building ? String(r.building) : null,
        },
      });
    }
    logs.push(`✓ Processed ${payload.rooms.length} rooms.`);

    // 5. Allocations
    logs.push("Processing Allocations...");
    
    // Fetch mapping dicts
    const dbTeachers = await prisma.teacher.findMany({ select: { id: true, code: true } });
    const dbClasses = await prisma.classGroup.findMany({ select: { id: true, name: true } });
    const dbSubjects = await prisma.subject.findMany({ select: { id: true, code: true } });

    const teacherMap = new Map(dbTeachers.map(t => [t.code, t.id]));
    const classMap = new Map(dbClasses.map(c => [c.name, c.id]));
    const subjectMap = new Map(dbSubjects.map(s => [s.code, s.id]));

    let allocCount = 0;
    for (const a of payload.allocations) {
      if (!a.teacherCode || !a.class || !a.subjectCode || !a.weeklyHours) continue;

      const teacherId = teacherMap.get(Number(a.teacherCode));
      const classGroupId = classMap.get(String(a.class));
      const subjectId = subjectMap.get(String(a.subjectCode));

      if (!teacherId || !classGroupId || !subjectId) {
        logs.push(`⚠️ Skipped allocation: Teacher ${a.teacherCode}, Class ${a.class}, Subject ${a.subjectCode} - Entity missing in database.`);
        continue;
      }

      await prisma.teachingAllocation.upsert({
        where: {
          teacherId_classGroupId_subjectId: {
            teacherId,
            classGroupId,
            subjectId,
          }
        },
        update: {
          weeklyHours: Number(a.weeklyHours),
        },
        create: {
          teacherId,
          classGroupId,
          subjectId,
          weeklyHours: Number(a.weeklyHours),
        },
      });
      allocCount++;
    }
    logs.push(`✓ Processed ${allocCount} allocations.`);

    revalidatePath("/admin");
    revalidatePath("/schedule");
    
    return { ok: true, logs };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
