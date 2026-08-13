import { prisma } from "@/lib/prisma";
import { PiketManager } from "@/components/admin/modules/piket-manager";

export const dynamic = "force-dynamic";

export default async function PiketPage() {
  const teachers = await prisma.teacher.findMany({
    orderBy: { code: "asc" },
    include: {
      piketDuties: true,
      allocations: { select: { weeklyHours: true } },
    },
  });
  const rows = teachers.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    weeklyLoad: t.allocations.reduce((s, a) => s + a.weeklyHours, 0),
    piketDays: t.piketDuties.map((p) => p.dayOfWeek),
  }));
  return <PiketManager teachers={rows} />;
}
