import {
  DRAWER_BAY_WIDTH_MM,
  DRAWER_UNIT_HEIGHT_MM,
  MODULE_HEIGHTS,
  drawerPackHeight,
  mainZoneTop,
} from "@/lib/constants";
import type { Bay, Module } from "@/store/store";

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
  const span = Math.max(shelfHeight * count, zoneBottom - zoneTop);
  const totalShelf = count * shelfHeight;
  const gap = (span - totalShelf) / (count + 1);
  return Array.from({ length: count }, (_, index) =>
    Math.round(zoneTop + gap + index * (shelfHeight + gap)),
  );
}

/**
 * Standard 3-bay carcass:
 * — Bay 1 & 2 share leftover width equally
 * — Drawer bay is always DRAWER_BAY_WIDTH_MM (locked)
 */
export function createStandardBays(width: number): Bay[] {
  const safeWidth = Math.max(
    DRAWER_BAY_WIDTH_MM + 800,
    Math.round(width),
  );
  const drawerWidth = DRAWER_BAY_WIDTH_MM;
  const remaining = safeWidth - drawerWidth;
  const bay1 = Math.floor(remaining / 2);
  const bay2 = remaining - bay1;

  return [
    { id: createId(), index: 0, width: bay1, lockedWidth: undefined },
    { id: createId(), index: 1, width: bay2, lockedWidth: undefined },
    {
      id: createId(),
      index: 2,
      width: drawerWidth,
      lockedWidth: DRAWER_BAY_WIDTH_MM,
    },
  ];
}

/**
 * Standard fittings:
 * Bay 1 — 5 shelves evenly in the 2 m main carcass
 * Bay 2 — double hanging
 * Bay 3 — 3 drawers on the floor + shelves above in the main zone
 * Top box (above the construction shelf) stays open storage
 */
export function createStandardModules(
  bays: Bay[],
  wardrobeHeight: number,
  carcassHeight?: number,
): Module[] {
  if (bays.length < 3) return [];

  const [bay1, bay2, bay3] = bays;
  const railH = MODULE_HEIGHTS["hanging-rail"];
  const shelfH = MODULE_HEIGHTS.shelf;
  const zoneTop = mainZoneTop(wardrobeHeight, carcassHeight);
  const zoneBottom = wardrobeHeight;

  const drawerCount = 3;
  const drawerH = drawerPackHeight(drawerCount);
  const drawerY = Math.max(zoneTop, wardrobeHeight - drawerH);

  // Bay 1: five shelves evenly through the 2 m main zone
  const bay1ShelfYs = evenShelfYs(5, zoneTop, zoneBottom, shelfH);

  // Bay 2: double hang inside the main zone
  const topRailY = zoneTop + 80;
  const midRailY = topRailY + railH + 1000;

  // Bay 3: shelves in the pocket above the drawer pack (still under construction)
  const shelfZoneBottom = Math.max(zoneTop + shelfH * 2 + 64, drawerY - 32);
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
      y: Math.min(midRailY, drawerY - railH - DRAWER_UNIT_HEIGHT_MM),
      height: railH,
    },
    {
      id: createId(),
      type: "drawer-pack",
      bayId: bay3.id,
      y: drawerY,
      height: drawerH,
      drawerCount,
    },
  );

  for (const y of bay3ShelfYs) {
    modules.push({
      id: createId(),
      type: "shelf",
      bayId: bay3.id,
      y,
      height: shelfH,
    });
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
    (sum, bay) => sum + (bay.lockedWidth ?? 0),
    0,
  );
  const flexible = sorted.filter((bay) => !bay.lockedWidth);
  const flexibleBudget = Math.max(0, nextWidth - lockedTotal);

  if (flexible.length === 0) {
    return sorted.map((bay, index) => ({
      ...bay,
      index,
      width: bay.lockedWidth ?? bay.width,
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
      return { ...bay, index, width: bay.lockedWidth };
    }
    const width = raw[flexIndex] ?? Math.floor(flexibleBudget / flexible.length);
    flexIndex += 1;
    return { ...bay, index, width };
  });
}

export const MIN_FLEXIBLE_BAY_WIDTH_MM = 300;

/**
 * Build N bays. If keepDrawerBay, the last bay is locked at 600 mm and the
 * rest share leftover width equally. Total width stays the same.
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
    (sum, bay) => sum + (bay.lockedWidth ?? 0),
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
      return { ...bay, index, width: bay.lockedWidth };
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
