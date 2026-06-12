import { AlbumRecommendationsShell } from "@/components/album-recommendations-shell";
import { SpotifyAttribution } from "@/components/spotify-attribution";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Albumarc</h1>
          <p className="mt-4 text-lg leading-8 text-zinc-400">
            Personalized song discovery powered by your Spotify taste.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            New songs you haven&apos;t heard — synced to your &quot;albumarc&quot; playlist.
          </p>
        </header>

        <main>
          <AlbumRecommendationsShell />
          <SpotifyAttribution />
        </main>
      </div>
    </div>
  );
}
