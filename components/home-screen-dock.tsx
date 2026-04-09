"use client";

import {
  IconActivity,
  IconCalendar,
  IconHome,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";

import { FloatingDock } from "@/components/ui/floating-dock";

const dockItems = [
  {
    title: "Home",
    href: "/",
    icon: (
      <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Status",
    href: "#",
    icon: (
      <IconActivity className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Calendar",
    href: "#",
    icon: (
      <IconCalendar className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Profile",
    href: "#",
    icon: (
      <IconUser className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
  {
    title: "Settings",
    href: "#",
    icon: (
      <IconSettings className="h-full w-full text-neutral-500 dark:text-neutral-300" />
    ),
  },
];

export function HomeScreenDock() {
  return (
    <FloatingDock
      items={dockItems}
      desktopClassName="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2"
      mobileClassName="fixed bottom-8 right-6 z-[100]"
    />
  );
}
