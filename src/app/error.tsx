"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-900 to-black px-4 text-center">
      <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
      <p className="max-w-md text-sm text-zinc-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset} className="bg-[#1DB954] text-black hover:bg-[#1ed760]">
        Try again
      </Button>
    </div>
  );
}
