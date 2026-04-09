import { CalendarFilterView } from "@/components/calendar-filter-view";
import { HomeScreenDock } from "@/components/home-screen-dock";
import { listCalendarEvents } from "@/lib/db/calendar-events";

export default function CalendarPage() {
  const events = listCalendarEvents();

  return (
    <div className="home-dotted-bg flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-[min(100%,1600px)] flex-1 flex-col justify-start px-3 py-24 sm:px-6 lg:py-28">
        <CalendarFilterView className="w-full" events={events} />
      </main>
      <HomeScreenDock />
    </div>
  );
}
