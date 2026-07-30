export const MODULE_HEIGHTS = {
  shelf: 18,
  "drawer-pack": 600,
  "hanging-rail": 48,
} as const;

export const SNAP_INCREMENT_MM = 32;

/** Manual drag snap — positions stick to clean 10 mm steps (340, 500, …) */
export const DRAG_SNAP_MM = 10;

/** Construction / top-bay line snaps in 50 mm steps (default 2000 mm). */
export const CARCASS_SNAP_MM = 50;

/** Minimum clear air between any two modules */
export const MODULE_CLEARANCE_MM = 32;

/**
 * Clear hanging length under a single rail before the first shelf.
 * First shelf below starts exactly this far under the rail underside.
 */
export const JACKET_CLEARANCE_MM = 900;

/**
 * Gap from the top of a hanging rail up to the first shelf above it.
 */
export const SHELF_ABOVE_RAIL_GAP_MM = 100;

/** First rail sits this far below the construction / main-zone top. */
export const RAIL_FROM_TOP_MM = 50;

/** Clear air gap between the two rails in a double-hang bay (underside → top). */
export const DUAL_RAIL_SPACING_MM = 900;

/** Double hang fills the bay — no shelves or drawers allowed with 2 rails. */
export const MAX_RAILS_PER_BAY = 2;

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

/** Structural board that ends the main wardrobe / floors the top box — same as a shelf */
export const CONSTRUCTION_SHELF_HEIGHT_MM = 18;

/**
 * Fixed width for any bay that holds drawers.
 * Travels with the drawers when bays are swapped — never resized.
 */
export const DRAWER_BAY_WIDTH_MM = 500;

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
  const snapped =
    Math.round(carcassHeight / CARCASS_SNAP_MM) * CARCASS_SNAP_MM;
  return Math.max(MIN_CARCASS_HEIGHT_MM, Math.min(maxCarcass, snapped));
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
