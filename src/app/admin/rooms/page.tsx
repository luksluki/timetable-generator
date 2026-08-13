import { prisma } from "@/lib/prisma";
import { RoomsManager } from "@/components/admin/modules/rooms-manager";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const rooms = await prisma.room.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { schedules: true } } },
  });
  const rows = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    isLab: r.isLab,
    roomType: r.roomType,
    capacity: r.capacity,
    building: r.building,
    floor: r.floor,
    used: r._count.schedules,
  }));
  return <RoomsManager rooms={rows} />;
}
