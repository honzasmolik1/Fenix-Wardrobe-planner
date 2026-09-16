import {
  DRAWER_BAY_WIDTH_MM,
  DUAL_RAIL_SPACING_MM,
  MIN_WARDROBE_WIDTH_MM,
  MODULE_HEIGHTS,
  RAIL_FROM_TOP_MM,
  drawerPackHeight,
  mainZoneTop,
} from "@/lib/constants";
import type { Bay, Module } from "@/store/store";

/** MDF shelves can sag if a bay is wider than this. */
export const MAX_BAY_WIDTH_MM = 800;
export const MAX_WARDROBE_BAY_COUNT = 8;
/**
 * From this overall width, auto 4 bays (flex bays stay ≤ 800 mm).
 * Below this, default is 3 bays and the user can add or remove.
 */
export const WIDE_WARDROBE_FOUR_BAY_MM = 2402;

/**
 * How many bays a wardrobe uses when overall size changes.
 * — 1000 mm kits: 2 bays
 * — under 2402 mm: 3 bays (drawer 500 mm; add/remove still allowed)
 * — 2402 mm and up: 4 or more so no flex bay is over 800 mm
 */
export function bayCountForWidth(
  width: number,
  drawerBayCount = 1,
): number {
  const w = Math.max(MIN_WARDROBE_WIDTH_MM, Math.round(width));
  if (w <= 1250) return 2;
  if (w < WIDE_WARDROBE_FOUR_BAY_MM) return 3;

  const drawers = Math.max(1, Math.round(drawerBayCount) || 1);
  const flexBudget = Math.max(0, w - drawers * DRAWER_BAY_WIDTH_MM);
  const flexNeeded = Math.max(1, Math.ceil(flexBudget / MAX_BAY_WIDTH_MM));
  return Math.min(
    MAX_WARDROBE_BAY_COUNT,
    Math.max(4, drawers + flexNeeded),
  );
}

/** Smallest bay count the user may step down to. */
export function minBayCountForWidth(width: number): number {
  const w = Math.max(MIN_WARDROBE_WIDTH_MM, Math.round(width));
  if (w < WIDE_WARDROBE_FOUR_BAY_MM) return 2;
  return bayCountForWidth(w);
}

export function countDrawerBays(bays: Bay[], modules: Module[]): number {
  return bays.filter(
    (bay) =>
      Boolean(bay.lockedWidth) ||
      modules.some((mod) => mod.bayId === bay.id && mod.type === "drawer-pack"),
  ).length;
}

/** Pin every drawer bay at 500 mm so it never stretches with the others. */
export function lockDrawerBays(bays: Bay[], modules: Module[]): Bay[] {
  return bays.map((bay) => {
    const hasDrawer =
      Boolean(bay.lockedWidth) ||
      modules.some((mod) => mod.bayId === bay.id && mod.type === "drawer-pack");
    if (!hasDrawer) {
      return { ...bay, lockedWidth: undefined };
    }
    return {
      ...bay,
      width: DRAWER_BAY_WIDTH_MM,
      lockedWidth: DRAWER_BAY_WIDTH_MM,
    };
  });
}

const createId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function evenShelfYs(
  count: number,
  zoneTop: number,
  zoneBottom: number,
  shelfHeight: number,
): number[] {
  if (count <= 0) return [];
  const spanHeight = Math.max(shelfHeight * count, zoneBottom - zoneTop);
  const totalShelf = count * shelfHeight;
  const gap = (spanHeight - totalShelf) / (count + 1);
  return Array.from({ length: count }, (_, index) => {
    const raw = zoneTop + gap * (index + 1) + shelfHeight * index;
    const gapAbove = raw - zoneTop;
    const snappedGap = Math.round(gapAbove / 10) * 10;
    return Math.round(zoneTop + Math.max(0, snappedGap));
  });
}

/**
 * Last bay is the 500 mm drawer bay (locked). Other bays share the leftover
 * equally and stay ≤ 800 mm.
 */
export function createStandardBays(width: number): Bay[] {
  const safeWidth = Math.max(MIN_WARDROBE_WIDTH_MM, Math.round(width));
  return createBaysWithCount(
    safeWidth,
    bayCountForWidth(safeWidth, 1),
    true,
  );
}

/**
 * When overall wardrobe width changes: drawer bay stays 500 mm.
 * Under 2402 mm → 3 bays. From 2402 mm → 4+ so no flex bay exceeds 800 mm.
 */
export function resizeWardrobeBaysForWidth(
  bays: Bay[],
  modules: Module[],
  nextWidth: number,
): { bays: Bay[]; modules: Module[] } {
  const width = Math.max(MIN_WARDROBE_WIDTH_MM, Math.round(nextWidth));
  let nextBays = lockDrawerBays(bays, modules);
  let nextModules = modules;
  const drawers = countDrawerBays(nextBays, nextModules);
  let count = bayCountForWidth(width, drawers);

  const apply = (desired: number) => {
    nextBays = lockDrawerBays(nextBays, nextModules);
    if (nextBays.length === 0) {
      nextBays = createBaysWithCount(width, desired, drawers > 0);
      nextModules = [];
      return;
    }
    if (nextBays.length !== desired) {
      const adjusted = adjustBayCountKeepingDrawerEnds(
        nextBays,
        nextModules,
        width,
        desired,
      );
      nextBays = lockDrawerBays(adjusted.bays, adjusted.modules);
      nextModules = adjusted.modules;
      return;
    }
    nextBays = evenUnlockedBays(nextBays, width);
  };

  apply(count);

  // Extra bays so flex bays stay ≤ 800 mm once the unit is 2402 mm or wider
  if (width >= WIDE_WARDROBE_FOUR_BAY_MM) {
    while (
      nextBays.some(
        (bay) => !bay.lockedWidth && bay.width > MAX_BAY_WIDTH_MM,
      ) &&
      count < MAX_WARDROBE_BAY_COUNT
    ) {
      count += 1;
      apply(count);
    }
  }

  return { bays: nextBays, modules: nextModules };
}

/**
 * Standard fittings:
 * Bay 1 — 4 shelves evenly in the 2 m main carcass
 * Bay 2 — double hanging
 * Bay 3 — 3 drawers on the floor + 2 shelves above
 * Top box (above the construction shelf) stays open storage
 */
export function createStandardModules(
  bays: Bay[],
  wardrobeHeight: number,
  carcassHeight?: number,
): Module[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const drawerBay =
    sorted.find((bay) => bay.lockedWidth) ??
    (sorted.length >= 3 ? sorted[sorted.length - 1] : undefined);
  const flex = sorted.filter((bay) => bay.id !== drawerBay?.id);
  const bay1 = flex[0];
  const bay2 = flex[1];
  if (!bay1 || !bay2 || !drawerBay) return [];
  const railH = MODULE_HEIGHTS["hanging-rail"];
  const shelfH = MODULE_HEIGHTS.shelf;
  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);
  const zoneBottom = wardrobeHeight;

  const drawerCount = 3;
  const drawerH = drawerPackHeight(drawerCount);
  const drawerY = Math.max(zoneTop, wardrobeHeight - drawerH);

  // Bay 1: four shelves evenly through the 2 m main zone
  const bay1ShelfYs = evenShelfYs(4, zoneTop, zoneBottom, shelfH);

  // Bay 2: double hang — 50 mm from top, 900 mm clear between rails
  const topRailY = zoneTop + RAIL_FROM_TOP_MM;
  const midRailY = topRailY + railH + DUAL_RAIL_SPACING_MM;

  // Bay 3: shelves in the pocket above the drawer pack (still under construction)
  const shelfZoneBottom = Math.max(zoneTop + shelfH * 2 + 64, drawerY);
  const bay3ShelfYs = evenShelfYs(2, zoneTop, shelfZoneBottom, shelfH);

  const modules: Module[] = [];

  for (const y of bay1ShelfYs) {
    modules.push({
      id: createId(),
      type: "shelf",
      bayId: bay1.id,
      y,
      height: shelfH,
    });
  }

  modules.push(
    {
      id: createId(),
      type: "hanging-rail",
      bayId: bay2.id,
      y: topRailY,
      height: railH,
    },
    {
      id: createId(),
      type: "hanging-rail",
      bayId: bay2.id,
      y: midRailY,
      height: railH,
    },
    {
      id: createId(),
      type: "drawer-pack",
      bayId: drawerBay.id,
      y: drawerY,
      height: drawerH,
      drawerCount,
    },
  );

  for (const y of bay3ShelfYs) {
    modules.push({
      id: createId(),
      type: "shelf",
      bayId: drawerBay.id,
      y,
      height: shelfH,
    });
  }

  for (const extra of flex.slice(2)) {
    for (const y of evenShelfYs(4, zoneTop, zoneBottom, shelfH)) {
      modules.push({
        id: createId(),
        type: "shelf",
        bayId: extra.id,
        y,
        height: shelfH,
      });
    }
  }

  return modules;
}

/** Keep locked drawer-bay widths fixed; stretch the flexible bays. */
export function resizeBaysPreservingLocks(
  bays: Bay[],
  nextWidth: number,
): Bay[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const lockedTotal = sorted.reduce(
    (sum, bay) => sum + (bay.lockedWidth ? DRAWER_BAY_WIDTH_MM : 0),
    0,
  );
  const flexible = sorted.filter((bay) => !bay.lockedWidth);
  const flexibleBudget = Math.max(0, nextWidth - lockedTotal);

  if (flexible.length === 0) {
    return sorted.map((bay, index) => ({
      ...bay,
      index,
      width: bay.lockedWidth ? DRAWER_BAY_WIDTH_MM : bay.width,
      lockedWidth: bay.lockedWidth ? DRAWER_BAY_WIDTH_MM : undefined,
    }));
  }

  const prevFlexTotal =
    flexible.reduce((sum, bay) => sum + bay.width, 0) || flexible.length;
  const raw = flexible.map((bay) =>
    Math.floor((bay.width / prevFlexTotal) * flexibleBudget),
  );
  const used = raw.reduce((sum, value) => sum + value, 0);
  raw[raw.length - 1] += flexibleBudget - used;

  let flexIndex = 0;
  return sorted.map((bay, index) => {
    if (bay.lockedWidth) {
      return {
        ...bay,
        index,
        width: DRAWER_BAY_WIDTH_MM,
        lockedWidth: DRAWER_BAY_WIDTH_MM,
      };
    }
    const width = raw[flexIndex] ?? Math.floor(flexibleBudget / flexible.length);
    flexIndex += 1;
    return { ...bay, index, width };
  });
}

export const MIN_FLEXIBLE_BAY_WIDTH_MM = 300;

/**
 * Change bay count without rebuilding IDs.
 * Extra bays are inserted in the middle; drawer bays on the ends stay put
 * so left/right drawer packs are not lost.
 */
export function adjustBayCountKeepingDrawerEnds(
  bays: Bay[],
  modules: Module[],
  totalWidth: number,
  nextCount: number,
): { bays: Bay[]; modules: Module[] } {
  const desired = Math.max(1, Math.floor(nextCount));
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const hasDrawer = (bay: Bay) =>
    Boolean(bay.lockedWidth) ||
    modules.some((mod) => mod.bayId === bay.id && mod.type === "drawer-pack");

  if (sorted.length === 0) {
    return {
      bays: createBaysWithCount(totalWidth, desired, false),
      modules: [],
    };
  }

  const next = sorted.map((bay) => ({ ...bay }));

  while (next.length < desired) {
    const firstDrawer = next.findIndex(hasDrawer);
    const lastDrawer = [...next]
      .map((bay, index) => (hasDrawer(bay) ? index : -1))
      .filter((index) => index >= 0)
      .at(-1) ?? -1;
    let insertAt = Math.ceil(next.length / 2);
    if (firstDrawer >= 0 && lastDrawer > firstDrawer) {
      insertAt = Math.min(
        lastDrawer,
        Math.max(firstDrawer + 1, insertAt),
      );
    }
    next.splice(insertAt, 0, {
      id: createId(),
      index: insertAt,
      width: MIN_FLEXIBLE_BAY_WIDTH_MM,
      lockedWidth: undefined,
    });
  }

  while (next.length > desired) {
    const flexIndexes = next
      .map((bay, index) => (hasDrawer(bay) ? -1 : index))
      .filter((index) => index >= 0);
    const mid = (next.length - 1) / 2;
    const removeAt =
      flexIndexes.length > 0
        ? flexIndexes.sort(
            (a, b) => Math.abs(a - mid) - Math.abs(b - mid),
          )[0]
        : Math.floor(next.length / 2);
    next.splice(removeAt, 1);
  }

  const reindexed = next.map((bay, index) => ({ ...bay, index }));
  return {
    bays: evenUnlockedBays(reindexed, totalWidth),
    modules: modules.filter((mod) =>
      reindexed.some((bay) => bay.id === mod.bayId),
    ),
  };
}

function evenUnlockedBays(bays: Bay[], totalWidth: number): Bay[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const lockedTotal = sorted.reduce(
    (sum, bay) => sum + (bay.lockedWidth ? DRAWER_BAY_WIDTH_MM : 0),
    0,
  );
  const flexible = sorted.filter((bay) => !bay.lockedWidth);
  const budget = Math.max(0, totalWidth - lockedTotal);

  if (flexible.length === 0) {
    return resizeBaysPreservingLocks(sorted, totalWidth);
  }

  const base = Math.floor(budget / flexible.length);
  const remainder = budget - base * flexible.length;
  let flexIndex = 0;
  return sorted.map((bay, index) => {
    if (bay.lockedWidth) {
      return {
        ...bay,
        index,
        width: DRAWER_BAY_WIDTH_MM,
        lockedWidth: DRAWER_BAY_WIDTH_MM,
      };
    }
    const width = base + (flexIndex === flexible.length - 1 ? remainder : 0);
    flexIndex += 1;
    return { ...bay, index, width };
  });
}

/**
 * Build N bays. If keepDrawerBay, the last bay is locked at DRAWER_BAY_WIDTH_MM
 * and the rest share leftover width equally. Total width stays the same.
 */
export function createBaysWithCount(
  width: number,
  count: number,
  keepDrawerBay: boolean,
): Bay[] {
  const safeCount = Math.max(1, Math.floor(count));
  const safeWidth = Math.max(
    keepDrawerBay ? DRAWER_BAY_WIDTH_MM + MIN_FLEXIBLE_BAY_WIDTH_MM : 600,
    Math.round(width),
  );

  if (keepDrawerBay && safeCount >= 2) {
    const flexCount = safeCount - 1;
    const flexBudget = safeWidth - DRAWER_BAY_WIDTH_MM;
    const base = Math.floor(flexBudget / flexCount);
    const remainder = flexBudget - base * flexCount;

    const bays: Bay[] = Array.from({ length: flexCount }, (_, index) => ({
      id: createId(),
      index,
      width: base + (index === flexCount - 1 ? remainder : 0),
      lockedWidth: undefined,
    }));

    bays.push({
      id: createId(),
      index: flexCount,
      width: DRAWER_BAY_WIDTH_MM,
      lockedWidth: DRAWER_BAY_WIDTH_MM,
    });
    return bays;
  }

  const bayWidth = Math.floor(safeWidth / safeCount);
  const remainder = safeWidth - bayWidth * safeCount;
  return Array.from({ length: safeCount }, (_, index) => ({
    id: createId(),
    index,
    width: bayWidth + (index === safeCount - 1 ? remainder : 0),
  }));
}

/**
 * Remap modules onto new bays by index. Drawer fittings always follow the
 * locked drawer bay when present.
 */
export function remapModulesToBays(
  modules: Module[],
  oldBays: Bay[],
  nextBays: Bay[],
): Module[] {
  const oldSorted = [...oldBays].sort((a, b) => a.index - b.index);
  const nextSorted = [...nextBays].sort((a, b) => a.index - b.index);
  const oldById = new Map(oldSorted.map((bay) => [bay.id, bay]));
  const nextDrawer = nextSorted.find((bay) => bay.lockedWidth);
  const nextFlex = nextSorted.filter((bay) => !bay.lockedWidth);
  const remapped: Module[] = [];

  for (const mod of modules) {
    const oldBay = oldById.get(mod.bayId);
    if (!oldBay) continue;

    let nextBayId: string | undefined;

    if (mod.type === "drawer-pack" || oldBay.lockedWidth) {
      if (mod.type === "drawer-pack" && !nextDrawer) continue;
      nextBayId = nextDrawer?.id;
    } else {
      // Keep content on the same bay index when that flexible bay still exists
      const flexIndex = oldSorted
        .filter((bay) => !bay.lockedWidth)
        .findIndex((bay) => bay.id === oldBay.id);
      nextBayId =
        (flexIndex >= 0 ? nextFlex[flexIndex]?.id : undefined) ??
        nextFlex[Math.min(oldBay.index, nextFlex.length - 1)]?.id;
    }

    if (!nextBayId) continue;
    remapped.push({ ...mod, bayId: nextBayId });
  }

  return remapped;
}

/**
 * Set one flexible bay width. Drawer/locked bays stay fixed.
 * Other flexible bays share the leftover so total wardrobe width is unchanged.
 */
export function setFlexibleBayWidth(
  bays: Bay[],
  bayId: string,
  nextWidth: number,
  totalWidth: number,
  minFlexibleWidth = MIN_FLEXIBLE_BAY_WIDTH_MM,
): Bay[] {
  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const target = sorted.find((bay) => bay.id === bayId);
  if (!target || target.lockedWidth) return sorted;

  const lockedTotal = sorted.reduce(
    (sum, bay) => sum + (bay.lockedWidth ? DRAWER_BAY_WIDTH_MM : 0),
    0,
  );
  const others = sorted.filter(
    (bay) => !bay.lockedWidth && bay.id !== bayId,
  );
  const minOthers = others.length * minFlexibleWidth;
  const flexBudget = Math.max(0, totalWidth - lockedTotal);
  const maxForTarget = Math.max(
    minFlexibleWidth,
    flexBudget - minOthers,
  );
  const clamped = Math.min(
    totalWidth >= WIDE_WARDROBE_FOUR_BAY_MM ? MAX_BAY_WIDTH_MM : maxForTarget,
    maxForTarget,
    Math.max(minFlexibleWidth, Math.round(nextWidth)),
  );
  const remaining = flexBudget - clamped;

  let otherWidths: number[] = [];
  if (others.length === 0) {
    otherWidths = [];
  } else {
    const prevOtherTotal =
      others.reduce((sum, bay) => sum + bay.width, 0) || others.length;
    otherWidths = others.map((bay) =>
      Math.floor((bay.width / prevOtherTotal) * remaining),
    );
    const used = otherWidths.reduce((sum, value) => sum + value, 0);
    otherWidths[otherWidths.length - 1] += remaining - used;

    // Enforce minimums by stealing from the largest sibling
    for (let i = 0; i < otherWidths.length; i += 1) {
      if (otherWidths[i] >= minFlexibleWidth) continue;
      const deficit = minFlexibleWidth - otherWidths[i];
      otherWidths[i] = minFlexibleWidth;
      const donor = otherWidths
        .map((width, index) => ({ width, index }))
        .filter((item) => item.index !== i)
        .sort((a, b) => b.width - a.width)[0];
      if (donor) {
        otherWidths[donor.index] = Math.max(
          minFlexibleWidth,
          otherWidths[donor.index] - deficit,
        );
      }
    }
  }

  let otherIndex = 0;
  return sorted.map((bay, index) => {
    if (bay.lockedWidth) {
      return {
        ...bay,
        index,
        width: DRAWER_BAY_WIDTH_MM,
        lockedWidth: DRAWER_BAY_WIDTH_MM,
      };
    }
    if (bay.id === bayId) {
      return { ...bay, index, width: clamped };
    }
    const width =
      otherWidths[otherIndex] ?? Math.floor(remaining / Math.max(1, others.length));
    otherIndex += 1;
    return { ...bay, index, width };
  });
}
