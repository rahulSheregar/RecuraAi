import { AudioChatTabs } from "@/components/audio-chat-tabs";
import { HomeScreenDock } from "@/components/home-screen-dock";

export default function HomePage() {
  return (
    <div className="home-dotted-bg flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-28">
        <AudioChatTabs className="w-full" />
      </main>
      <HomeScreenDock />
    </div>
  );
}
