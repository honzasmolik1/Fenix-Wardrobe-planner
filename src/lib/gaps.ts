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

/**
 * Clearances in a vertical zone: from zone top → first fitting, between
 * fittings, and last fitting → zone bottom (floor / construction underside).
 */
export function calculateGapsInZone(
  modules: Module[],
  zoneStart: number,
  zoneEnd: number,
): Gap[] {
  if (zoneEnd <= zoneStart) return [];

  const sorted = [...modules]
    .filter((mod) => mod.y + mod.height > zoneStart && mod.y < zoneEnd)
    .sort((a, b) => a.y - b.y);

  const gaps: Gap[] = [];
  let cursor = zoneStart;

  for (const mod of sorted) {
    const top = Math.max(mod.y, zoneStart);
    if (top > cursor) {
      gaps.push({
        startY: cursor,
        endY: top,
        height: top - cursor,
      });
    }
    cursor = Math.max(cursor, Math.min(mod.y + mod.height, zoneEnd));
  }

  if (cursor < zoneEnd) {
    gaps.push({
      startY: cursor,
      endY: zoneEnd,
      height: zoneEnd - cursor,
    });
  }

  return gaps.filter((gap) => gap.height > 0);
}

/**
 * Clearances only between consecutive fittings (shelf / rail / drawer).
 * Skips ceiling→first and last→floor empty zones.
 */
export function calculateGapsBetweenModules(modules: Module[]): Gap[] {
  const sorted = [...modules].sort((a, b) => a.y - b.y);
  const gaps: Gap[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const upper = sorted[i];
    const lower = sorted[i + 1];
    const startY = upper.y + upper.height;
    const endY = lower.y;
    const height = endY - startY;
    if (height > 0) {
      gaps.push({ startY, endY, height });
    }
  }

  return gaps;
}
