import { getScheduleConfig } from "@/lib/schedule-time-server";
import { SettingsManager } from "@/components/admin/modules/settings-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await getScheduleConfig();
  return <SettingsManager initial={config} />;
}
