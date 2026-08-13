import { getScheduleData } from "@/lib/schedule-data";
import { getScheduleConfig } from "@/lib/schedule-time-server";
import { ScheduleBoard } from "@/components/schedule/schedule-board";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [data, config] = await Promise.all([
    getScheduleData(),
    getScheduleConfig(),
  ]);
  return <ScheduleBoard initialData={data} config={config} />;
}
