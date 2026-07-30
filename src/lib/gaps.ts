import type { Module } from "@/store/store";

export interface Gap {
  startY: number;
  endY: number;
  height: number;
}

/**
 * Calculate vertical empty gaps between floor/ceiling and modules in a bay.
 * Coordinates are from the top of the wardrobe (y = 0 at top).
 */
export function calculateBayGaps(
  modules: Module[],
  wardrobeHeight: number,
): Gap[] {
  const sorted = [...modules].sort((a, b) => a.y - b.y);
  const gaps: Gap[] = [];

  let cursor = 0;

  for (const mod of sorted) {
    if (mod.y > cursor) {
      gaps.push({
        startY: cursor,
        endY: mod.y,
        height: mod.y - cursor,
      });
    }
    cursor = Math.max(cursor, mod.y + mod.height);
  }

  if (cursor < wardrobeHeight) {
    gaps.push({
      startY: cursor,
      endY: wardrobeHeight,
      height: wardrobeHeight - cursor,
    });
  }

  return gaps.filter((gap) => gap.height > 0);
}
