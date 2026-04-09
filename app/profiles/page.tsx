import { DoctorProfilesManager } from "@/components/doctor-profiles-manager";
import { HomeScreenDock } from "@/components/home-screen-dock";

export default function ProfilesPage() {
  return (
    <div className="home-dotted-bg flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-20 pb-40 sm:pb-44">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Doctor profiles</h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Create and manage doctor records: name, areas of expertise, and weekly
            working hours. Profiles are stored in the server SQLite database (
            <code className="text-foreground/90">data/recura.db</code>
            ). “Load sample doctors” replaces all rows with the built-in edge-case
            scenario; <code className="text-foreground/90">npm run scenario:doctors</code>{" "}
            seeds the same data from the CLI.
          </p>
        </header>
        <DoctorProfilesManager />
      </main>
      <HomeScreenDock />
    </div>
  );
}
