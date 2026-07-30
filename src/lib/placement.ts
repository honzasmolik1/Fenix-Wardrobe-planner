import {
  JACKET_CLEARANCE_MM,
  MODULE_CLEARANCE_MM,
  MODULE_HEIGHTS,
  SHELF_ABOVE_RAIL_GAP_MM,
  SNAP_INCREMENT_MM,
  mainZoneTop,
} from "@/lib/constants";
import type { Module } from "@/store/store";

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
 * Snap to system 32, but keep flush-to-floor when near the bottom.
 */
function snapY(
  y: number,
  height: number,
  wardrobeHeight: number,
): number {
  const maxY = floorY(height, wardrobeHeight);

  // Generous floor magnet — drawers were getting stuck floating
  if (y >= maxY - SNAP_INCREMENT_MM * 3) {
    return maxY;
  }

  const snapped = Math.round(y / SNAP_INCREMENT_MM) * SNAP_INCREMENT_MM;
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

function evenShelfPositions(
  span: Span,
  count: number,
  shelfHeight: number,
): number[] {
  const spanHeight = span.end - span.start;
  const totalShelfHeight = count * shelfHeight;

  if (count <= 0) return [];

  if (totalShelfHeight >= spanHeight) {
    return Array.from({ length: count }, (_, index) =>
      Math.min(
        span.start + index * shelfHeight,
        Math.max(span.start, span.end - shelfHeight),
      ),
    );
  }

  const gap = (spanHeight - totalShelfHeight) / (count + 1);
  return Array.from({ length: count }, (_, index) =>
    Math.round(span.start + gap + index * (shelfHeight + gap)),
  );
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

function isFree(y: number, height: number, others: Module[]): boolean {
  return others.every((mod) => !overlaps(y, height, mod));
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
 * — shelves below start JACKET_CLEARANCE_MM under the rail, then even to floor
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
  const belowStartY = rail.y + rail.height + JACKET_CLEARANCE_MM;

  const drawers = otherObstacles.filter((mod) => mod.type === "drawer-pack");
  const zoneBottom = drawers.reduce(
    (min, drawer) => Math.min(min, drawer.y - MODULE_CLEARANCE_MM),
    wardrobeHeight,
  );

  const canPlaceAbove =
    firstAboveY >= zoneTop &&
    firstAboveY + shelfHeight <= rail.y - SHELF_ABOVE_RAIL_GAP_MM + 0.5;

  // Prefer filling above first (user asked for shelves above the rail),
  // then place leftovers below the 1000 mm hang zone.
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
    const belowSpan: Span = {
      start: belowStartY,
      end: zoneBottom,
    };
    if (belowCount === 1) {
      positions.push(
        Math.min(
          Math.round(belowStartY),
          Math.max(belowStartY, zoneBottom - shelfHeight),
        ),
      );
    } else {
      positions.push(
        ...evenShelfPositions(belowSpan, belowCount, shelfHeight),
      );
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
 * shelf). With a hanging rail, uses 100 mm above / 1000 mm hang rules.
 */
export function redistributeShelvesEvenly(
  modules: Module[],
  bayId: string,
  wardrobeHeight: number,
  options: { forceEven?: boolean; carcassHeight?: number } = {},
): Module[] {
  const carcassHeight = options.carcassHeight ?? 2000;
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

  let positions: number[];

  if (rails.length > 0) {
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
    const free = freeSpansInMainZone(obstacles, wardrobeHeight, carcassHeight, {
      reserveJacketSpace: true,
    })
      .filter((span) => fitsInSpan(span, shelfHeight))
      .sort((a, b) => b.end - b.start - (a.end - a.start));

    const span = shelfPlacementSpan(
      free,
      obstacles,
      shelves.length,
      shelfHeight,
    );
    if (!span) return modules;

    const count = shelves.length;
    const placeCount = canFitShelves(span, count, shelfHeight)
      ? count
      : Math.max(1, Math.floor((span.end - span.start) / shelfHeight));

    if (options.forceEven) {
      positions = evenShelfPositions(span, placeCount, shelfHeight);
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
        const even = evenShelfPositions(span, placeCount, shelfHeight).filter(
          (y) =>
            ![...used].some((line) => Math.abs(line - y) < SNAP_INCREMENT_MM),
        );
        positions = [...used, ...even.slice(0, remaining)].sort((a, b) => a - b);
      } else {
        positions = evenShelfPositions(span, placeCount, shelfHeight);
      }
    }
  }

  if (positions.length === 0) return modules;

  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);
  const maxY = Math.max(zoneTop, wardrobeHeight - shelfHeight);

  return modules.map((mod) => {
    if (mod.bayId !== bayId || mod.type !== "shelf") return mod;
    const index = shelves.findIndex((shelf) => shelf.id === mod.id);
    if (index < 0 || index >= positions.length) return mod;
    const y = Math.min(Math.max(zoneTop, positions[index] ?? mod.y), maxY);
    return { ...mod, y };
  });
}

/** Force evenly spaced shelves (rail rules apply when a rail is present). */
export function evenSpaceShelvesInBay(
  modules: Module[],
  bayId: string,
  wardrobeHeight: number,
  carcassHeight = 2000,
): Module[] {
  return redistributeShelvesEvenly(modules, bayId, wardrobeHeight, {
    forceEven: true,
    carcassHeight,
  });
}

/** Returns false when there is no free pocket left for another shelf. */
export function canAddShelf(
  bayModules: Module[],
  wardrobeHeight: number,
  carcassHeight = 2000,
): boolean {
  const shelfHeight = MODULE_HEIGHTS.shelf;
  const nextCount =
    bayModules.filter((mod) => mod.type === "shelf").length + 1;
  const obstacles = bayModules.filter((mod) => mod.type !== "shelf");
  const free = freeSpansInMainZone(obstacles, wardrobeHeight, carcassHeight, {
    reserveJacketSpace: true,
  });
  return free.some((span) => canFitShelves(span, nextCount, shelfHeight));
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
): number | null {
  const height = MODULE_HEIGHTS["hanging-rail"];
  const blocked = blockedForPlacement(bayModules, wardrobeHeight, {
    reserveJacketSpace: false,
  });
  const free = freeSpans(blocked, wardrobeHeight).filter((span) =>
    fitsInSpan(span, height),
  );
  if (free.length === 0) return null;

  let bestY: number | null = null;
  let bestScore = -Infinity;

  for (const span of free) {
    const minY = span.start;
    const maxY = span.end - height;

    for (let y = minY; y <= maxY; y += SNAP_INCREMENT_MM) {
      const underside = y + height;

      let obstacle = wardrobeHeight;
      for (const mod of bayModules) {
        if (mod.y >= underside) {
          obstacle = Math.min(obstacle, mod.y);
        }
      }
      const clearBelow = obstacle - underside;

      let score = 0;
      if (clearBelow >= JACKET_CLEARANCE_MM) {
        score += 1000 + clearBelow;
        const spaceAbove = y - span.start;
        if (spaceAbove >= MODULE_HEIGHTS.shelf + MODULE_CLEARANCE_MM) {
          score += 200 + spaceAbove;
        }
      } else {
        score += clearBelow;
      }

      score -= Math.abs(y - wardrobeHeight * 0.2) * 0.05;

      if (score > bestScore) {
        bestScore = score;
        bestY = snapY(y, height, wardrobeHeight);
      }
    }
  }

  return bestY;
}

/**
 * Snap + push a dragged module out of collisions.
 * Drawer packs strongly magnet to the floor.
 * Shelves snap onto global alignment lines from other bays.
 */
export function resolveModuleY(
  target: Module,
  desiredY: number,
  bayModules: Module[],
  wardrobeHeight: number,
  allModules?: Module[],
  carcassHeight = 2000,
): number {
  const maxY = floorY(target.height, wardrobeHeight);
  const others = bayModules.filter((mod) => mod.id !== target.id);
  const clampedDesired = Math.min(Math.max(0, desiredY), maxY);

  // --- Drawer packs: always allow returning flush to the floor ---
  if (target.type === "drawer-pack") {
    const floorFree = isFree(maxY, target.height, others);
    const dragDown = clampedDesired >= target.y - 1;
    const nearFloor = clampedDesired >= maxY - SNAP_INCREMENT_MM * 4;
    const lowerHalf = clampedDesired >= maxY * 0.35;

    if (floorFree && (nearFloor || (dragDown && lowerHalf))) {
      return maxY;
    }

    if (floorFree && clampedDesired >= maxY - SNAP_INCREMENT_MM * 6) {
      return maxY;
    }
  }

  // --- Shelves: keep 100 mm above rails / 1000 mm hang clearance below ---
  if (target.type === "shelf") {
    const rails = others.filter((mod) => mod.type === "hanging-rail");
    let constrained = clampedDesired;
    const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);

    for (const rail of rails) {
      const maxAbove =
        rail.y - SHELF_ABOVE_RAIL_GAP_MM - target.height;
      const minBelow = rail.y + rail.height + JACKET_CLEARANCE_MM;
      const railMid = rail.y + rail.height / 2;

      if (constrained + target.height / 2 <= railMid) {
        // Placing / dragging above the rail
        constrained = Math.min(constrained, maxAbove);
        constrained = Math.max(constrained, zoneTop);
      } else {
        // Placing / dragging below — first legal shelf starts 1 m under rail
        constrained = Math.max(constrained, minBelow);
      }
    }

    if (allModules) {
      const lines = globalShelfLines(allModules, { ignoreId: target.id });
      const aligned = nearestLine(constrained, lines);
      if (
        aligned !== null &&
        Math.abs(aligned - constrained) <= SNAP_INCREMENT_MM * 2 &&
        aligned <= maxY &&
        isFree(aligned, target.height, others)
      ) {
        // Only accept alignment if it still respects rail clearances
        const ok = rails.every((rail) => {
          const shelfBottom = aligned + target.height;
          const aboveOk =
            shelfBottom <= rail.y - SHELF_ABOVE_RAIL_GAP_MM + 0.5;
          const belowOk =
            aligned >= rail.y + rail.height + JACKET_CLEARANCE_MM - 0.5;
          return aboveOk || belowOk;
        });
        if (ok || rails.length === 0) return aligned;
      }
    }

    const snapped = snapY(constrained, target.height, wardrobeHeight);
    if (isFree(snapped, target.height, others)) {
      return snapped;
    }
  }

  if (
    clampedDesired >= maxY - SNAP_INCREMENT_MM * 3 &&
    isFree(maxY, target.height, others)
  ) {
    return maxY;
  }

  const y = snapY(clampedDesired, target.height, wardrobeHeight);
  if (isFree(y, target.height, others)) {
    return y;
  }

  if (isFree(maxY, target.height, others) && clampedDesired >= maxY * 0.4) {
    return maxY;
  }

  // Prefer searching downward first when the user is dragging down
  const preferDown = clampedDesired >= target.y;

  for (
    let delta = SNAP_INCREMENT_MM;
    delta <= wardrobeHeight;
    delta += SNAP_INCREMENT_MM
  ) {
    const first = preferDown
      ? snapY(clampedDesired + delta, target.height, wardrobeHeight)
      : snapY(clampedDesired - delta, target.height, wardrobeHeight);
    const second = preferDown
      ? snapY(clampedDesired - delta, target.height, wardrobeHeight)
      : snapY(clampedDesired + delta, target.height, wardrobeHeight);

    if (first >= 0 && first <= maxY && isFree(first, target.height, others)) {
      return first;
    }
    if (second >= 0 && second <= maxY && isFree(second, target.height, others)) {
      return second;
    }
  }

  if (isFree(maxY, target.height, others)) return maxY;

  return Math.min(Math.max(0, target.y), maxY);
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
