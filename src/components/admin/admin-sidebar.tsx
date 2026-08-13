"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  School,
  DoorOpen,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/locale-provider";

const NAV = [
  { href: "/timetable", labelKey: "admin.sidebar.unified", icon: LayoutDashboard },
  { href: "/admin/teachers", labelKey: "admin.sidebar.teachers", icon: Users },
  { href: "/admin/classes", labelKey: "admin.sidebar.classes", icon: School },
  { href: "/admin/rooms", labelKey: "admin.sidebar.rooms", icon: DoorOpen },
  { href: "/admin/allocations", labelKey: "admin.sidebar.allocations", icon: CalendarRange },
  { href: "/admin/piket", labelKey: "admin.sidebar.piket", icon: ClipboardList },
  { href: "/admin/settings", labelKey: "admin.sidebar.settings", icon: Clock },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r bg-muted/30 p-3 print:hidden">
      <span className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {String(t("admin.group"))}
      </span>
      {NAV.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/timetable" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {String(t(item.labelKey))}
          </Link>
        );
      })}
    </nav>
  );
}
