/**
 * Wardrobe door geometry + Trademaster opening bands.
 * Catalogue (faces / frames / 500 mm option): `@/lib/trademasterDoors`.
 */

import {
  CONSTRUCTION_SHELF_HEIGHT_MM,
  mainZoneTop,
} from "@/lib/constants";
import {
  SLIDING_FACE_LABELS,
  SLIDING_FRAME_LABELS,
  SLIDING_HEIGHT_STANDARD_MAX_MM,
  SLIDING_HEIGHT_TALL_MAX_MM,
  SLIDING_NARROW_LEAF_MM,
  SLIDING_OPENING_2_MAX_MM,
  SLIDING_OPENING_3_MAX_MM,
  SLIDING_OPENING_4_MAX_MM,
  slidingHeightBandLabel as tmHeightBandLabel,
  slidingOpeningBandLabel as tmOpeningBandLabel,
  trademasterSlidingDoorCount,
  type SlidingDoorFace,
  type SlidingFrameColour,
  type SlidingWidthMode,
} from "@/lib/trademasterDoors";

export {
  SLIDING_OPENING_2_MAX_MM,
  SLIDING_OPENING_3_MAX_MM,
  SLIDING_OPENING_4_MAX_MM,
  SLIDING_NARROW_LEAF_MM,
  SLIDING_HEIGHT_STANDARD_MAX_MM as SLIDING_DOOR_STANDARD_MAX_MM,
  SLIDING_HEIGHT_TALL_MAX_MM as SLIDING_DOOR_ABSOLUTE_MAX_MM,
  SLIDING_HEIGHT_TALL_MAX_MM as SLIDING_HEIGHT_BAND_HIGH_MM,
  SLIDING_HEIGHT_STANDARD_MAX_MM as SLIDING_HEIGHT_BAND_LOW_MM,
};

export const SLIDING_DOOR_RECOMMENDED_MAX_MM = 2400;

export const MIN_SLIDING_LEAF_COUNT = 2;
export const MAX_SLIDING_LEAF_COUNT = 3;

/** Typical sliding-panel overlap so parked doors still read clearly */
export const SLIDING_DOOR_OVERLAP_MM = 50;

/** Nominal hinged wardrobe door width */
export const HINGED_DOOR_WIDTH_MM = 550;

/** Fixed fascia above sliding doors when unit is taller than the door leaf */
export const MIN_SLIDING_TOP_PANEL_MM = 50;

/**
 * Common sliding-door leaf heights (mm) — Trademaster custom-cuts to opening.
 * Includes 2350 as a frequent site size under the ≤2450 band.
 */
export const SLIDING_DOOR_HEIGHT_OPTIONS_MM = [
  1800, 2000, 2100, 2200, 2300, 2350, 2400, 2450, 2550, 2650, 2750,
] as const;

export type DoorSystem = "none" | "sliding" | "hinged";

export type DoorPanelPlan = {
  system: "sliding" | "hinged";
  count: number;
  /** Typical panel width (mm) — leaves are even-split so they may differ by 1 mm */
  panelWidthMm: number;
  /** Per-leaf widths that sum to the opening */
  leafWidthsMm: number[];
  /** Door leaf height (mm) */
  panelHeightMm: number;
  /** Fixed top fascia above sliding doors (0 for hinged / full-height) */
  topPanelHeightMm: number;
  overlapMm: number;
  widthMode: SlidingWidthMode | "hinged";
  face: SlidingDoorFace;
  /** Per-leaf face; length matches count */
  faces: SlidingDoorFace[];
  /** Trademaster-style opening band label */
  openingBandLabel: string;
  heightBandLabel: string;
};

export function clampSlidingLeafCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_SLIDING_LEAF_COUNT;
  return Math.max(
    MIN_SLIDING_LEAF_COUNT,
    Math.min(MAX_SLIDING_LEAF_COUNT, Math.round(count)),
  );
}

export function evenPanelWidths(openingMm: number, count: number): number[] {
  const n = Math.max(1, Math.round(count));
  const w = Math.max(1, Math.round(openingMm));
  return Array.from({ length: n }, (_, index) => {
    const start = Math.round((index * w) / n);
    const end = Math.round(((index + 1) * w) / n);
    return end - start;
  });
}

export function evenSlidingLeafWidths(
  openingMm: number,
  count: number,
): number[] {
  return evenPanelWidths(openingMm, clampSlidingLeafCount(count));
}

export function normalizeSlidingDoorFaces(
  faces: SlidingDoorFace[] | undefined,
  count: number,
  fallback: SlidingDoorFace = "white",
): SlidingDoorFace[] {
  const n = clampSlidingLeafCount(count);
  return Array.from({ length: n }, (_, index) => faces?.[index] ?? fallback);
}

export function normalizePolyShakerRebate(
  flags: boolean[] | undefined,
  faces: SlidingDoorFace[],
  count: number,
): boolean[] {
  const n = clampSlidingLeafCount(count);
  return Array.from({ length: n }, (_, index) =>
    faces[index] === "poly" ? Boolean(flags?.[index]) : false,
  );
}

export function doorHasShakerRebate(
  face: SlidingDoorFace,
  flags: boolean[] | undefined,
  index: number,
): boolean {
  return face === "poly" && Boolean(flags?.[index]);
}

/** Door count from opening width — never changes the wardrobe size. */
export function slidingDoorCount(widthMm: number): 2 | 3 {
  return trademasterSlidingDoorCount(widthMm);
}

export function slidingOpeningBandLabel(widthMm: number): string {
  return tmOpeningBandLabel(widthMm);
}

export function slidingHeightBandLabel(doorHeightMm: number): string {
  const h = Math.round(doorHeightMm);
  if (h <= SLIDING_DOOR_RECOMMENDED_MAX_MM) {
    return `Recommended · ≤ ${SLIDING_DOOR_RECOMMENDED_MAX_MM} mm`;
  }
  return tmHeightBandLabel(h);
}

/** Hinged door count targeting ~550 mm leaves across the opening. */
export function hingedDoorCount(widthMm: number): number {
  const w = Math.max(HINGED_DOOR_WIDTH_MM, Math.round(widthMm));
  return Math.max(1, Math.round(w / HINGED_DOOR_WIDTH_MM));
}

/** Main-carcass door opening height (below construction shelf). */
export function slidingDoorOpeningHeightMm(
  wardrobeHeight: number,
  carcassHeight: number,
): number {
  const top = mainZoneTop(wardrobeHeight, carcassHeight);
  return Math.max(0, Math.round(wardrobeHeight - top));
}

/** @deprecated use slidingDoorOpeningHeightMm */
export function doorOpeningHeightMm(
  wardrobeHeight: number,
  carcassHeight: number,
): number {
  return slidingDoorOpeningHeightMm(wardrobeHeight, carcassHeight);
}

/**
 * Clamp a requested sliding door leaf height to the unit and Trademaster max.
 * Leaves at least {@link MIN_SLIDING_TOP_PANEL_MM} for a top fascia when the
 * unit is taller than the door (unless door fills the unit).
 */
export function clampSlidingDoorHeightMm(
  requestedMm: number,
  wardrobeHeightMm: number,
): number {
  const unit = Math.max(600, Math.round(wardrobeHeightMm));
  return Math.max(1200, Math.min(unit, Math.round(requestedMm)));
}

/** Sliding doors run the full unit height — no top fascia. */
export function defaultSlidingDoorLeafMm(wardrobeHeightMm: number): number {
  return clampSlidingDoorHeightMm(wardrobeHeightMm, wardrobeHeightMm);
}

/**
 * Carcass height that yields approximately `doorLeafMm` below the construction shelf.
 */
export function carcassHeightForSlidingDoorLeaf(
  doorLeafMm: number,
  wardrobeHeightMm: number,
): number {
  const leaf = clampSlidingDoorHeightMm(doorLeafMm, wardrobeHeightMm);
  // opening ≈ carcass − construction board
  return Math.min(
    wardrobeHeightMm,
    leaf + CONSTRUCTION_SHELF_HEIGHT_MM,
  );
}

/**
 * Height options available for the current wardrobe (filtered to what fits).
 */
export function slidingDoorHeightOptionsForUnit(
  wardrobeHeightMm: number,
): number[] {
  const unit = Math.round(wardrobeHeightMm);
  const options = SLIDING_DOOR_HEIGHT_OPTIONS_MM.filter(
    (h) => h <= unit && h <= SLIDING_HEIGHT_TALL_MAX_MM,
  );
  if (!options.includes(unit as (typeof SLIDING_DOOR_HEIGHT_OPTIONS_MM)[number]) &&
      unit >= 1200 &&
      unit <= SLIDING_HEIGHT_TALL_MAX_MM) {
    return [...options, unit].sort((a, b) => a - b);
  }
  // Always include exact current opening if between steps
  return options.length > 0 ? [...options] : [Math.min(unit, 2400)];
}

/**
 * Hinged doors open toward the centre of the unit.
 * Left half: handle on the right edge; right half: handle on the left edge.
 * Never places pulls on the far outer left/right sides.
 */
export function hingedHandleOnRight(index: number, count: number): boolean {
  return index < count / 2;
}

/**
 * Build door panel geometry from the current wardrobe size.
 * Does not mutate wardrobe width/height.
 * Hinged doors run full unit height; sliding use leaf height + top fascia.
 */
export function planDoorPanels(options: {
  system: "sliding" | "hinged";
  wardrobeWidth: number;
  wardrobeHeight: number;
  carcassHeight: number;
  /** Explicit sliding leaf; omit to run up to the top fascia */
  slidingDoorHeightMm?: number | null;
  slidingWidthMode?: SlidingWidthMode;
  slidingFace?: SlidingDoorFace;
  /** Ignored — count is always taken from wardrobe width. */
  slidingLeafCount?: number | null;
  slidingDoorFaces?: SlidingDoorFace[];
}): DoorPanelPlan {
  const openingW = Math.round(options.wardrobeWidth);
  const unitH = Math.round(options.wardrobeHeight);
  const face = options.slidingFace ?? "white";
  const count = slidingDoorCount(openingW);

  const faces = normalizeSlidingDoorFaces(
    options.slidingDoorFaces,
    count,
    face,
  );
  const leafWidthsMm =
    options.system === "hinged"
      ? evenPanelWidths(openingW, count)
      : evenSlidingLeafWidths(openingW, count);
  const panelWidthMm = leafWidthsMm[0] ?? Math.round(openingW / count);

  return {
    system: options.system,
    count,
    panelWidthMm,
    leafWidthsMm,
    panelHeightMm: unitH,
    topPanelHeightMm: 0,
    overlapMm: 0,
    widthMode: options.system === "hinged" ? "hinged" : (options.slidingWidthMode ?? "trademaster"),
    face: faces[0] ?? face,
    faces,
    openingBandLabel: `${count} doors`,
    heightBandLabel: slidingOpeningBandLabel(openingW),
  };
}

export function doorPanelLabel(
  plan: DoorPanelPlan,
  index: number,
  mirrored: boolean,
  shakerRebate = false,
): string {
  const leafFace = plan.faces[index] ?? plan.face;
  if (mirrored || leafFace === "mirror") {
    return `Mirror ${index + 1}`;
  }
  if (leafFace === "poly" && shakerRebate) {
    return `Shaker ${index + 1}`;
  }
  return `${SLIDING_FACE_LABELS[leafFace] ?? "Door"} ${index + 1}`;
}

/** @deprecated use slidingOpeningBandLabel */
export function slidingDoorRuleLabel(widthMm: number): string {
  return slidingOpeningBandLabel(widthMm);
}

/** Door materials as text for the drawing PDF (no prices). */
export function doorBreakdownLines(
  wardrobeWidth: number,
  materials: {
    doorSystem: "none" | "sliding" | "hinged";
    slidingFace: SlidingDoorFace;
    slidingDoorFaces?: SlidingDoorFace[];
    polyShakerRebate?: boolean[];
    slidingFrameColour: SlidingFrameColour;
  },
): string[] {
  if (materials.doorSystem === "none") return [];
  const count = slidingDoorCount(wardrobeWidth);
  const faces = normalizeSlidingDoorFaces(
    materials.slidingDoorFaces,
    count,
    materials.slidingFace,
  );
  const system = materials.doorSystem === "sliding" ? "Sliding" : "Hinged";
  return [
    `${system} doors · ${count}`,
    ...faces.map((face, index) => {
      const shaker = doorHasShakerRebate(
        face,
        materials.polyShakerRebate,
        index,
      );
      const finish = SLIDING_FACE_LABELS[face] ?? face;
      return `Door ${index + 1} — ${finish}${shaker ? " · Shaker rebate" : ""}`;
    }),
    `Aluminium frame — ${SLIDING_FRAME_LABELS[materials.slidingFrameColour]}`,
  ];
}
