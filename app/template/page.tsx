
import { HomeScreenDock } from "@/components/home-screen-dock";
import { TemplateProfileManager } from "@/components/template-profile-manager";

export default function TemplatePage() {
    return (
        <div className="home-dotted-bg flex min-h-screen flex-col">
            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-20 pb-40 sm:pb-44">
                <header className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Template profiles</h1>
                    <p className="text-muted-foreground text-sm text-pretty">
                        Email templates for the scheduling assistant.
                    </p>
                </header>
                <TemplateProfileManager />
            </main>
            <HomeScreenDock />
        </div>
    );
}