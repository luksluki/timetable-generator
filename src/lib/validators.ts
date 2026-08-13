import { z } from "zod";
import { DAYS_PER_WEEK, PERIODS_PER_DAY } from "@/lib/schedule-config";

const dayIdx = z.number().int().min(0).max(DAYS_PER_WEEK - 1);
const periodIdx = z.number().int().min(0).max(PERIODS_PER_DAY - 1);

/** Normalise HTML form values: "" / null / undefined -> null, else Number. */
const numOrNull = (base: z.ZodNumber) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.union([base, z.null()]),
  );
const nullableDayIdx = numOrNull(dayIdx);
const nullablePeriodIdx = numOrNull(periodIdx);
const nullableNonNegInt = numOrNull(z.number().int().min(0));

export const teacherSchema = z.object({
  code: z.coerce.number().int().min(1),
  name: z.string().min(2, "Name is required"),
  subjectName: z.string().optional(),
  maxHoursPerDay: z.coerce.number().int().min(1).max(PERIODS_PER_DAY),
  blockedDays: z.array(dayIdx).default([]),
  forceStartDay: nullableDayIdx,
  forceStartPeriod: nullablePeriodIdx,
  isFixedSchedule: z.boolean().default(false),
});

export const classGroupSchema = z.object({
  name: z.string().min(1),
  grade: z.coerce.number().int().min(1).max(12),
});

export const subjectSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().min(1),
    totalJp: z.coerce.number().int().min(1).max(12),
    splitPattern: z.string().min(1),
    isHeavySubject: z.boolean().default(false),
    category: z.union([z.string(), z.null()]).optional(),
  })
  .refine(
    (d) =>
      d.splitPattern
        .split("+")
        .map((x) => parseInt(x.trim(), 10))
        .reduce((a, b) => a + (isNaN(b) ? 0 : b), 0) === d.totalJp,
    { message: "Split pattern must sum to total JP", path: ["splitPattern"] },
  );

export const roomSchema = z.object({
  name: z.string().min(1),
  isLab: z.boolean().default(false),
  roomType: z.union([z.string(), z.null()]).optional(),
  capacity: nullableNonNegInt.optional(),
  building: z.union([z.string(), z.null()]).optional(),
  floor: nullableNonNegInt.optional(),
});

export const allocationSchema = z.object({
  teacherId: z.string().min(1),
  classGroupId: z.string().min(1),
  subjectId: z.string().min(1),
  weeklyHours: z.coerce.number().int().min(1).max(PERIODS_PER_DAY),
});

export const piketSchema = z.object({
  teacherId: z.string().min(1),
  dayOfWeek: dayIdx,
});

export type TeacherValues = z.infer<typeof teacherSchema>;
export type ClassGroupValues = z.infer<typeof classGroupSchema>;
export type SubjectValues = z.infer<typeof subjectSchema>;
export type RoomValues = z.infer<typeof roomSchema>;
export type AllocationValues = z.infer<typeof allocationSchema>;
export type PiketValues = z.infer<typeof piketSchema>;

export const ROOM_TYPES = ["REGULAR", "IPA_LAB", "INFORMATIKA_LAB"] as const;
