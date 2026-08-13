import { prisma } from "@/lib/prisma";

/** A single placed lesson (one period), enriched for the UI. */
export type SlotView = {
  id: string;
  allocationId: string;
  classGroupId: string;
  classGroupName: string;
  teacherId: string;
  teacherCode: number;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  isHeavy: boolean;
  roomId: string | null;
  roomName: string | null;
  dayOfWeek: number;
  periodIdx: number;
  isLocked: boolean;
  blockTag: string | null;
};

export type TeacherLite = {
  id: string;
  code: number;
  name: string;
  subjectName: string | null;
};
export type RoomLite = {
  id: string;
  name: string;
  isLab: boolean;
  roomType: string | null;
};
export type ClassLite = { id: string; name: string; grade: number };
export type SubjectLite = {
  id: string;
  name: string;
  code: string;
  totalJp: number;
  isHeavy: boolean;
};

export type ScheduleData = {
  slots: SlotView[];
  classes: ClassLite[];
  teachers: TeacherLite[];
  rooms: RoomLite[];
  subjects: SubjectLite[];
};

/** Fetch the full timetable plus lookup maps for the interactive grid. */
export async function getScheduleData(): Promise<ScheduleData> {
  const [slots, classes, teachers, rooms, subjects] = await Promise.all([
    prisma.scheduleSlot.findMany({
      include: {
        allocation: {
          include: { teacher: true, subject: true, classGroup: true },
        },
        room: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { periodIdx: "asc" }],
    }),
    prisma.classGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.teacher.findMany({ orderBy: { code: "asc" } }),
    prisma.room.findMany({ orderBy: { name: "asc" } }),
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    slots: slots.map((s) => ({
      id: s.id,
      allocationId: s.allocationId,
      classGroupId: s.classGroupId,
      classGroupName: s.allocation.classGroup.name,
      teacherId: s.allocation.teacherId,
      teacherCode: s.allocation.teacher.code,
      teacherName: s.allocation.teacher.name,
      subjectId: s.allocation.subjectId,
      subjectName: s.allocation.subject.name,
      subjectCode: s.allocation.subject.code,
      isHeavy: s.allocation.subject.isHeavySubject,
      roomId: s.roomId,
      roomName: s.room?.name ?? null,
      dayOfWeek: s.dayOfWeek,
      periodIdx: s.periodIdx,
      isLocked: s.isLocked,
      blockTag: s.blockTag,
    })),
    classes: classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade })),
    teachers: teachers.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      subjectName: t.subjectName,
    })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      isLab: r.isLab,
      roomType: r.roomType,
    })),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      totalJp: s.totalJp,
      isHeavy: s.isHeavySubject,
    })),
  };
}
