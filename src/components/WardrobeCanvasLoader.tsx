"use client";

import dynamic from "next/dynamic";

const WardrobeCanvas = dynamic(
  () =>
    import("@/components/WardrobeCanvas").then((mod) => mod.WardrobeCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted)]">
        Loading canvas…
      </div>
    ),
  },
);

export function WardrobeCanvasLoader() {
  return <WardrobeCanvas />;
}
