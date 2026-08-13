import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  PERIODS_PER_DAY,
  DAYS_PER_WEEK,
  REQUIRED_WEEKLY_JP,
} from "@/lib/schedule-config";
import { getT } from "@/lib/i18n/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, BookOpen, DoorOpen, CalendarDays, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { t, ts } = await getT();
  const [teachers, classes, subjects, rooms, allocations, slots, piket] =
    await Promise.all([
      prisma.teacher.count(),
      prisma.classGroup.count(),
      prisma.subject.count(),
      prisma.room.count(),
      prisma.teachingAllocation.count(),
      prisma.scheduleSlot.count(),
      prisma.teacherPiket.count(),
    ]);

  const statKeys: { key: string; icon: typeof Users }[] = [
    { key: "home.stats.teachers", icon: Users },
    { key: "home.stats.classes", icon: School },
    { key: "home.stats.subjects", icon: BookOpen },
    { key: "home.stats.rooms", icon: DoorOpen },
    { key: "home.stats.allocations", icon: CalendarDays },
    { key: "home.stats.piket", icon: Zap },
  ];
  const stats = [teachers, classes, subjects, rooms, allocations, piket];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ScheduleCraft</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {ts("home.heroDesc")}
          </p>
        </div>
        <Link href="/schedule" className={buttonVariants({ size: "lg" })}>
          {ts("home.cta")}
        </Link>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statKeys.map((s, i) => (
          <Card key={s.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {ts(s.key)}
              </CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats[i]}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{ts("home.engineTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{ts("home.engineDesc")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{ts("home.statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {slots > 0
              ? (t("home.statusHas") as (n: number) => string)(slots)
              : ts("home.statusNone")}
            <p className="mt-2">
              {DAYS_PER_WEEK} × {PERIODS_PER_DAY} · {REQUIRED_WEEKLY_JP} JP/minggu.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
