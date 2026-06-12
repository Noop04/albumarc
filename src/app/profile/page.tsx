import Link from "next/link";

import { MusicProfileView } from "@/components/music-profile";
import { SpotifyAttribution } from "@/components/spotify-attribution";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Music Profile</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your Spotify taste — used to personalize recommendations
          </p>
          <Link href="/" className="mt-3 inline-block text-sm text-[#1DB954] hover:underline">
            ← Back to song picks
          </Link>
        </header>

        <main>
          <MusicProfileView />
          <SpotifyAttribution />
        </main>
      </div>
    </div>
  );
}
