type ArtistWithGenres = { genres: string[] };

export function aggregateTopCategories(artists: ArtistWithGenres[], limit = 12): string[] {
  const scores = new Map<string, number>();

  artists.forEach((artist, index) => {
    const weight = Math.max(artists.length - index, 1);
    for (const genre of artist.genres) {
      scores.set(genre, (scores.get(genre) ?? 0) + weight);
    }
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([genre]) => genre);
}

export function formatCategoryLabel(genre: string): string {
  return genre
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
