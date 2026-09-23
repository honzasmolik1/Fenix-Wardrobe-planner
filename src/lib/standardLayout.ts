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
  const drawers = Math.max(1, Math.round(drawerBayCount) || 1);
  const flexBudget = Math.max(0, w - drawers * DRAWER_BAY_WIDTH_MM);
  // Drawer bays are pinned at 500 mm, so the rest of the width always needs
  // at least one bay of its own — otherwise the carcass is left part-open.
  const minimum = drawers + (flexBudget > 0 ? 1 : 0);

  if (w <= 1250) return Math.max(2, minimum);
  if (w < WIDE_WARDROBE_FOUR_BAY_MM) return Math.max(3, minimum);

  const flexNeeded = Math.max(1, Math.ceil(flexBudget / MAX_BAY_WIDTH_MM));
  return Math.min(
    Math.max(MAX_WARDROBE_BAY_COUNT, minimum),
    Math.max(4, drawers + flexNeeded),
  );
}

/**
 * Smallest bay count the user may step down to.
 *
 * This is a hard floor, not the automatic count from `bayCountForWidth` — a
 * wide wardrobe still opens with wider-spaced bays by default, but the user
 * stays free to step down from there. The only real limits are the pinned
 * 500 mm drawer bays plus one bay for whatever width is left over.
 */
export function minBayCountForWidth(
  width: number,
  drawerBayCount = 1,
): number {
  const w = Math.max(MIN_WARDROBE_WIDTH_MM, Math.round(width));
  const drawers = Math.max(0, Math.round(drawerBayCount) || 0);
  const leftover = w - drawers * DRAWER_BAY_WIDTH_MM;
  return Math.max(2, drawers + (leftover > 0 ? 1 : 0));
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
 * How many flexible bays the leftover width needs.
 *
 * Keeps the count the user already has unless that would squeeze a bay below
 * the minimum width. The shelf sag limit shapes the *default* count in
 * `bayCountForWidth`; it is deliberately not enforced here, so stepping the
 * bay count down by hand is not undone.
 */
function flexBayCountForBudget(budget: number, currentCount: number): number {
  if (budget <= 0) return 0;
  const mostByMinWidth = Math.max(
    1,
    Math.floor(budget / MIN_FLEXIBLE_BAY_WIDTH_MM),
  );
  return Math.min(Math.max(1, currentCount), mostByMinWidth);
}

/** Share a width across bays so the parts add back up to the whole exactly. */
function splitEvenly(budget: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(budget / count);
  const widths = Array.from({ length: count }, () => base);
  widths[count - 1] += budget - base * count;
  return widths;
}

/**
 * The one rule the drawing depends on: every millimetre of the wardrobe
 * belongs to a bay. Drawer bays are pinned at 500 mm, so whatever is left over
 * is shared by the flexible bays — and if there are none left, a bay is added
 * to cover it. Without this the carcass renders with an open, wall-less side.
 *
 * The bay count is otherwise left alone, so adding drawers never silently
 * re-divides the wardrobe.
 */
export function normalizeBayWidths(
  bays: Bay[],
  modules: Module[],
  totalWidth: number,
): { bays: Bay[]; modules: Module[] } {
  const width = Math.max(MIN_WARDROBE_WIDTH_MM, Math.round(totalWidth));
  const sorted = [...bays].sort((a, b) => a.index - b.index);

  if (sorted.length === 0) {
    return {
      bays: createBaysWithCount(width, bayCountForWidth(width, 1), false),
      modules: [],
    };
  }

  const next = lockDrawerBays(sorted, modules).map((bay) => ({ ...bay }));
  const lockedCount = next.filter((bay) => bay.lockedWidth).length;
  const lockedTotal = lockedCount * DRAWER_BAY_WIDTH_MM;

  // More drawer bays than the wardrobe is wide: keep them all visible by
  // sharing the width rather than letting them run past the end panel.
  if (lockedTotal > width) {
    const widths = splitEvenly(width, lockedCount);
    let lockedIndex = 0;
    const trimmed = next
      .filter((bay) => bay.lockedWidth)
      .map((bay, index) => ({
        ...bay,
        index,
        width: widths[lockedIndex++] ?? DRAWER_BAY_WIDTH_MM,
      }));
    return {
      bays: trimmed,
      modules: modules.filter((mod) =>
        trimmed.some((bay) => bay.id === mod.bayId),
      ),
    };
  }

  const budget = width - lockedTotal;
  const flexBays = next.filter((bay) => !bay.lockedWidth);
  const wantedFlex = Math.min(
    flexBayCountForBudget(budget, flexBays.length),
    // Closing the carcass always wins over the overall bay-count cap
    Math.max(MAX_WARDROBE_BAY_COUNT - lockedCount, budget > 0 ? 1 : 0),
  );

  let laidOut = next;

  if (wantedFlex > flexBays.length) {
    // Slot new bays in ahead of any drawer bays on the end, so a drawer bank
    // that was the last bay stays the last bay.
    const lastFlex = laidOut.map((bay) => !bay.lockedWidth).lastIndexOf(true);
    const insertAt = lastFlex >= 0 ? lastFlex + 1 : laidOut.length;
    const additions = Array.from(
      { length: wantedFlex - flexBays.length },
      () => ({
        id: createId(),
        index: insertAt,
        width: MIN_FLEXIBLE_BAY_WIDTH_MM,
        lockedWidth: undefined,
      }),
    );
    laidOut = [
      ...laidOut.slice(0, insertAt),
      ...additions,
      ...laidOut.slice(insertAt),
    ];
  } else if (wantedFlex < flexBays.length) {
    // Shed the bays nearest the end first — the fittings on bay 1 stay put.
    const drop = new Set(flexBays.slice(wantedFlex).map((bay) => bay.id));
    laidOut = laidOut.filter((bay) => !drop.has(bay.id));
  }

  const widths = splitEvenly(budget, wantedFlex);
  let flexIndex = 0;
  const finalBays = laidOut.map((bay, index) => {
    if (bay.lockedWidth) {
      return {
        ...bay,
        index,
        width: DRAWER_BAY_WIDTH_MM,
        lockedWidth: DRAWER_BAY_WIDTH_MM,
      };
    }
    return { ...bay, index, width: widths[flexIndex++] ?? 0 };
  });

  return {
    bays: finalBays,
    modules: modules.filter((mod) =>
      finalBays.some((bay) => bay.id === mod.bayId),
    ),
  };
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
  const locked = lockDrawerBays(bays, modules);
  const drawers = countDrawerBays(locked, modules);
  const desired = bayCountForWidth(width, drawers);

  if (locked.length === 0) {
    return normalizeBayWidths(
      createBaysWithCount(width, desired, drawers > 0),
      modules,
      width,
    );
  }

  const adjusted =
    locked.length === desired
      ? { bays: locked, modules }
      : adjustBayCountKeepingDrawerEnds(locked, modules, width, desired);

  return normalizeBayWidths(adjusted.bays, adjusted.modules, width);
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
  return normalizeBayWidths(
    reindexed,
    modules.filter((mod) => reindexed.some((bay) => bay.id === mod.bayId)),
    totalWidth,
  );
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
