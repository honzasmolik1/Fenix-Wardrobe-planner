export const MODULE_HEIGHTS = {
  shelf: 18,
  "drawer-pack": 600,
  "hanging-rail": 48,
} as const;

export const SNAP_INCREMENT_MM = 32;

/** Minimum clear air between any two modules */
export const MODULE_CLEARANCE_MM = 32;

/**
 * Clear hanging length under a rail for a jacket/coat.
 * Standard long-hang is ~1000 mm from rail underside to obstruction.
 */
export const JACKET_CLEARANCE_MM = 1000;

/**
 * Gap from the top of a hanging rail up to the first shelf above it.
 */
export const SHELF_ABOVE_RAIL_GAP_MM = 100;

/**
 * Default main carcass height from the floor up to the construction shelf.
 * Above this line is top storage. Adjustable by dragging the thick line.
 */
export const DEFAULT_CARCASS_HEIGHT_MM = 2000;
/** @deprecated use DEFAULT_CARCASS_HEIGHT_MM — kept for older imports */
export const CARCASS_HEIGHT_MM = DEFAULT_CARCASS_HEIGHT_MM;

export const MIN_CARCASS_HEIGHT_MM = 1200;
/** Minimum top-box depth above the construction shelf */
export const MIN_TOP_BOX_MM = 200;

/** Structural board that ends the main wardrobe / floors the top box */
export const CONSTRUCTION_SHELF_HEIGHT_MM = 36;

/**
 * Fixed width for any bay that holds drawers.
 * Travels with the drawers when bays are swapped — never resized.
 */
export const DRAWER_BAY_WIDTH_MM = 600;

export const DRAWER_UNIT_HEIGHT_MM = 200;
export const DEFAULT_DRAWER_COUNT = 3;
export const MIN_DRAWER_COUNT = 1;
export const MAX_DRAWER_COUNT = 6;

export function drawerPackHeight(drawerCount: number): number {
  return Math.max(MIN_DRAWER_COUNT, drawerCount) * DRAWER_UNIT_HEIGHT_MM;
}

export function clampCarcassHeight(
  carcassHeight: number,
  wardrobeHeight: number,
): number {
  const maxCarcass = Math.max(
    MIN_CARCASS_HEIGHT_MM,
    wardrobeHeight - MIN_TOP_BOX_MM,
  );
  return Math.max(
    MIN_CARCASS_HEIGHT_MM,
    Math.min(maxCarcass, Math.round(carcassHeight)),
  );
}

/** Y of the construction shelf (from wardrobe top). */
export function constructionShelfY(
  wardrobeHeight: number,
  carcassHeight: number = DEFAULT_CARCASS_HEIGHT_MM,
): number {
  const safe = clampCarcassHeight(carcassHeight, wardrobeHeight);
  return Math.max(0, wardrobeHeight - safe);
}

/** Interior start of the main carcass (just under the construction board). */
export function mainZoneTop(
  wardrobeHeight: number,
  carcassHeight: number = DEFAULT_CARCASS_HEIGHT_MM,
): number {
  return (
    constructionShelfY(wardrobeHeight, carcassHeight) +
    CONSTRUCTION_SHELF_HEIGHT_MM
  );
}
