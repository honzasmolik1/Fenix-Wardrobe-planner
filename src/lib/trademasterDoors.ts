/**
 * Trademaster sliding-door catalogue.
 * Sources:
 * https://trademaster.au/collections/wardrobes-doors
 * https://trademaster.au/products/white-panel-wardrobe-sliding-doors-up-to-2450mm-height-by-trademaster
 * https://trademaster.au/products/mirror-glass-wardrobe-sliding-doors-by-trademaster
 * https://trademaster.au/products/mirror-glass-wardrobe-sliding-doors-from-2450mmm-up-to-2750mm-height-by-trademaster
 * https://trademaster.au/products/frameless-mirror-glass-wardrobe-sliding-doors-up-to-2450mm-height-by-trademaster
 * https://trademaster.au/products/tradecor-colours-wardrobe-sliding-doors-up-to-2450mm-height-by-trademaster
 *
 * Opening width (doors required):
 *  ≤ 2400 mm → 2 doors   > 2400 mm → 3 doors
 *
 * Opening height bands:
 *  up to 2450 mm  |  2450–2750 mm
 *
 * Doors are custom-cut to the opening. Optional ~500 mm leaf mode
 * increases count so each door stays near 500 mm wide.
 */

export const SLIDING_OPENING_2_MAX_MM = 2400;
export const SLIDING_OPENING_3_MAX_MM = 3600;
export const SLIDING_OPENING_4_MAX_MM = 4800;

export const SLIDING_HEIGHT_STANDARD_MAX_MM = 2450;
export const SLIDING_HEIGHT_TALL_MAX_MM = 2750;
export const SLIDING_HEIGHT_RECOMMENDED_MAX_MM = 2400;

/** Optional narrow leaf target */
export const SLIDING_NARROW_LEAF_MM = 500;
/** 500 mm sliding doors are offered up to this opening height */
export const SLIDING_NARROW_LEAF_MAX_HEIGHT_MM = 2400;

export type SlidingWidthMode = "trademaster" | "500mm";

export type SlidingDoorProductId =
  | "white-panel"
  | "mirror-glass"
  | "frameless-mirror"
  | "tradecor";

export type SlidingDoorFace =
  | "white"
  | "poly"
  | "mirror"
  | "frosted"
  | "super-white"
  | "tradecor";

export type SlidingFrameColour =
  | "white"
  | "black"
  | "matt-silver"
  | "bright-silver"
  | "off-white";

export type SlidingDoorProduct = {
  id: SlidingDoorProductId;
  label: string;
  faces: SlidingDoorFace[];
  frames: SlidingFrameColour[];
  frameless: boolean;
};

export const SLIDING_DOOR_PRODUCTS: SlidingDoorProduct[] = [
  {
    id: "white-panel",
    label: "White melamine panel",
    faces: ["white", "poly"],
    frames: ["white", "black", "matt-silver", "bright-silver", "off-white"],
    frameless: false,
  },
  {
    id: "mirror-glass",
    label: "Mirror & glass (framed)",
    faces: ["mirror", "frosted", "super-white", "poly"],
    frames: ["white", "black", "matt-silver", "bright-silver", "off-white"],
    frameless: false,
  },
  {
    id: "frameless-mirror",
    label: "Frameless mirror & glass",
    faces: ["mirror", "frosted", "super-white", "poly"],
    frames: ["white", "bright-silver"],
    frameless: true,
  },
  {
    id: "tradecor",
    label: "Tradecor colour panel",
    faces: ["tradecor", "poly"],
    frames: ["white", "black", "matt-silver", "bright-silver", "off-white"],
    frameless: false,
  },
];

export const SLIDING_FACE_LABELS: Record<SlidingDoorFace, string> = {
  white: "White melamine",
  poly: "Poly finish",
  mirror: "Mirror glass",
  frosted: "Frosted glass",
  "super-white": "Super white glass",
  tradecor: "Tradecor colour",
};

export const SLIDING_FRAME_LABELS: Record<SlidingFrameColour, string> = {
  white: "White",
  black: "Black",
  "matt-silver": "Matt silver",
  "bright-silver": "Bright silver",
  "off-white": "Off white",
};

export function slidingProductById(
  id: SlidingDoorProductId,
): SlidingDoorProduct {
  return (
    SLIDING_DOOR_PRODUCTS.find((item) => item.id === id) ??
    SLIDING_DOOR_PRODUCTS[0]
  );
}

/** Door count from opening width: 2 up to 2400 mm, 3 above. */
export function trademasterSlidingDoorCount(widthMm: number): 2 | 3 {
  const w = Math.max(0, Math.round(widthMm));
  return w <= SLIDING_OPENING_2_MAX_MM ? 2 : 3;
}

/**
 * Door count for the chosen width setup.
 * 500 mm mode: enough leaves so each is ≤ ~500 mm (wardrobe size unchanged).
 */
export function slidingDoorCountForSetup(
  openingMm: number,
  widthMode: SlidingWidthMode = "trademaster",
): number {
  if (widthMode === "500mm") {
    return Math.max(
      2,
      Math.ceil(Math.max(1, Math.round(openingMm)) / SLIDING_NARROW_LEAF_MM),
    );
  }
  return trademasterSlidingDoorCount(openingMm);
}

export function slidingOpeningBandLabel(widthMm: number): string {
  const n = trademasterSlidingDoorCount(widthMm);
  if (n === 2) {
    return `${n} doors · up to ${SLIDING_OPENING_2_MAX_MM} mm`;
  }
  return `${n} doors · over ${SLIDING_OPENING_2_MAX_MM} mm`;
}

export function slidingHeightBandId(
  doorHeightMm: number,
): "standard" | "tall" | "over" {
  const h = Math.round(doorHeightMm);
  if (h <= SLIDING_HEIGHT_STANDARD_MAX_MM) return "standard";
  if (h <= SLIDING_HEIGHT_TALL_MAX_MM) return "tall";
  return "over";
}

export function slidingHeightBandLabel(doorHeightMm: number): string {
  const band = slidingHeightBandId(doorHeightMm);
  if (band === "standard") {
    return `Up to ${SLIDING_HEIGHT_STANDARD_MAX_MM} mm height`;
  }
  if (band === "tall") {
    return `${SLIDING_HEIGHT_STANDARD_MAX_MM}–${SLIDING_HEIGHT_TALL_MAX_MM} mm height`;
  }
  return `Above ${SLIDING_HEIGHT_TALL_MAX_MM} mm (outside catalogue)`;
}

export function slidingFaceFill(face: SlidingDoorFace): string {
  switch (face) {
    case "mirror":
      return "#9ec4d8";
    case "frosted":
      return "#d5dde4";
    case "super-white":
      return "#f4f7fa";
    case "tradecor":
      return "#c4a882";
    case "poly":
      return "#ece6dc";
    default:
      return "#f2f2f4";
  }
}

export function slidingFrameStroke(colour: SlidingFrameColour): string {
  switch (colour) {
    case "black":
      return "#1a1a1a";
    case "matt-silver":
      return "#8a9199";
    case "bright-silver":
      return "#c5ccd3";
    case "off-white":
      return "#d8d4cc";
    default:
      return "#e8e8ea";
  }
}

export function isGlassSlidingFace(face: SlidingDoorFace): boolean {
  return face === "mirror" || face === "frosted" || face === "super-white";
}
