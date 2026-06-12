export function SpotifyAttribution() {
  return (
    <footer className="mt-12 border-t border-white/10 pt-6 text-center">
      <p className="text-xs text-zinc-500">
        Song metadata, artwork, and playback powered by{" "}
        <a
          href="https://www.spotify.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#1DB954] hover:underline"
        >
          Spotify
        </a>
        . Track and artist links open in Spotify.
      </p>
      <p className="mt-2 text-[10px] text-zinc-600">
        Albumarc is not affiliated with or endorsed by Spotify.
      </p>
    </footer>
  );
}
