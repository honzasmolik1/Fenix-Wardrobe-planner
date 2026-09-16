import type { Bay, Module } from "@/store/store";
import {
  DEFAULT_TV_INCHES,
  DEFAULT_TV_MOUNT,
  getTvPreset,
  tvOpeningFromSelection,
  type TvMountType,
} from "@/lib/tvSizes";

/** Board / shelf / wall thickness — carcass panels are 18 mm. */
export const BOARD_THICKNESS_MM = 18;

export interface TvNiche {
  startBayIndex: number;
  /**
   * Physical carcass columns under the TV span.
   * Always max(aboveColumnCount, belowColumnCount).
   */
  bayCount: number;
  /** Clear TV opening height (inside the recess), mm */
  height: number;
  /**
   * Distance from the bottom of the kicker (or unit bottom if no kicker)
   * up to the underside of the TV opening / top of the lower 18 mm board.
   */
  bottomFromKicker: number;
  /**
   * Column count above the TV (1 = no uprights, one wide pocket).
   * Independent from belowColumnCount.
   */
  aboveColumnCount: number;
  /**
   * Column count below the TV (1 = no uprights, one wide pocket).
   * Independent from aboveColumnCount.
   */
  belowColumnCount: number;
  /** Derived: aboveColumnCount > 1 */
  divideAbove: boolean;
  /** Derived: belowColumnCount > 1 */
  divideBelow: boolean;
  /**
   * When true, uprights are drawn as a double wall (two boards → three
   * vertical lines), matching the TV surround style.
   */
  doubleWallUprights: boolean;
  /** Wall mount vs freestanding with feet / pedestal */
  mountType: TvMountType;
  /** Selected diagonal inches (for presets / model filter) */
  selectedInches: number | null;
  /** Specific brand model id, or null for generic screen size */
  tvModelId: string | null;
  /** Extra clearance on each edge of the TV opening, mm */
  bezelMm: number;
  /** Target TV opening width in mm */
  width: number;
  /** Shelf count in the above-TV bay pocket(s) */
  aboveShelfCount: number;
  /** Shelf count in the below-TV bay pocket(s) */
  belowShelfCount: number;
}

export type TvBayZone = "above" | "below";

export const DEFAULT_KICKER_HEIGHT_MM = 100;
/** Wardrobe carcass inside depth (mm). */
export const DEFAULT_WARDROBE_DEPTH_INSIDE_MM = 450;
/** Wardrobe overall depth including doors / returns (mm). */
export const DEFAULT_WARDROBE_DEPTH_TOTAL_MM = 600;
/** TV / media unit inside depth (mm). */
export const DEFAULT_MEDIA_DEPTH_INSIDE_MM = 350;
/** TV / media unit overall depth (mm). */
export const DEFAULT_MEDIA_DEPTH_TOTAL_MM = 500;
/** @deprecated use DEFAULT_WARDROBE_DEPTH_INSIDE_MM */
export const DEFAULT_UNIT_DEPTH_MM = DEFAULT_WARDROBE_DEPTH_INSIDE_MM;

export function resolveUnitDepths(
  wardrobe: { depth?: number; depthTotal?: number },
  mode: "wardrobe" | "media" = "wardrobe",
): { depth: number; depthTotal: number } {
  const insideDefault =
    mode === "media"
      ? DEFAULT_MEDIA_DEPTH_INSIDE_MM
      : DEFAULT_WARDROBE_DEPTH_INSIDE_MM;
  const totalDefault =
    mode === "media"
      ? DEFAULT_MEDIA_DEPTH_TOTAL_MM
      : DEFAULT_WARDROBE_DEPTH_TOTAL_MM;
  const depth = wardrobe.depth ?? insideDefault;
  const depthTotal = Math.max(depth, wardrobe.depthTotal ?? totalDefault);
  return { depth, depthTotal };
}

export function unitMeasurementLines(
  wardrobe: {
    width: number;
    height: number;
    depth?: number;
    depthTotal?: number;
  },
  mode: "wardrobe" | "media",
): string[] {
  const { depth, depthTotal } = resolveUnitDepths(wardrobe, mode);
  if (mode === "media") {
    return [
      `Length ${wardrobe.width} mm`,
      `Width ${wardrobe.height} mm`,
      `Depth inside ${depth} mm`,
    ];
  }
  return [
    `Length ${wardrobe.width} mm`,
    `Width ${wardrobe.height} mm`,
    `Depth inside ${depth} mm`,
    `Depth total ${depthTotal} mm`,
  ];
}

export function unitQuoteCopy(
  wardrobe: {
    width: number;
    height: number;
    depth?: number;
    depthTotal?: number;
  },
  mode: "wardrobe" | "media",
): { dimensions: string; measurements: string } {
  return {
    dimensions: `${wardrobe.width} × ${wardrobe.height} mm`,
    measurements: unitMeasurementLines(wardrobe, mode).join("\n"),
  };
}

/** Printed on TV / media unit pages only. */
export const TV_SIZE_DISCLAIMER =
  "Television openings and related measurements are indicative only. Screen sizes, bezels and mounting requirements vary by manufacturer and model. The client must confirm and approve the television size before manufacture.";

/** Matches base 50" screen; bottom defaults to 800 mm from floor/kicker. */
export const DEFAULT_TV_BOTTOM_FROM_FLOOR_MM = 800;

const baseTvPreset = getTvPreset(DEFAULT_TV_INCHES)!;
const baseTvOpening = tvOpeningFromSelection({
  inches: DEFAULT_TV_INCHES,
  mount: DEFAULT_TV_MOUNT,
});

export const DEFAULT_TV_NICHE: TvNiche = {
  startBayIndex: 2,
  bayCount: 2,
  height: baseTvOpening.heightMm,
  bottomFromKicker: DEFAULT_TV_BOTTOM_FROM_FLOOR_MM,
  // Uprights off until the user enables above / below separately
  aboveColumnCount: 1,
  belowColumnCount: 1,
  divideAbove: false,
  divideBelow: false,
  doubleWallUprights: true,
  mountType: DEFAULT_TV_MOUNT,
  selectedInches: DEFAULT_TV_INCHES,
  tvModelId: null,
  bezelMm: 0,
  width: baseTvOpening.widthMm,
  aboveShelfCount: 1,
  belowShelfCount: 2,
};

export const MIN_TV_WIDTH_MM = 400;
/** Soft minimum for side columns — keep low enough that a 1000 TV fits on 2800. */
export const MIN_OUTER_BAY_WIDTH_MM = 250;

/** Clear shelf openings under the TV in the sample layout. */
export const DEFAULT_BELOW_TV_CLEAR_MM = 275;

const createId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Even clearances between zone edges and shelves.
 * Leftover mm (when free space does not divide evenly) goes on the bottom
 * gap by default, or the top gap when `remainder` is `"top"`.
 */
function evenShelfYs(
  count: number,
  zoneTop: number,
  zoneBottom: number,
  shelfHeight: number,
  remainder: "bottom" | "top" = "bottom",
): number[] {
  if (count <= 0) return [];
  const top = Math.round(zoneTop);
  const bottom = Math.round(zoneBottom);
  const span = bottom - top;
  const totalShelf = count * shelfHeight;
  if (span <= totalShelf) {
    return Array.from({ length: count }, (_, index) =>
      Math.min(bottom - shelfHeight, top + index * shelfHeight),
    );
  }

  const gapCount = count + 1;
  const free = span - totalShelf;
  const baseGap = Math.floor(free / gapCount);
  const rem = free - baseGap * gapCount;
  const gaps = Array.from({ length: gapCount }, () => baseGap);
  if (gapCount > 0 && rem > 0) {
    if (remainder === "top") gaps[0] += rem;
    else gaps[gapCount - 1] += rem;
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

/** Split a total width into `count` parts as equal as possible.
 * Leftover mm goes on the last part (rightmost / bottom convention).
 */
function splitEqualWidths(total: number, count: number): number[] {
  if (count <= 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const base = Math.floor(safeTotal / count);
  const rem = safeTotal - base * count;
  const widths = Array.from({ length: count }, () => base);
  if (count > 0 && rem > 0) {
    widths[count - 1] += rem;
  }
  return widths;
}

/** Equal bay widths for a media / TV bookcase. */
export function createMediaBays(width: number, count = 6): Bay[] {
  const safeCount = Math.max(2, Math.min(10, Math.round(count)));
  const safeWidth = Math.max(1200, Math.round(width));
  const widths = splitEqualWidths(safeWidth, safeCount);
  return Array.from({ length: safeCount }, (_, index) => ({
    id: createId(),
    index,
    width: widths[index] ?? Math.floor(safeWidth / safeCount),
  }));
}

/**
 * Geometry of the TV assembly in interior coords (y from top of carcass).
 *
 * The TV is bottom-anchored: `bottomFromKicker` fixes the underside of the
 * opening. Changing height grows/shrinks upward only — the bottom never moves.
 */
export function tvNicheAssembly(
  niche: TvNiche,
  unitHeight: number,
  kickerMm: number,
): {
  /** Clear opening */
  opening: { y: number; height: number };
  /** 18 mm board above the opening (ceiling of TV / floor of upper bay) */
  topBoard: { y: number; height: number };
  /** 18 mm board below the opening (floor of TV / ceiling of lower bay) */
  bottomBoard: { y: number; height: number };
  /** Upper bay pocket (top of carcass → top board) */
  aboveBay: { start: number; end: number };
  /** Lower bay pocket (bottom board underside → floor) */
  belowBay: { start: number; end: number };
  /** Full blocked span for fittings (top board + opening + bottom board) */
  blocked: { start: number; end: number };
} {
  const board = BOARD_THICKNESS_MM;
  const kicker = Math.max(0, Math.round(kickerMm));
  const fromKicker = Math.max(0, Math.round(niche.bottomFromKicker));

  // Bottom of opening from interior floor — THIS stays fixed when height changes
  const openingBottomFromFloor = Math.max(0, fromKicker - kicker);
  let bottomBoardY = unitHeight - openingBottomFromFloor;
  bottomBoardY = Math.max(board, Math.min(unitHeight - board, bottomBoardY));

  // Grow upward from the fixed bottom; shrink height if it hits the ceiling
  const maxOpeningH = Math.max(0, bottomBoardY - board);
  const openingH = Math.max(
    0,
    Math.min(maxOpeningH, Math.max(200, Math.round(niche.height))),
  );
  let openingY = bottomBoardY - openingH;
  let topBoardY = openingY - board;

  if (topBoardY < 0) {
    // Not enough room — shorten the opening; keep bottomBoardY
    topBoardY = 0;
    openingY = board;
  }

  const openingHeight = Math.max(0, bottomBoardY - openingY);

  return {
    opening: { y: openingY, height: openingHeight },
    topBoard: { y: topBoardY, height: board },
    bottomBoard: { y: bottomBoardY, height: board },
    aboveBay: { start: 0, end: topBoardY },
    belowBay: {
      start: bottomBoardY + board,
      end: unitHeight,
    },
    blocked: {
      start: topBoardY,
      end: bottomBoardY + board,
    },
  };
}

/**
 * Bottom-from-kicker that makes the first clear pocket above the TV the same
 * height as the first clear pocket below it (TV opening size stays put).
 * Odd leftover mm goes to the above pocket.
 */
export function evenTvFirstCompartmentBottomFromKicker(
  niche: TvNiche,
  unitHeight: number,
  kickerMm: number,
): number {
  const board = BOARD_THICKNESS_MM;
  const kicker = Math.max(0, Math.round(kickerMm));
  const openingH = Math.max(200, Math.round(niche.height));
  const flex = unitHeight - openingH - 2 * board;
  const targetBelow = Math.max(0, Math.floor(flex / 2));
  return kicker + board + targetBelow;
}

/** @deprecated prefer tvNicheAssembly — kept for simple opening rect */
export function tvNicheRect(
  niche: TvNiche,
  unitHeight: number,
  kickerMm = 0,
): { y: number; height: number } {
  return tvNicheAssembly(niche, unitHeight, kickerMm).opening;
}

/**
 * Sample media layout:
 * — Outer columns: full-height evenly spaced shelves
 * — TV opening: one continuous recess (never split by upright)
 * — Above / below: independently adjustable shelf counts (even in each pocket)
 */
export function createMediaModules(
  bays: Bay[],
  unitHeight: number,
  niche: TvNiche | null = DEFAULT_TV_NICHE,
  kickerMm = DEFAULT_KICKER_HEIGHT_MM,
): Module[] {
  const shelfH = BOARD_THICKNESS_MM;
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const outerShelfYs = evenShelfYs(4, 0, unitHeight, shelfH);

  if (!niche) {
    const modules: Module[] = [];
    for (const bay of sorted) {
      for (const y of outerShelfYs) {
        modules.push({
          id: createId(),
          type: "shelf",
          bayId: bay.id,
          y,
          height: shelfH,
        });
      }
    }
    return modules;
  }

  const nicheStart = Math.max(0, niche.startBayIndex);
  const nicheEnd = Math.min(
    sorted.length - 1,
    niche.startBayIndex + niche.bayCount - 1,
  );
  const assembly = tvNicheAssembly(niche, unitHeight, kickerMm);
  const primaryBay = sorted.find((bay) => bay.index === nicheStart);
  const divideAbove = niche.divideAbove === true;
  const divideBelow = niche.divideBelow === true;
  const aboveCount = Math.max(
    0,
    Math.min(8, Math.round(niche.aboveShelfCount ?? 1)),
  );
  const belowCount = Math.max(
    0,
    Math.min(8, Math.round(niche.belowShelfCount ?? 2)),
  );

  // Remainder away from the TV so the first pocket above and below match.
  const aboveYs = evenShelfYs(
    aboveCount,
    assembly.aboveBay.start,
    assembly.aboveBay.end,
    shelfH,
    "top",
  );
  const belowYs = evenShelfYs(
    belowCount,
    assembly.belowBay.start,
    assembly.belowBay.end,
    shelfH,
    "bottom",
  );

  const modules: Module[] = [];

  for (const bay of sorted) {
    const inNiche = bay.index >= nicheStart && bay.index <= nicheEnd;

    if (!inNiche) {
      for (const y of outerShelfYs) {
        modules.push({
          id: createId(),
          type: "shelf",
          bayId: bay.id,
          y,
          height: shelfH,
        });
      }
      continue;
    }

    const isPrimary = Boolean(primaryBay && bay.id === primaryBay.id);

    // Framing boards only on primary (drawn full width on canvas)
    if (isPrimary) {
      modules.push(
        {
          id: createId(),
          type: "shelf",
          bayId: bay.id,
          y: assembly.topBoard.y,
          height: shelfH,
        },
        {
          id: createId(),
          type: "shelf",
          bayId: bay.id,
          y: assembly.bottomBoard.y,
          height: shelfH,
        },
      );
    }

    // Undivided zone → one wide pocket on primary only
    if (divideAbove || isPrimary) {
      for (const y of aboveYs) {
        modules.push({
          id: createId(),
          type: "shelf",
          bayId: bay.id,
          y,
          height: shelfH,
        });
      }
    }
    if (divideBelow || isPrimary) {
      for (const y of belowYs) {
        modules.push({
          id: createId(),
          type: "shelf",
          bayId: bay.id,
          y,
          height: shelfH,
        });
      }
    }
  }

  return modules;
}

/** Primary carcass bay that owns framing boards / undivided fittings. */
export function tvNichePrimaryBayId(
  bays: Bay[],
  niche: TvNiche | null,
): string | null {
  if (!niche) return null;
  const primary = [...bays]
    .sort((a, b) => a.index - b.index)
    .find((bay) => bay.index === niche.startBayIndex);
  return primary?.id ?? null;
}

/** True when the given zone (or both, if omitted) has no vertical uprights. */
export function tvNicheMergesColumns(
  niche: TvNiche | null,
  zone?: TvBayZone,
): boolean {
  if (!niche) return false;
  if (zone === "above") return niche.divideAbove !== true;
  if (zone === "below") return niche.divideBelow !== true;
  return niche.divideAbove !== true && niche.divideBelow !== true;
}

/** True when uprights split the given above/below zone into columns. */
export function tvNicheZoneDivided(
  niche: TvNiche | null,
  zone: TvBayZone,
): boolean {
  return Boolean(niche) && !tvNicheMergesColumns(niche, zone);
}

export function bayInTvNiche(bayIndex: number, niche: TvNiche | null): boolean {
  if (!niche) return false;
  return (
    bayIndex >= niche.startBayIndex &&
    bayIndex < niche.startBayIndex + niche.bayCount
  );
}

/**
 * Clamp TV niche values.
 * Bottom-from-kicker is the anchor: height is limited to what fits above it.
 * Changing height never moves the bottom.
 */
export function clampTvNiche(
  niche: TvNiche,
  bayCount: number,
  unitHeight: number,
  kickerMm = 0,
): TvNiche {
  const startBayIndex = Math.max(
    0,
    Math.min(bayCount - 1, Math.round(niche.startBayIndex)),
  );

  // Per-zone column counts (1 = undivided). Fall back from legacy divide flags.
  const legacySpan = Math.max(1, Math.round(niche.bayCount || 1));
  let aboveColumnCount = Math.round(
    niche.aboveColumnCount ??
      (niche.divideAbove === false ? 1 : legacySpan),
  );
  let belowColumnCount = Math.round(
    niche.belowColumnCount ??
      (niche.divideBelow === false ? 1 : legacySpan),
  );
  aboveColumnCount = Math.max(1, Math.min(8, aboveColumnCount));
  belowColumnCount = Math.max(1, Math.min(8, belowColumnCount));

  // Carcass span: at least enough for zone columns, but may be wider
  // when the TV opening is undivided across multiple equal bays.
  const colSpan = Math.max(aboveColumnCount, belowColumnCount);
  const requestedSpan = Math.max(1, Math.round(niche.bayCount || colSpan));
  const wantedSpan = Math.max(colSpan, requestedSpan);
  const bayCountSpan = Math.max(
    1,
    Math.min(bayCount - startBayIndex, wantedSpan),
  );
  // If unit can't fit wanted columns, shrink zone counts to match
  if (bayCountSpan < aboveColumnCount) aboveColumnCount = bayCountSpan;
  if (bayCountSpan < belowColumnCount) belowColumnCount = bayCountSpan;

  const board = BOARD_THICKNESS_MM;
  const kicker = Math.max(0, kickerMm);
  const totalStack = unitHeight + kicker;

  // --- Anchor bottom first (from kicker) ---
  const minFromKicker = kicker + board;
  // Leave room for top board + minimum opening above the bottom
  const maxFromKicker = Math.max(
    minFromKicker,
    totalStack - board - 200,
  );
  const bottomFromKicker = Math.max(
    minFromKicker,
    Math.min(maxFromKicker, Math.round(niche.bottomFromKicker)),
  );

  // --- Height grows upward from that fixed bottom ---
  const openingBottomFromFloor = bottomFromKicker - kicker;
  const bottomBoardY = unitHeight - openingBottomFromFloor;
  const maxHeight = Math.max(200, bottomBoardY - board);
  const height = Math.max(
    200,
    Math.min(maxHeight, Math.round(niche.height)),
  );

  return {
    startBayIndex,
    bayCount: bayCountSpan,
    height,
    bottomFromKicker,
    aboveColumnCount,
    belowColumnCount,
    divideAbove: aboveColumnCount > 1,
    divideBelow: belowColumnCount > 1,
    doubleWallUprights: niche.doubleWallUprights !== false,
    mountType: niche.mountType === "stand" ? "stand" : "wall",
    selectedInches:
      niche.selectedInches == null
        ? null
        : Math.max(1, Math.round(niche.selectedInches)),
    tvModelId: niche.tvModelId ?? null,
    bezelMm: Math.max(0, Math.round(niche.bezelMm ?? 0)),
    width: Math.max(
      MIN_TV_WIDTH_MM,
      Math.round(niche.width || DEFAULT_TV_NICHE.width),
    ),
    aboveShelfCount: Math.max(
      0,
      Math.min(8, Math.round(niche.aboveShelfCount ?? 1)),
    ),
    belowShelfCount: Math.max(
      0,
      Math.min(8, Math.round(niche.belowShelfCount ?? 2)),
    ),
  };
}

/** Start bay index so a TV span sits in the middle of the unit. */
export function centeredTvStartBayIndex(
  totalBays: number,
  tvBaySpan: number,
): number {
  const span = Math.max(1, Math.min(totalBays, Math.round(tvBaySpan)));
  return Math.max(0, Math.floor((totalBays - span) / 2));
}

/**
 * Resize carcass columns so the TV span sums to `tvWidth`.
 * Every outer bay gets the same share of leftover width (keeps Bay 1
 * from ballooning when left/right outer counts differ).
 */
export function resizeBaysToTvWidth(
  bays: Bay[],
  niche: TvNiche,
  tvWidth: number,
  totalWidth: number,
): Bay[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) return sorted;

  const start = Math.max(0, niche.startBayIndex);
  const end = Math.min(
    sorted.length - 1,
    niche.startBayIndex + niche.bayCount - 1,
  );
  const spanCount = end - start + 1;
  const outerCount = sorted.length - spanCount;
  const safeTotal = Math.max(600, Math.round(totalWidth));

  const minTv = Math.max(MIN_TV_WIDTH_MM, spanCount * MIN_OUTER_BAY_WIDTH_MM);
  const maxTv =
    outerCount === 0
      ? safeTotal
      : Math.max(
          minTv,
          safeTotal - outerCount * MIN_OUTER_BAY_WIDTH_MM,
        );
  const targetTv = Math.max(
    minTv,
    Math.min(maxTv, Math.round(tvWidth || niche.width || minTv)),
  );
  const outerBudget = Math.max(0, safeTotal - targetTv);

  const spanWidths = splitEqualWidths(targetTv, spanCount);
  const outerWidths =
    outerCount > 0 ? splitEqualWidths(outerBudget, outerCount) : [];

  let spanIndex = 0;
  let outerIndex = 0;
  return sorted.map((bay, index) => {
    if (index >= start && index <= end) {
      const width = Math.max(
        MIN_OUTER_BAY_WIDTH_MM,
        spanWidths[spanIndex] ?? Math.floor(targetTv / spanCount),
      );
      spanIndex += 1;
      return { ...bay, index, width };
    }
    const width = Math.max(
      MIN_OUTER_BAY_WIDTH_MM,
      outerWidths[outerIndex] ?? Math.floor(outerBudget / Math.max(1, outerCount)),
    );
    outerIndex += 1;
    return { ...bay, index, width };
  });
}

/**
 * Equalize widths of TV-span columns only. Outer bay widths stay unchanged.
 * TV opening width becomes whatever remains (or `tvWidth` if it fits).
 */
export function resizeTvColumnsPreservingOuters(
  bays: Bay[],
  niche: TvNiche,
  tvWidth: number,
  totalWidth: number,
): Bay[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) return sorted;

  const start = Math.max(0, niche.startBayIndex);
  const end = Math.min(
    sorted.length - 1,
    niche.startBayIndex + niche.bayCount - 1,
  );
  const spanCount = end - start + 1;
  if (spanCount <= 0) return sorted.map((bay, index) => ({ ...bay, index }));

  const safeTotal = Math.max(600, Math.round(totalWidth));
  const outerSum = sorted.reduce((sum, bay, index) => {
    if (index >= start && index <= end) return sum;
    return sum + bay.width;
  }, 0);
  const minTv = Math.max(MIN_TV_WIDTH_MM, spanCount * MIN_OUTER_BAY_WIDTH_MM);
  const maxTv = Math.max(minTv, safeTotal - outerSum);
  // Prefer requested TV width when it still leaves outer bays as-is
  const targetTv = Math.max(
    minTv,
    Math.min(maxTv, Math.round(tvWidth || niche.width || minTv)),
  );
  // If outer + preferred TV don't fill the unit, expand TV to fill (outers fixed)
  const fillTv = Math.max(targetTv, safeTotal - outerSum);
  const spanWidths = splitEqualWidths(Math.max(minTv, fillTv), spanCount);

  let spanIndex = 0;
  return sorted.map((bay, index) => {
    if (index >= start && index <= end) {
      const width = Math.max(
        MIN_OUTER_BAY_WIDTH_MM,
        spanWidths[spanIndex] ?? Math.floor(fillTv / spanCount),
      );
      spanIndex += 1;
      return { ...bay, index, width };
    }
    return { ...bay, index };
  });
}

/** Current TV opening width from carcass columns (or stored target). */
export function tvNicheWidthMm(bays: Bay[], niche: TvNiche): number {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const start = Math.max(0, niche.startBayIndex);
  const end = Math.min(
    sorted.length - 1,
    niche.startBayIndex + niche.bayCount - 1,
  );
  const summed = sorted
    .slice(start, end + 1)
    .reduce((sum, bay) => sum + bay.width, 0);
  return summed > 0 ? summed : niche.width;
}
