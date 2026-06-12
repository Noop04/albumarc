"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, Music2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MusicProfile } from "@/lib/cache/profile";
import { fetchAndStoreProfile, loadStoredProfile } from "@/lib/client/profile-storage";
import { aggregateTopCategories, formatCategoryLabel } from "@/lib/profile/categories";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MusicProfileView() {
  const [profile, setProfile] = useState<MusicProfile | null>(() => loadStoredProfile());
  const [loading, setLoading] = useState(() => !loadStoredProfile());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function load() {
      const stored = loadStoredProfile();
      if (stored) {
        setProfile(stored);
        setLoading(false);
        setRefreshing(true);
      }

      try {
        const fresh = await fetchAndStoreProfile();
        if (!fresh) {
          if (!stored) {
            window.location.href = "/";
          }
          return;
        }
        setProfile(fresh);
        setError(null);
      } catch (err) {
        if (!stored) {
          setError(err instanceof Error ? err.message : "Could not load profile");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading your music profile...</span>
      </div>
    );
  }

  const categories =
    (profile?.topCategories ?? []).length > 0
      ? profile!.topCategories
      : profile
        ? aggregateTopCategories(profile.topArtists)
        : [];

  if (error || !profile) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive-foreground">{error ?? "Profile unavailable"}</p>
        <Button asChild variant="outline">
          <Link href="/">Back to recommendations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Recommendations
          </Link>
        </Button>
        <p className="text-xs text-zinc-500">
          {refreshing ? "Refreshing…" : `Updated ${new Date(profile.fetchedAt).toLocaleString()}`}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {profile.imageUrl ? (
          <Image
            src={profile.imageUrl}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Music2 className="h-7 w-7 text-zinc-300" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-semibold text-white">
            {profile.displayName ?? "Spotify user"}
          </h2>
          <p className="text-sm text-zinc-400">Your taste profile · cached 30 min</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Liked songs" value={profile.stats.likedTracksSampled} />
        <StatCard label="Songs recommended" value={profile.stats.previouslyRecommended} />
        <StatCard label="Skips (30d)" value={profile.stats.skipsLast30Days} />
        <StatCard label="Likes (30d)" value={profile.stats.likesLast30Days} />
      </div>

      {categories.length > 0 && (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-white">Categories you like</CardTitle>
            <CardDescription>Genres that shape your taste profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-[#1DB954]/25 bg-[#1DB954]/10 px-3 py-1 text-xs font-medium text-[#1ed760]"
                >
                  {formatCategoryLabel(category)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white">Top artists</CardTitle>
          <CardDescription>What shapes your recommendations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.topArtists.map((artist, index) => (
            <div key={artist.id} className="flex items-center gap-3">
              <span className="w-6 text-xs text-zinc-500">#{index + 1}</span>
              {artist.imageUrl ? (
                <Image
                  src={artist.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{artist.name}</p>
                {artist.genres.length > 0 && (
                  <p className="truncate text-xs text-zinc-500">{artist.genres.slice(0, 2).join(", ")}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-white">Top tracks</CardTitle>
          <CardDescription>Your most-played songs recently</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.topTracks.map((track, index) => (
            <div key={track.id} className="flex items-center gap-3">
              <span className="w-6 text-xs text-zinc-500">#{index + 1}</span>
              {track.imageUrl ? (
                <Image
                  src={track.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-md bg-white/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{track.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  {track.artist} · {track.album}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}
