import {
  DUAL_RAIL_SPACING_MM,
  JACKET_CLEARANCE_MM,
  MAX_RAILS_PER_BAY,
  MODULE_CLEARANCE_MM,
  MODULE_HEIGHTS,
  DRAG_SNAP_MM,
  RAIL_FROM_TOP_MM,
  SHELF_ABOVE_RAIL_GAP_MM,
  SHELF_ALIGN_MAGNET_MM,
  SNAP_INCREMENT_MM,
  mainZoneTop,
} from "@/lib/constants";
import type { Bay, Module } from "@/store/store";

export interface Span {
  start: number;
  end: number;
}

function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function freeSpans(blocked: Span[], wardrobeHeight: number): Span[] {
  const merged = mergeSpans(
    blocked
      .map((span) => ({
        start: Math.max(0, span.start),
        end: Math.min(wardrobeHeight, span.end),
      }))
      .filter((span) => span.end > span.start),
  );

  const free: Span[] = [];
  let cursor = 0;

  for (const span of merged) {
    if (span.start > cursor) {
      free.push({ start: cursor, end: span.start });
    }
    cursor = Math.max(cursor, span.end);
  }

  if (cursor < wardrobeHeight) {
    free.push({ start: cursor, end: wardrobeHeight });
  }

  return free;
}

function paddedBody(mod: Module, wardrobeHeight: number): Span {
  return {
    start: Math.max(0, mod.y - MODULE_CLEARANCE_MM),
    end: Math.min(wardrobeHeight, mod.y + mod.height + MODULE_CLEARANCE_MM),
  };
}

function jacketZone(mod: Module, wardrobeHeight: number): Span | null {
  if (mod.type !== "hanging-rail") return null;
  const start = mod.y + mod.height;
  const end = Math.min(wardrobeHeight, start + JACKET_CLEARANCE_MM);
  if (end <= start) return null;
  return { start, end };
}

export function blockedForPlacement(
  modules: Module[],
  wardrobeHeight: number,
  options: {
    ignoreId?: string;
    reserveJacketSpace: boolean;
  },
): Span[] {
  const blocked: Span[] = [];

  for (const mod of modules) {
    if (mod.id === options.ignoreId) continue;
    blocked.push(paddedBody(mod, wardrobeHeight));

    if (options.reserveJacketSpace) {
      const jacket = jacketZone(mod, wardrobeHeight);
      if (jacket) blocked.push(jacket);
    }
  }

  return mergeSpans(blocked);
}

function floorY(height: number, wardrobeHeight: number): number {
  return Math.max(0, wardrobeHeight - height);
}

/**
 * Snap to a grid (default 10 mm for manual drag), but keep flush-to-floor
 * when near the bottom.
 */
function snapY(
  y: number,
  height: number,
  wardrobeHeight: number,
  increment: number = DRAG_SNAP_MM,
): number {
  const maxY = floorY(height, wardrobeHeight);
  const step = Math.max(1, increment);

  // Generous floor magnet — drawers were getting stuck floating
  if (y >= maxY - step * 3) {
    return maxY;
  }

  const snapped = Math.round(y / step) * step;
  return Math.min(Math.max(0, snapped), maxY);
}

function fitsInSpan(span: Span, height: number): boolean {
  return span.end - span.start >= height;
}

function placeInSpan(
  span: Span,
  height: number,
  mode: "start" | "center" | "end",
  wardrobeHeight: number,
): number {
  let raw: number;
  if (mode === "start") raw = span.start;
  else if (mode === "end") raw = span.end - height;
  else raw = span.start + (span.end - span.start - height) / 2;

  if (mode === "end" && Math.abs(span.end - wardrobeHeight) < 0.5) {
    return floorY(height, wardrobeHeight);
  }

  return snapY(raw, height, wardrobeHeight);
}

function canFitShelves(span: Span, count: number, shelfHeight: number): boolean {
  return span.end - span.start >= count * shelfHeight;
}

/** Where leftover mm goes when evening shelf gaps. */
export type EvenRemainderMode = "bottom" | "middle";

function evenShelfPositions(
  span: Span,
  count: number,
  shelfHeight: number,
  remainder: EvenRemainderMode = "bottom",
): number[] {
  const top = Math.round(span.start);
  const bottom = Math.round(span.end);
  const spanHeight = bottom - top;
  const totalShelfHeight = count * shelfHeight;

  if (count <= 0) return [];

  if (totalShelfHeight >= spanHeight) {
    return Array.from({ length: count }, (_, index) =>
      Math.min(
        top + index * shelfHeight,
        Math.max(top, bottom - shelfHeight),
      ),
    );
  }

  // Even clearances — leftover mm goes to bottom gap, or the middle gap(s).
  const gapCount = count + 1;
  const free = spanHeight - totalShelfHeight;
  const baseGap = Math.floor(free / gapCount);
  const rem = free - baseGap * gapCount;
  const gaps = Array.from({ length: gapCount }, () => baseGap);
  if (rem > 0 && gapCount > 0) {
    if (remainder === "middle") {
      // Spread leftover across the centre gap(s)
      const mid = Math.floor((gapCount - 1) / 2);
      for (let i = 0; i < rem; i += 1) {
        const slot =
          rem === 1 || gapCount === 1
            ? mid
            : mid + (i % 2 === 0 ? 0 : 1);
        gaps[Math.min(gapCount - 1, slot)] += 1;
      }
    } else {
      gaps[gapCount - 1] += rem;
    }
  }

  const ys: number[] = [];
  let cursor = top;
  for (let i = 0; i < count; i += 1) {
    cursor += gaps[i];
    ys.push(cursor);
    cursor += shelfHeight;
  }
  return ys;
}

/** Even shelf top-Y positions inside a vertical span. */
export function evenShelfYsInSpan(
  startMm: number,
  endMm: number,
  count: number,
  shelfHeight: number,
  remainder: EvenRemainderMode = "bottom",
): number[] {
  return evenShelfPositions(
    { start: startMm, end: endMm },
    count,
    shelfHeight,
    remainder,
  );
}

/**
 * Pick `count` Y lines from candidate neighbor lines (evenly along the list).
 * If count >= lines.length, returns all lines.
 */
export function pickEvenShelfLines(lines: number[], count: number): number[] {
  const sorted = [...lines].sort((a, b) => a - b);
  if (count <= 0 || sorted.length === 0) return [];
  if (count >= sorted.length) return sorted;
  if (count === 1) {
    return [sorted[Math.floor((sorted.length - 1) / 2)]];
  }
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const idx = Math.round(t * (sorted.length - 1));
    out.push(sorted[idx]);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** True when a shelf at `y` would overlap a blocker (drawer, rail, etc.). */
export function shelfLineIsFree(
  y: number,
  shelfHeight: number,
  blockers: Pick<Module, "y" | "height">[],
): boolean {
  const end = y + shelfHeight;
  return blockers.every(
    (block) => end <= block.y || y >= block.y + block.height,
  );
}

/**
 * Snap each current shelf Y onto the nearest unused neighbour line
 * that still fits (does not hit drawers / rails).
 */
export function snapShelvesToAlignLines(
  currentYs: number[],
  alignLines: number[],
  shelfHeight: number,
  blockers: Pick<Module, "y" | "height">[] = [],
): number[] {
  const remaining = alignLines
    .map((y) => Math.round(y))
    .filter((y) => shelfLineIsFree(y, shelfHeight, blockers))
    .sort((a, b) => a - b);
  if (currentYs.length === 0 || remaining.length === 0) return [];

  const used = new Set<number>();
  const snapped = [...currentYs]
    .map((y, index) => ({ y: Math.round(y), index }))
    .sort((a, b) => a.y - b.y)
    .map((item) => {
      let best: number | null = null;
      let bestDist = Infinity;
      for (const line of remaining) {
        if (used.has(line)) continue;
        const dist = Math.abs(line - item.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = line;
        }
      }
      if (best == null) return { ...item, y: item.y };
      used.add(best);
      return { ...item, y: best };
    });

  return snapped.sort((a, b) => a.index - b.index).map((item) => item.y);
}

export function neighborBayHasShelves(
  modules: Pick<Module, "bayId" | "type">[],
  bays: Pick<Bay, "id" | "index">[],
  bayId: string,
): boolean {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const idx = sorted.findIndex((bay) => bay.id === bayId);
  if (idx < 0) return false;
  const neighborIds = [sorted[idx - 1]?.id, sorted[idx + 1]?.id].filter(
    (id): id is string => Boolean(id),
  );
  if (neighborIds.length === 0) return false;
  return modules.some(
    (mod) => mod.type === "shelf" && neighborIds.includes(mod.bayId),
  );
}

/**
 * Place `count` shelves in a span: keep neighbour align lines first,
 * then centre any extras in the largest remaining pocket (10 mm rounded).
 * E.g. 2 shelves + 1 align line → one aligned, one centred in the free half.
 * Drawers / rails are treated as occupied so extras never sit on them.
 */
export function alignAndCenterShelfYs(
  spanStart: number,
  spanEnd: number,
  shelfHeight: number,
  alignLines: number[],
  count: number,
  blockers: Pick<Module, "y" | "height">[] = [],
): number[] {
  if (count <= 0) return [];
  const start = Math.round(spanStart);
  const end = Math.round(spanEnd);
  const blockedOcc = mergeSpans(
    blockers
      .map((block) => ({
        start: Math.round(block.y),
        end: Math.round(block.y + block.height),
      }))
      .filter((span) => span.end > start && span.start < end)
      .map((span) => ({
        start: Math.max(start, span.start),
        end: Math.min(end, span.end),
      })),
  ).map((span) => ({ a: span.start, b: span.end }));

  const aligned = alignLines
    .map((y) => Math.round(y))
    .filter((y) => y >= start && y + shelfHeight <= end)
    .filter((y) => shelfLineIsFree(y, shelfHeight, blockers))
    .sort((a, b) => a - b);

  const ys: number[] = [];
  for (const y of aligned) {
    if (ys.length >= count) break;
    ys.push(y);
  }

  while (ys.length < count) {
    const occupied = [
      ...blockedOcc,
      ...ys.map((y) => ({ a: y, b: y + shelfHeight })),
    ].sort((a, b) => a.a - b.a);
    const frees: { a: number; b: number }[] = [];
    let cursor = start;
    for (const occ of occupied) {
      if (occ.a > cursor) frees.push({ a: cursor, b: occ.a });
      cursor = Math.max(cursor, occ.b);
    }
    if (end > cursor) frees.push({ a: cursor, b: end });

    let bestStart = start;
    let bestFree = -1;
    for (const free of frees) {
      const freeH = free.b - free.a - shelfHeight;
      if (freeH > bestFree) {
        bestFree = freeH;
        bestStart = free.a;
      }
    }
    if (bestFree < 0) break;
    const centerY =
      Math.round((bestStart + bestFree / 2) / DRAG_SNAP_MM) * DRAG_SNAP_MM;
    const y = Math.min(end - shelfHeight, Math.max(start, centerY));
    if (ys.some((existing) => Math.abs(existing - y) < shelfHeight)) break;
    if (!shelfLineIsFree(y, shelfHeight, blockers)) break;
    ys.push(y);
  }

  return ys.sort((a, b) => a - b).slice(0, count);
}

/**
 * Drop neighbour shelf lines that sit closer than `minAirMm` of clear air.
 * Keeps one line per cluster (the one nearest an existing local shelf).
 */
export function collapseCloseShelfLines(
  lines: number[],
  preferYs: number[] = [],
  shelfHeight: number,
  minAirMm: number,
): number[] {
  const minDelta = Math.max(shelfHeight, shelfHeight + Math.max(0, minAirMm));
  const sorted = [...new Set(lines.map((y) => Math.round(y)))].sort(
    (a, b) => a - b,
  );
  if (sorted.length <= 1) return sorted;

  const clusters: number[][] = [];
  for (const y of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || y - last[last.length - 1] >= minDelta) {
      clusters.push([y]);
    } else {
      last.push(y);
    }
  }

  return clusters.map((cluster) => {
    if (cluster.length === 1) return cluster[0];
    let best = cluster[0];
    let bestDist = Infinity;
    for (const y of cluster) {
      const dist =
        preferYs.length > 0
          ? Math.min(...preferYs.map((p) => Math.abs(p - y)))
          : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = y;
      }
    }
    return best;
  });
}

/** Unique shelf Y lines used anywhere in the wardrobe (keeps bays visually aligned). */
export function globalShelfLines(
  modules: Module[],
  options?: { ignoreBayId?: string; ignoreId?: string },
): number[] {
  const lines = new Set<number>();
  for (const mod of modules) {
    if (mod.type !== "shelf") continue;
    if (options?.ignoreId && mod.id === options.ignoreId) continue;
    if (options?.ignoreBayId && mod.bayId === options.ignoreBayId) continue;
    lines.add(mod.y);
  }
  return [...lines].sort((a, b) => a - b);
}

/**
 * Shelf Y lines from the bay(s) immediately to the left (and optionally right)
 * — used as an alignment grid while dragging.
 */
export function neighborShelfAlignLines(
  modules: Module[],
  bays: Pick<Bay, "id" | "index">[],
  bayId: string,
  options?: { ignoreId?: string; includeRight?: boolean },
): number[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const idx = sorted.findIndex((bay) => bay.id === bayId);
  if (idx < 0) return [];

  const sourceIds = new Set<string>();
  if (idx > 0) sourceIds.add(sorted[idx - 1].id);
  if (options?.includeRight !== false && idx < sorted.length - 1) {
    sourceIds.add(sorted[idx + 1].id);
  }
  // Prefer left-side grid: also include every bay further left
  for (let i = 0; i < idx; i += 1) {
    sourceIds.add(sorted[i].id);
  }
  if (sourceIds.size === 0) return [];

  const lines = new Set<number>();
  for (const mod of modules) {
    if (mod.type !== "shelf") continue;
    if (options?.ignoreId && mod.id === options.ignoreId) continue;
    if (!sourceIds.has(mod.bayId)) continue;
    lines.add(Math.round(mod.y));
  }
  return [...lines].sort((a, b) => a - b);
}

export function nearestShelfAlignLine(
  y: number,
  lines: number[],
  magnetMm = SHELF_ALIGN_MAGNET_MM,
): number | null {
  const nearest = nearestLine(y, lines);
  if (nearest == null) return null;
  if (Math.abs(nearest - y) > magnetMm) return null;
  return nearest;
}

function nearestLine(y: number, lines: number[]): number | null {
  if (lines.length === 0) return null;
  let best = lines[0];
  let bestDist = Math.abs(y - best);
  for (const line of lines) {
    const dist = Math.abs(y - line);
    if (dist < bestDist) {
      best = line;
      bestDist = dist;
    }
  }
  return best;
}

function overlaps(y: number, height: number, other: Module): boolean {
  const a0 = y;
  const a1 = y + height;
  const b0 = other.y - MODULE_CLEARANCE_MM;
  const b1 = other.y + other.height + MODULE_CLEARANCE_MM;
  return a0 < b1 && a1 > b0;
}

/** Body overlap only — used so 10 mm shelf snaps aren't blocked by clearance. */
function overlapsBody(y: number, height: number, other: Module): boolean {
  return y < other.y + other.height && y + height > other.y;
}

function isFree(y: number, height: number, others: Module[]): boolean {
  return others.every((mod) => !overlaps(y, height, mod));
}

function isBodyFree(y: number, height: number, others: Module[]): boolean {
  return others.every((mod) => !overlapsBody(y, height, mod));
}

/** Top storage above the construction shelf is not an adjustable shelf zone. */
function blockTopStorage(
  wardrobeHeight: number,
  carcassHeight: number,
): Span {
  return { start: 0, end: mainZoneTop(wardrobeHeight, carcassHeight) };
}

function freeSpansInMainZone(
  obstacles: Module[],
  wardrobeHeight: number,
  carcassHeight: number,
  options: { reserveJacketSpace: boolean },
): Span[] {
  const blocked = [
    blockTopStorage(wardrobeHeight, carcassHeight),
    ...blockedForPlacement(obstacles, wardrobeHeight, options),
  ];
  return freeSpans(blocked, wardrobeHeight);
}

function shelfPlacementSpan(
  free: Span[],
  obstacles: Module[],
  count: number,
  shelfHeight: number,
): Span | null {
  if (free.length === 0) return null;

  const rails = obstacles.filter((mod) => mod.type === "hanging-rail");
  const aboveRail = free.filter(
    (span) =>
      rails.some((rail) => span.end <= rail.y) &&
      canFitShelves(span, count, shelfHeight),
  );
  const fitting = free.filter((span) =>
    canFitShelves(span, count, shelfHeight),
  );
  return aboveRail[0] ?? fitting[0] ?? free[0] ?? null;
}

/**
 * Shelves around a hanging rail:
 * — first shelf above sits SHELF_ABOVE_RAIL_GAP_MM above the rail; extras
 *   fill evenly up to the construction line
 * — first shelf below sits exactly JACKET_CLEARANCE_MM under the rail;
 *   further shelves are evenly spaced from that shelf down to the floor
 */
function shelfYsAroundRail(
  rail: Module,
  shelfCount: number,
  shelfHeight: number,
  wardrobeHeight: number,
  carcassHeight: number,
  otherObstacles: Module[],
): number[] {
  if (shelfCount <= 0) return [];

  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);
  const firstAboveY = rail.y - SHELF_ABOVE_RAIL_GAP_MM - shelfHeight;
  // Fixed hang zone: first shelf below starts 900 mm under the rail
  const belowStartY = rail.y + rail.height + JACKET_CLEARANCE_MM;

  const drawers = otherObstacles.filter((mod) => mod.type === "drawer-pack");
  const zoneBottom = drawers.reduce(
    (min, drawer) => Math.min(min, drawer.y),
    wardrobeHeight,
  );

  const canPlaceAbove =
    firstAboveY >= zoneTop &&
    firstAboveY + shelfHeight <= rail.y - SHELF_ABOVE_RAIL_GAP_MM + 0.5;

  // Prefer filling above first when there is room, then hang zone + even below
  let aboveCount = 0;
  if (canPlaceAbove) {
    const aboveSpanHeight = Math.max(0, firstAboveY + shelfHeight - zoneTop);
    const maxAbove = Math.max(
      1,
      Math.floor(aboveSpanHeight / Math.max(shelfHeight, 1)),
    );
    aboveCount = Math.min(shelfCount, maxAbove);
  }
  const belowCount = shelfCount - aboveCount;

  const positions: number[] = [];

  if (aboveCount === 1) {
    positions.push(Math.round(firstAboveY));
  } else if (aboveCount > 1) {
    // First (lowest) shelf is 100 mm above the rail; higher shelves even above it
    const lowest = Math.round(firstAboveY);
    const upperSpan: Span = {
      start: zoneTop,
      end: lowest,
    };
    const upper = evenShelfPositions(
      upperSpan,
      aboveCount - 1,
      shelfHeight,
    );
    positions.push(...upper, lowest);
  }

  if (belowCount > 0 && belowStartY + shelfHeight <= zoneBottom) {
    const firstBelow = Math.min(
      Math.round(belowStartY),
      Math.max(belowStartY, zoneBottom - shelfHeight),
    );
    // First shelf locks to the 900 mm hang mark under the rail
    positions.push(firstBelow);

    if (belowCount > 1) {
      // Remaining shelves evenly fill the pocket under that first shelf
      const restSpan: Span = {
        start: firstBelow + shelfHeight,
        end: zoneBottom,
      };
      if (restSpan.end - restSpan.start >= shelfHeight) {
        positions.push(
          ...evenShelfPositions(restSpan, belowCount - 1, shelfHeight),
        );
      }
    }
  } else if (belowCount > 0 && canPlaceAbove) {
    // Not enough room below — pack remaining above if possible
    const extraSpan: Span = {
      start: zoneTop,
      end: Math.round(firstAboveY),
    };
    const extras = evenShelfPositions(
      extraSpan,
      belowCount,
      shelfHeight,
    );
    positions.push(...extras);
  }

  return [...new Set(positions.map((y) => Math.round(y)))].sort(
    (a, b) => a - b,
  );
}

/**
 * Re-space shelves in a bay inside the main carcass only (below construction
 * shelf). With a hanging rail, uses 100 mm above / 900 mm hang rules.
 */
export function redistributeShelvesEvenly(
  modules: Module[],
  bayId: string,
  wardrobeHeight: number,
  options: {
    forceEven?: boolean;
    carcassHeight?: number;
    /** When set (e.g. media mode = 0), overrides construction-shelf zone top. */
    zoneTop?: number;
    /** Extra blocked spans (e.g. TV niche) treated as obstacles. */
    blockedSpans?: Span[];
    /** Leftover mm when evening: bottom gap (default) or middle gap(s). */
    remainder?: EvenRemainderMode;
  } = {},
): Module[] {
  const carcassHeight = options.carcassHeight ?? 2000;
  const remainder = options.remainder ?? "bottom";
  const shelfHeight = MODULE_HEIGHTS.shelf;
  const shelves = modules
    .filter((mod) => mod.bayId === bayId && mod.type === "shelf")
    .sort((a, b) => a.y - b.y);

  if (shelves.length === 0) return modules;

  const obstacles = modules.filter(
    (mod) => mod.bayId === bayId && mod.type !== "shelf",
  );
  const rails = obstacles
    .filter((mod) => mod.type === "hanging-rail")
    .sort((a, b) => a.y - b.y);
  const blocked = options.blockedSpans ?? [];

  let positions: number[];

  // Double hang fills the bay — no shelves allowed with 2 rails
  if (rails.length >= 2) {
    return modules.filter(
      (mod) => !(mod.bayId === bayId && mod.type === "shelf"),
    );
  }

  if (rails.length === 1 && options.zoneTop === undefined) {
    // Use the topmost rail as the hang reference in this bay
    const rail = rails[0];
    const otherObstacles = obstacles.filter((mod) => mod.id !== rail.id);
    positions = shelfYsAroundRail(
      rail,
      shelves.length,
      shelfHeight,
      wardrobeHeight,
      carcassHeight,
      otherObstacles,
    );
  } else {
    // Pocket from construction underside to the top face of drawers / floor.
    // Do not subtract MODULE_CLEARANCE here — that made the bottom air gap
    // look ~32 mm larger than the gaps between shelves.
    const zoneTop =
      options.zoneTop ?? mainZoneTop(wardrobeHeight, carcassHeight);
    // With a TV niche (or similar), place shelves in free pockets around blocks.
    if (blocked.length > 0 || options.zoneTop !== undefined) {
      const free = freeSpans(
        [
          ...obstacles.map((obs) => ({
            start: obs.y,
            end: obs.y + obs.height,
          })),
          ...blocked,
        ],
        wardrobeHeight,
      )
        .map((span) => ({
          start: Math.max(span.start, zoneTop),
          end: span.end,
        }))
        .filter((span) => span.end - span.start >= shelfHeight);

      const count = shelves.length;
      if (free.length === 0 || count === 0) {
        positions = [];
      } else if (free.length === 1) {
        const span = free[0];
        const placeCount = canFitShelves(span, count, shelfHeight)
          ? count
          : Math.max(
              0,
              Math.floor((span.end - span.start) / Math.max(shelfHeight, 1)),
            );
        positions =
          placeCount > 0
            ? evenShelfPositions(span, placeCount, shelfHeight, remainder)
            : [];
      } else {
        // Split shelves across free pockets (above / below TV)
        const perPocket = Math.floor(count / free.length);
        let leftover = count - perPocket * free.length;
        positions = [];
        for (const span of free) {
          const n = perPocket + (leftover > 0 ? 1 : 0);
          if (leftover > 0) leftover -= 1;
          if (n <= 0) continue;
          const placeCount = canFitShelves(span, n, shelfHeight)
            ? n
            : Math.max(
                0,
                Math.floor((span.end - span.start) / Math.max(shelfHeight, 1)),
              );
          if (placeCount > 0) {
            positions.push(
              ...evenShelfPositions(span, placeCount, shelfHeight, remainder),
            );
          }
        }
      }
    } else {
    let zoneBottom = wardrobeHeight;
    for (const obs of obstacles) {
      if (obs.y + obs.height <= zoneTop) continue;
      if (obs.y < zoneBottom) zoneBottom = obs.y;
    }
    const span: Span = {
      start: zoneTop,
      end: Math.max(zoneTop, zoneBottom),
    };

    const count = shelves.length;
    const placeCount = canFitShelves(span, count, shelfHeight)
      ? count
      : Math.max(
          0,
          Math.floor((span.end - span.start) / Math.max(shelfHeight, 1)),
        );

    if (placeCount === 0) {
      positions = [];
    } else if (options.forceEven) {
      positions = evenShelfPositions(span, placeCount, shelfHeight, remainder);
    } else {
      const globalLines = globalShelfLines(modules, {
        ignoreBayId: bayId,
      }).filter(
        (line) =>
          line >= span.start &&
          line + shelfHeight <= span.end &&
          isFree(line, shelfHeight, obstacles),
      );

      if (globalLines.length >= placeCount) {
        positions = globalLines.slice(0, placeCount);
      } else if (globalLines.length > 0) {
        const used = new Set(globalLines.slice(0, placeCount));
        const remaining = placeCount - used.size;
        const even = evenShelfPositions(span, placeCount, shelfHeight, remainder).filter(
          (y) =>
            ![...used].some((line) => Math.abs(line - y) < SNAP_INCREMENT_MM),
        );
        positions = [...used, ...even.slice(0, remaining)].sort((a, b) => a - b);
      } else {
        positions = evenShelfPositions(span, placeCount, shelfHeight, remainder);
      }
    }
    }
  }

  if (positions.length === 0) {
    if (!options.forceEven) return modules;
    // No room left under the construction line — drop this bay's shelves
    return modules.filter(
      (mod) => !(mod.bayId === bayId && mod.type === "shelf"),
    );
  }

  const zoneTop =
    options.zoneTop ?? mainZoneTop(wardrobeHeight, carcassHeight);
  const maxY = Math.max(zoneTop, wardrobeHeight - shelfHeight);

  return modules.flatMap((mod) => {
    if (mod.bayId !== bayId || mod.type !== "shelf") return [mod];
    const index = shelves.findIndex((shelf) => shelf.id === mod.id);
    if (index < 0 || index >= positions.length) {
      return options.forceEven ? [] : [mod];
    }
    const y = Math.min(Math.max(zoneTop, positions[index] ?? mod.y), maxY);
    return [{ ...mod, y }];
  });
}

/**
 * When the construction line moves down, push fittings into the main carcass
 * or remove them if there is no free slot left.
 */
export function reconcileModulesForCarcassHeight(
  modules: Module[],
  bayIds: string[],
  wardrobeHeight: number,
  carcassHeight: number,
): Module[] {
  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);
  let result = modules.map((mod) => ({ ...mod }));

  for (const bayId of bayIds) {
    const offenders = result
      .filter(
        (mod) =>
          mod.bayId === bayId &&
          mod.type !== "shelf" &&
          mod.y < zoneTop,
      )
      .sort((a, b) => a.y - b.y);

    for (const mod of offenders) {
      const others = result.filter(
        (item) => item.bayId === bayId && item.id !== mod.id,
      );
      const maxY = Math.max(zoneTop, wardrobeHeight - mod.height);
      let placed: number | null = null;

      if (mod.type === "drawer-pack") {
        if (isFree(maxY, mod.height, others) && maxY >= zoneTop) {
          placed = maxY;
        } else {
          for (let y = maxY; y >= zoneTop; y -= SNAP_INCREMENT_MM) {
            if (isFree(y, mod.height, others)) {
              placed = y;
              break;
            }
          }
        }
      } else {
        // Hanging rail — lock to canonical 50 mm / +900 mm positions
        const bayRails = result.filter(
          (item) =>
            item.bayId === bayId && item.type === "hanging-rail",
        );
        if (bayRails.some((item) => item.id === mod.id)) {
          result = syncBayRailPositions(
            result,
            bayId,
            wardrobeHeight,
            carcassHeight,
          );
          placed = result.find((item) => item.id === mod.id)?.y ?? null;
        }
      }

      if (placed === null) {
        result = result.filter((item) => item.id !== mod.id);
      } else {
        result = result.map((item) =>
          item.id === mod.id ? { ...item, y: placed } : item,
        );
      }
    }

    // Drop any shelves still sitting in the top box, then re-space
    result = result.filter(
      (mod) =>
        !(mod.bayId === bayId && mod.type === "shelf" && mod.y < zoneTop),
    );
    // Rails always snap to 50 mm / +900 mm as the construction line moves
    result = syncBayRailPositions(
      result,
      bayId,
      wardrobeHeight,
      carcassHeight,
    );
    // Double hang: strip shelves (and any drawers that slipped in)
    const bayRails = result.filter(
      (mod) => mod.bayId === bayId && mod.type === "hanging-rail",
    );
    if (bayRails.length >= MAX_RAILS_PER_BAY) {
      result = result.filter(
        (mod) =>
          !(
            mod.bayId === bayId &&
            (mod.type === "shelf" || mod.type === "drawer-pack")
          ),
      );
    } else {
      result = redistributeShelvesEvenly(result, bayId, wardrobeHeight, {
        forceEven: true,
        carcassHeight,
      });
    }
  }

  return result;
}

/** Force evenly spaced shelves (rail rules apply when a rail is present). */
export function evenSpaceShelvesInBay(
  modules: Module[],
  bayId: string,
  wardrobeHeight: number,
  carcassHeight = 2000,
  options: {
    zoneTop?: number;
    blockedSpans?: { start: number; end: number }[];
    remainder?: EvenRemainderMode;
  } = {},
): Module[] {
  return redistributeShelvesEvenly(modules, bayId, wardrobeHeight, {
    forceEven: true,
    carcassHeight,
    zoneTop: options.zoneTop,
    blockedSpans: options.blockedSpans,
    remainder: options.remainder,
  });
}

/** True when a bay already has two hanging rails (double hang). */
export function bayHasDualRails(bayModules: Module[]): boolean {
  return (
    bayModules.filter((mod) => mod.type === "hanging-rail").length >=
    MAX_RAILS_PER_BAY
  );
}

/**
 * Fixed rail Y positions in the main carcass:
 * — 1st rail: RAIL_FROM_TOP_MM below the construction underside
 * — 2nd rail: DUAL_RAIL_SPACING_MM clear air below the first (underside → top)
 */
export function canonicalRailYs(
  count: number,
  wardrobeHeight: number,
  carcassHeight = 2000,
): number[] {
  const railH = MODULE_HEIGHTS["hanging-rail"];
  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);
  const firstY = zoneTop + RAIL_FROM_TOP_MM;
  if (count <= 0) return [];
  if (firstY + railH > wardrobeHeight) return [];
  if (count === 1) return [firstY];

  const secondY = firstY + railH + DUAL_RAIL_SPACING_MM;
  if (secondY + railH > wardrobeHeight) return [firstY];
  return [firstY, secondY];
}

/** Snap every hanging rail in a bay onto the canonical double/single positions. */
export function syncBayRailPositions(
  modules: Module[],
  bayId: string,
  wardrobeHeight: number,
  carcassHeight = 2000,
): Module[] {
  const rails = modules
    .filter((mod) => mod.bayId === bayId && mod.type === "hanging-rail")
    .sort((a, b) => a.y - b.y);
  if (rails.length === 0) return modules;

  const ys = canonicalRailYs(rails.length, wardrobeHeight, carcassHeight);
  if (ys.length === 0) return modules;

  const yById = new Map(
    rails.map((rail, index) => [rail.id, ys[index] ?? rail.y]),
  );
  return modules.map((mod) => {
    const y = yById.get(mod.id);
    return y === undefined ? mod : { ...mod, y };
  });
}

/** Returns false when there is no free pocket left for another shelf. */
export function canAddShelf(
  bayModules: Module[],
  wardrobeHeight: number,
  carcassHeight = 2000,
  options: {
    zoneTop?: number;
    blockedSpans?: { start: number; end: number }[];
  } = {},
): boolean {
  if (bayHasDualRails(bayModules)) return false;

  const shelfHeight = MODULE_HEIGHTS.shelf;
  const nextCount =
    bayModules.filter((mod) => mod.type === "shelf").length + 1;
  const obstacles = bayModules.filter((mod) => mod.type !== "shelf");

  if (options.zoneTop !== undefined || (options.blockedSpans?.length ?? 0) > 0) {
    const zoneTop = options.zoneTop ?? 0;
    const free = freeSpans(
      [
        ...obstacles.map((obs) => ({
          start: obs.y,
          end: obs.y + obs.height,
        })),
        ...(options.blockedSpans ?? []),
      ],
      wardrobeHeight,
    )
      .map((span) => ({
        start: Math.max(span.start, zoneTop),
        end: span.end,
      }))
      .filter((span) => span.end > span.start);
    return free.some((span) => canFitShelves(span, nextCount, shelfHeight));
  }

  const free = freeSpansInMainZone(obstacles, wardrobeHeight, carcassHeight, {
    reserveJacketSpace: true,
  });
  return free.some((span) => canFitShelves(span, nextCount, shelfHeight));
}

/** Drawers are not allowed in a double-hang (2-rail) bay, or twice in one bay. */
export function canAddDrawer(bayModules: Module[]): boolean {
  if (bayModules.some((mod) => mod.type === "drawer-pack")) return false;
  return !bayHasDualRails(bayModules);
}

/** Prefer the selected bay; otherwise the newest empty bay that can take drawers. */
export function findDrawerTargetBayId(
  bays: Bay[],
  modules: Module[],
  preferredId: string | null,
): string | null {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const eligible = (id: string) =>
    canAddDrawer(modules.filter((mod) => mod.bayId === id));
  if (preferredId && eligible(preferredId)) return preferredId;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const id = sorted[i]?.id;
    if (id && eligible(id)) return id;
  }
  return null;
}

export function canAddRail(
  bayModules: Module[],
  wardrobeHeight: number,
  carcassHeight = 2000,
): boolean {
  const existing = bayModules.filter(
    (mod) => mod.type === "hanging-rail",
  ).length;
  if (existing >= MAX_RAILS_PER_BAY) return false;
  const ys = canonicalRailYs(existing + 1, wardrobeHeight, carcassHeight);
  return ys.length > existing;
}

/**
 * Prefer placing a new shelf on an existing global line so bays stay aligned.
 * Only considers the main carcass (below the construction shelf).
 */
export function findAlignedShelfY(
  allModules: Module[],
  bayId: string,
  wardrobeHeight: number,
  carcassHeight = 2000,
): number | null {
  const shelfHeight = MODULE_HEIGHTS.shelf;
  const bayModules = allModules.filter((mod) => mod.bayId === bayId);
  const obstacles = bayModules.filter((mod) => mod.type !== "shelf");

  // Drawer bays: always even-space in the pocket above drawers (caller)
  if (obstacles.some((mod) => mod.type === "drawer-pack")) {
    return null;
  }

  const free = freeSpansInMainZone(obstacles, wardrobeHeight, carcassHeight, {
    reserveJacketSpace: true,
  }).filter((span) => fitsInSpan(span, shelfHeight));
  if (free.length === 0) return null;

  const globalLines = globalShelfLines(allModules, { ignoreBayId: bayId });
  const occupiedInBay = new Set(
    bayModules.filter((mod) => mod.type === "shelf").map((mod) => mod.y),
  );

  for (const line of globalLines) {
    if (occupiedInBay.has(line)) continue;
    const fits = free.some(
      (span) => line >= span.start && line + shelfHeight <= span.end,
    );
    if (fits && isFree(line, shelfHeight, obstacles)) {
      return line;
    }
  }

  // No shared line free — fall back to even redistribute (caller handles)
  return null;
}

export function findDrawerPlacementY(
  height: number,
  bayModules: Module[],
  wardrobeHeight: number,
): number | null {
  const blocked = blockedForPlacement(bayModules, wardrobeHeight, {
    reserveJacketSpace: false,
  });
  const free = freeSpans(blocked, wardrobeHeight).filter((span) =>
    fitsInSpan(span, height),
  );
  if (free.length === 0) return null;

  const floorPocket = free.find(
    (span) => Math.abs(span.end - wardrobeHeight) < 0.5,
  );
  if (floorPocket) {
    return placeInSpan(floorPocket, height, "end", wardrobeHeight);
  }

  free.sort((a, b) => b.end - a.end || b.end - b.start - (a.end - a.start));
  return placeInSpan(free[0], height, "end", wardrobeHeight);
}

export function findHangingRailPlacementY(
  bayModules: Module[],
  wardrobeHeight: number,
  carcassHeight = 2000,
): number | null {
  const existing = bayModules.filter(
    (mod) => mod.type === "hanging-rail",
  ).length;
  if (existing >= MAX_RAILS_PER_BAY) return null;
  const ys = canonicalRailYs(existing + 1, wardrobeHeight, carcassHeight);
  if (ys.length <= existing) return null;
  return ys[existing] ?? null;
}

/**
 * Snap a dragged shelf onto:
 * — pocket centre (preferred “middle” of the clear span)
 * — 10 mm steps around that middle
 * — otherwise 10 mm gap from the board above / floor below
 */
function snapShelfDragY(
  desiredY: number,
  height: number,
  others: Module[],
  wardrobeHeight: number,
  zoneTop: number,
): number {
  const maxY = floorY(height, wardrobeHeight);
  const mid = desiredY + height / 2;
  let upperEnd = zoneTop;
  let lowerStart = wardrobeHeight;

  for (const mod of others) {
    const bottom = mod.y + mod.height;
    if (bottom <= mid + 0.5) {
      upperEnd = Math.max(upperEnd, bottom);
    }
    if (mod.y >= mid - 0.5) {
      lowerStart = Math.min(lowerStart, mod.y);
    }
  }

  const pocketFree = lowerStart - upperEnd - height;
  if (pocketFree >= 0) {
    // Centre of this pocket, plus a 10 mm ladder around it
    const centerY = Math.round(upperEnd + pocketFree / 2);
    const candidates: number[] = [centerY];
    for (let d = DRAG_SNAP_MM; d <= pocketFree; d += DRAG_SNAP_MM) {
      candidates.push(centerY - d, centerY + d);
    }
    let best = centerY;
    let bestDist = Math.abs(desiredY - centerY);
    for (const y of candidates) {
      if (y < upperEnd - 0.5 || y > lowerStart - height + 0.5) continue;
      const clamped = Math.min(maxY, Math.max(zoneTop, y));
      const dist = Math.abs(desiredY - clamped);
      if (dist < bestDist) {
        best = clamped;
        bestDist = dist;
      }
    }
    // Prefer centre / middle-grid when within a generous pull distance
    if (bestDist <= Math.max(SHELF_ALIGN_MAGNET_MM * 2, 48)) {
      return Math.min(maxY, Math.max(zoneTop, best));
    }
  }

  const isBottomShelf = lowerStart >= wardrobeHeight - 0.5;

  if (isBottomShelf) {
    // Snap clear air under the shelf to the floor: 300, 310, 320, …
    const rawGapBelow = wardrobeHeight - (desiredY + height);
    let snappedGapBelow =
      Math.round(rawGapBelow / DRAG_SNAP_MM) * DRAG_SNAP_MM;
    snappedGapBelow = Math.max(0, snappedGapBelow);

    let y = wardrobeHeight - height - snappedGapBelow;
    y = Math.min(maxY, Math.max(zoneTop, y));

    if (y < upperEnd) {
      const maxGapBelow =
        Math.floor((wardrobeHeight - height - upperEnd) / DRAG_SNAP_MM) *
        DRAG_SNAP_MM;
      y = wardrobeHeight - height - Math.max(0, maxGapBelow);
      y = Math.min(maxY, Math.max(zoneTop, y));
    }

    return y;
  }

  // Not the bottom shelf — snap the gap above (300, 310, …)
  const rawGap = desiredY - upperEnd;
  let snappedGap = Math.round(rawGap / DRAG_SNAP_MM) * DRAG_SNAP_MM;
  snappedGap = Math.max(0, snappedGap);

  let y = upperEnd + snappedGap;
  const maxFit = lowerStart - height;
  if (y > maxFit) {
    const maxGap =
      Math.floor((maxFit - upperEnd) / DRAG_SNAP_MM) * DRAG_SNAP_MM;
    y = upperEnd + Math.max(0, maxGap);
  }

  return Math.min(maxY, Math.max(zoneTop, y));
}

/** @deprecated kept for non-shelf fittings that still snap by gap-above */
function snapDragByGapAbove(
  desiredY: number,
  height: number,
  others: Module[],
  wardrobeHeight: number,
  zoneTop: number,
): number {
  return snapShelfDragY(
    desiredY,
    height,
    others,
    wardrobeHeight,
    zoneTop,
  );
}

/**
 * Snap + push a dragged module out of collisions.
 * Drawer packs strongly magnet to the floor.
 * Manual drag snaps clearances to 10 mm.
 * Shelves also magnet onto shelf lines from bays to the left.
 */
export function resolveModuleY(
  target: Module,
  desiredY: number,
  bayModules: Module[],
  wardrobeHeight: number,
  allModules?: Module[],
  carcassHeight = 2000,
  bays?: Pick<Bay, "id" | "index">[],
): number {
  const maxY = floorY(target.height, wardrobeHeight);
  const others = bayModules.filter((mod) => mod.id !== target.id);
  const clampedDesired = Math.min(Math.max(0, desiredY), maxY);
  const step = DRAG_SNAP_MM;
  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);

  // --- Drawer packs: always allow returning flush to the floor ---
  if (target.type === "drawer-pack") {
    const floorFree = isFree(maxY, target.height, others);
    const dragDown = clampedDesired >= target.y - 1;
    const nearFloor = clampedDesired >= maxY - step * 4;
    const lowerHalf = clampedDesired >= maxY * 0.35;

    if (floorFree && (nearFloor || (dragDown && lowerHalf))) {
      return maxY;
    }

    if (floorFree && clampedDesired >= maxY - step * 6) {
      return maxY;
    }
  }

  // --- Shelves: main align grid from neighbour bays, else centre + 10 mm ---
  if (target.type === "shelf") {
    const rails = others.filter((mod) => mod.type === "hanging-rail");
    let constrained = clampedDesired;

    for (const rail of rails) {
      const maxAbove =
        rail.y - SHELF_ABOVE_RAIL_GAP_MM - target.height;
      const minBelow = rail.y + rail.height + JACKET_CLEARANCE_MM;
      const railMid = rail.y + rail.height / 2;

      if (constrained + target.height / 2 <= railMid) {
        constrained = Math.min(constrained, maxAbove);
        constrained = Math.max(constrained, zoneTop);
      } else {
        constrained = Math.max(constrained, minBelow);
      }
    }

    const alignLines =
      allModules && bays
        ? neighborShelfAlignLines(allModules, bays, target.bayId, {
            ignoreId: target.id,
          })
        : [];
    const aligned = nearestShelfAlignLine(constrained, alignLines);
    if (
      aligned != null &&
      aligned >= zoneTop &&
      aligned <= maxY &&
      isBodyFree(aligned, target.height, others)
    ) {
      return aligned;
    }

    // Pocket centre + 10 mm ladder around the middle (above / below bay)
    const snapped = snapShelfDragY(
      constrained,
      target.height,
      others,
      wardrobeHeight,
      zoneTop,
    );
    if (isBodyFree(snapped, target.height, others)) {
      return snapped;
    }

    // Walk the 10 mm gap ladder until a free slot is found
    for (let delta = step; delta <= wardrobeHeight; delta += step) {
      for (const candidate of [constrained + delta, constrained - delta]) {
        const next = snapShelfDragY(
          candidate,
          target.height,
          others,
          wardrobeHeight,
          zoneTop,
        );
        if (
          next >= zoneTop &&
          next <= maxY &&
          isBodyFree(next, target.height, others)
        ) {
          return next;
        }
      }
    }

    return snapShelfDragY(
      target.y,
      target.height,
      others,
      wardrobeHeight,
      zoneTop,
    );
  }

  // Rails are fixed: 50 mm from top, +900 mm for the second
  if (target.type === "hanging-rail") {
    const rails = [target, ...others.filter((mod) => mod.type === "hanging-rail")]
      .sort((a, b) => a.y - b.y);
    const ys = canonicalRailYs(rails.length, wardrobeHeight, carcassHeight);
    const index = rails.findIndex((mod) => mod.id === target.id);
    if (index >= 0 && ys[index] !== undefined) {
      return ys[index];
    }
    return Math.max(zoneTop + RAIL_FROM_TOP_MM, zoneTop);
  }

  if (
    clampedDesired >= maxY - step * 3 &&
    isFree(maxY, target.height, others)
  ) {
    return maxY;
  }

  const y = snapDragByGapAbove(
    clampedDesired,
    target.height,
    others,
    wardrobeHeight,
    zoneTop,
  );
  if (isFree(y, target.height, others)) {
    return y;
  }

  if (isFree(maxY, target.height, others) && clampedDesired >= maxY * 0.4) {
    return maxY;
  }

  // Nudge in 10 mm gap steps until a free slot is found
  let delta = step;
  while (delta <= wardrobeHeight) {
    for (const candidate of [clampedDesired + delta, clampedDesired - delta]) {
      const snapped = snapDragByGapAbove(
        candidate,
        target.height,
        others,
        wardrobeHeight,
        zoneTop,
      );
      if (
        snapped >= 0 &&
        snapped <= maxY &&
        isFree(snapped, target.height, others)
      ) {
        return snapped;
      }
    }
    delta += step;
  }

  if (isFree(maxY, target.height, others)) return maxY;
  return target.y;
}

/** Force a module (usually drawers) flush to the wardrobe floor if free. */
export function resolveFloorY(
  target: Module,
  bayModules: Module[],
  wardrobeHeight: number,
): number {
  const maxY = floorY(target.height, wardrobeHeight);
  const others = bayModules.filter((mod) => mod.id !== target.id);
  if (isFree(maxY, target.height, others)) return maxY;

  // Closest free pocket bottom edge
  const blocked = blockedForPlacement(others, wardrobeHeight, {
    reserveJacketSpace: false,
  });
  const free = freeSpans(blocked, wardrobeHeight)
    .filter((span) => fitsInSpan(span, target.height))
    .sort((a, b) => b.end - a.end);

  if (free.length === 0) return target.y;
  return placeInSpan(free[0], target.height, "end", wardrobeHeight);
}
