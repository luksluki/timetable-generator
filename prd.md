# Product Requirements Document (PRD)

# ScheduleCraft
### School Automated Timetable Generator

---

# 1. Executive Summary

| Item | Description |
|------|-------------|
| **Product Name** | ScheduleCraft |
| **Target User** | Deputy Head of Curriculum (Wakil Kepala Sekolah Bidang Kurikulum) |
| **Primary Goal** | Reduce school timetable creation time from **weeks to minutes** while enforcing complex scheduling rules and optimizing timetable quality. |

The system automatically generates school timetables while enforcing:

- Consecutive multi-hour subject blocks
- Teacher duty shift (piket) limitations
- Teacher availability constraints
- Subject split patterns
- Room constraints
- Optimization of soft scheduling rules

---

# 2. Problem Statement

Creating school timetables manually is extremely time-consuming and error-prone.

The curriculum team must balance:

- 40+ teachers
- 30+ class groups (Rombel)
- Shared laboratories
- Teacher availability
- Weekly subject allocations
- Government curriculum requirements

Spreadsheet-based scheduling often results in:

- Teacher double booking
- Class conflicts
- Incorrect subject allocations
- Invalid lesson block splitting
- Difficult schedule revisions

Even a small modification may require recalculating a large portion of the timetable.

---

# 3. User Persona

## Primary Persona

### Deputy Head of Curriculum
(Wakil Kepala Sekolah Bidang Kurikulum)

### Responsibilities

- Create semester timetable
- Assign teachers
- Manage room utilization
- Balance teacher workload
- Ensure institutional rules are followed

### Pain Points

- Manual scheduling takes days or weeks
- Frequent scheduling conflicts
- Complex school provisions are difficult to enforce
- Schedule revisions are expensive in time

---

# 4. Technology Stack

| Layer | Technology |
|--------|------------|
| Framework | Next.js 15+ (App Router) |
| Language | TypeScript (Strict Mode) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Icons | Lucide |
| Database | PostgreSQL |
| ORM | Prisma |
| Drag & Drop | dnd-kit (preferred) / @hello-pangea/dnd |
| Optimization Engine | Python 3.11 + Google OR-Tools (CP-SAT) |
| Communication | child_process from Next.js |
| Excel Export | xlsx |
| PDF Export | @react-pdf/renderer |

---

# 5. Functional Requirements

## Module 1 — Master Data Management

### Academic Calendar & Time Slots (P0)

Configure:

- School days (Monday–Friday)
- 8 periods/day
- Start/end times
- Fixed break slots
    - Assembly
    - Recess
    - Friday Prayer

---

### Teacher Directory (P0)

Each teacher contains:

- Name
- Teacher code
- Maximum teaching hours/day
- Weekly teaching load
- Availability
- Unavailability
- Duty shift (Piket)

Example:

| Code | Teacher |
|------|---------|
| 3 | Informatika |
| 17 | Hilmy Salman Abdillah |
| 18 | Amanda Oktriana |

---

### Class Groups (Rombel) (P0)

Manage:

- Grade
- Class name
- Weekly lesson allocation

Example:

- 7A
- 7B
- 8A
- 8D
- 9A

Each class requires exactly:

**42 JP/week**

---

### Subject Split Allocation Engine (P0)

Automatically enforce lesson split rules.

| Weekly JP | Split Pattern |
|-----------|--------------|
| 6 | 3 + 3 |
| 5 | 3 + 2 |
| 4 | 2 + 2 |
| 3 | 3 |
| 2 | 2 |
| 1 | 1 |

Examples

| Subject | Weekly JP | Pattern |
|----------|-----------|---------|
| Bahasa Indonesia | 6 | 3+3 |
| Matematika | 5 | 3+2 |
| IPA | 5 | 3+2 |
| Bahasa Inggris | 4 | 2+2 |
| IPS | 4 | 2+2 |
| PABP | 3 | 3 |
| Pancasila | 3 | 3 |
| PJOK | 3 | 3 |
| Informatika | 3 | 3 |
| Seni Budaya | 3 | 3 |
| Bahasa Sunda | 2 | 2 |
| BK | 1 | 1 |

---

### Teacher Duty Shift (Piket) (P0)

Import daily duty roster.

Rule:

If a teacher has:

- Weekly load > 30 JP
- Assigned to duty shift on a specific day

Then:

They may teach **at most one class** on that day.

---

### Special Teacher Rules (P0)

#### Hilmy Salman Abdillah

- Code: 17
- Subject: Bahasa Sunda

Rules:

- Can teach only:
    - Monday
    - Wednesday
    - Thursday
- On Thursday:
    - First lesson must begin at Period 1

---

#### Amanda Oktriana

- Code: 18
- Subject: IPS

Rules:

- Schedule is fixed
- Locked to predefined timetable slots

---

# Module 2 — Constraint Engine

## Hard Constraints (Always Enforced)

- Multi-hour lessons must be consecutive
- No teacher double booking
- No class double booking
- No room double booking
- Weekly subject allocation must be exact
- Specialized rooms only for matching subjects
- Teacher duty shift limits
- Teacher availability constraints
- Fixed schedules remain locked

---

## Soft Constraints

Each soft constraint has configurable weight (1–10).

### Teacher Gap Reduction

Minimize idle periods between first and last lesson.

---

### Heavy Subject Preference

Prefer:

- Mathematics
- Science

during:

Periods 1–3

---

### Consecutive Teaching Limit

Avoid assigning more than:

**3 consecutive teaching periods**

without a break.

---

# Module 3 — Solver

## One-click Timetable Generation

Features:

- Start optimization
- Adjustable timeout
    - 15 seconds
    - 30 seconds
    - 60 seconds

---

## Solver Progress

Display:

- Current objective score
- Constraint satisfaction
- Solving progress

---

## Infeasibility Detection

If no valid solution exists:

Display:

- Failed constraints
- Conflict explanation
- Suggestions for resolution

---

# Module 4 — Interactive Timetable

## Grid Display

Cell format:

```
Subject / Teacher Code
```

Example:

```
Informatika / 3
```

---

## Multiple Views

Switch between:

- Class timetable
- Teacher timetable
- Room utilization

---

## Drag & Drop Editing

Allow manual movement with live validation.

Conflict colors:

| Color | Meaning |
|--------|----------|
| 🔴 Red | Hard constraint violation |
| 🟡 Yellow | Soft constraint penalty |

---

# Module 5 — Export

## Excel Export

Generate:

```
Jadwal KBM Semester Ganjil - TP 2026-2027 (FIX).xlsx
```

Requirements:

- Preserve timetable layout
- Preserve break columns
- Ready for school administration

---

## PDF Export

Generate printable timetables for:

- Teachers
- Classrooms
- Bulletin boards

---

# 6. Prisma Database Schema Blueprint

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Teacher {
  id               String                  @id @default(uuid())
  code             Int                     @unique
  name             String
  maxHoursPerDay   Int                     @default(6)

  unavailabilities TeacherUnavailability[]
  piketDuties      TeacherPiket[]
  allocations      TeachingAllocation[]
}

model TeacherUnavailability {
  id        String  @id @default(uuid())
  teacherId String
  dayOfWeek Int
  periodIdx Int

  teacher Teacher @relation(fields: [teacherId], references: [id], onDelete: Cascade)
}

model TeacherPiket {
  id        String @id @default(uuid())
  teacherId String
  dayOfWeek Int

  teacher Teacher @relation(fields: [teacherId], references: [id], onDelete: Cascade)
}

model ClassGroup {
  id          String @id @default(uuid())
  name        String
  grade       Int

  allocations TeachingAllocation[]
  schedules   ScheduleSlot[]
}

model Subject {
  id             String @id @default(uuid())
  name           String
  code           String @unique
  totalJp        Int
  splitPattern   String
  isHeavySubject Boolean @default(false)

  allocations TeachingAllocation[]
}

model Room {
  id    String @id @default(uuid())
  name  String
  isLab Boolean @default(false)

  schedules ScheduleSlot[]
}

model TeachingAllocation {
  id           String @id @default(uuid())
  teacherId    String
  classGroupId String
  subjectId    String
  weeklyHours  Int

  teacher    Teacher    @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  classGroup ClassGroup @relation(fields: [classGroupId], references: [id], onDelete: Cascade)
  subject    Subject    @relation(fields: [subjectId], references: [id], onDelete: Cascade)

  schedules ScheduleSlot[]
}

model ScheduleSlot {
  id           String @id @default(uuid())

  allocationId String
  roomId       String?
  classGroupId String

  dayOfWeek Int
  periodIdx Int

  allocation TeachingAllocation @relation(fields: [allocationId], references: [id], onDelete: Cascade)
  room       Room?              @relation(fields: [roomId], references: [id], onDelete: SetNull)
  classGroup ClassGroup         @relation(fields: [classGroupId], references: [id], onDelete: Cascade)

  @@unique([classGroupId, dayOfWeek, periodIdx])
}
```

---

# 7. Success Metrics

The product will be considered successful if it achieves:

| Metric | Target |
|---------|--------|
| Timetable generation time | < 60 seconds |
| Hard constraint violations | 0 |
| Manual editing required | < 5% of schedule |
| Teacher double booking | 0 |
| Class conflicts | 0 |
| User satisfaction | > 90% |

---

# 8. Future Enhancements

- Multi-campus scheduling
- AI-assisted manual schedule suggestions
- Teacher preference learning
- Student elective scheduling
- Mobile timetable application
- Real-time substitution management
- Calendar synchronization (Google Calendar / Outlook)
- Genetic Algorithm and Simulated Annealing solver comparison
- What-if scenario simulation