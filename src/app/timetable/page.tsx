import { getScheduleData } from "@/lib/schedule-data";
import { getScheduleConfig } from "@/lib/schedule-time-server";
import { UnifiedTimetableBoard } from "@/components/schedule/unified-board";

export const dynamic = "force-dynamic";

export default async function TimetablePage() {
  const [data, config] = await Promise.all([
    getScheduleData(),
    getScheduleConfig(),
  ]);
  return <UnifiedTimetableBoard data={data} config={config} />;
}
