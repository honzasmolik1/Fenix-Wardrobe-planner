import assert from "node:assert/strict";
import { test } from "node:test";

import { DRAWER_BAY_WIDTH_MM } from "@/lib/constants";
import {
  MAX_BAY_WIDTH_MM,
  MIN_FLEXIBLE_BAY_WIDTH_MM,
  adjustBayCountKeepingDrawerEnds,
  bayCountForWidth,
  countDrawerBays,
  createBaysWithCount,
  createStandardBays,
  createStandardModules,
  minBayCountForWidth,
  normalizeBayWidths,
  resizeWardrobeBaysForWidth,
  setFlexibleBayWidth,
} from "@/lib/standardLayout";
import type { Bay, Module } from "@/store/store";

let seq = 0;
const nextId = () => `id-${(seq += 1)}`;

function bay(width: number, locked = false): Bay {
  return {
    id: nextId(),
    index: 0,
    width,
    lockedWidth: locked ? DRAWER_BAY_WIDTH_MM : undefined,
  };
}

function reindex(bays: Bay[]): Bay[] {
  return bays.map((item, index) => ({ ...item, index }));
}

function drawerIn(bayId: string, drawerCount = 3): Module {
  return {
    id: nextId(),
    type: "drawer-pack",
    bayId,
    y: 1400,
    height: drawerCount * 200,
    drawerCount,
  };
}

const total = (bays: Bay[]) => bays.reduce((sum, item) => sum + item.width, 0);

/**
 * The carcass is drawn bay by bay, so any mismatch between the bay widths and
 * the overall width shows up as an open side with no wall.
 */
function assertFillsWidth(bays: Bay[], width: number, label: string) {
  assert.equal(
    total(bays),
    width,
    `${label}: bays total ${total(bays)} mm but wardrobe is ${width} mm`,
  );
  for (const item of bays) {
    assert.ok(
      item.width > 0,
      `${label}: bay ${item.index} has width ${item.width} mm`,
    );
  }
  const indexes = bays.map((item) => item.index).sort((a, b) => a - b);
  assert.deepEqual(
    indexes,
    bays.map((_, index) => index),
    `${label}: bay indexes are not contiguous`,
  );
}

function assertDrawerBaysLocked(bays: Bay[], modules: Module[], label: string) {
  for (const item of bays) {
    const hasDrawer = modules.some(
      (mod) => mod.bayId === item.id && mod.type === "drawer-pack",
    );
    if (!hasDrawer) continue;
    assert.equal(
      item.width,
      DRAWER_BAY_WIDTH_MM,
      `${label}: drawer bay ${item.index} is ${item.width} mm`,
    );
  }
}

const WIDTHS = [
  1000, 1200, 1250, 1400, 1600, 1800, 2000, 2200, 2400, 2401, 2402, 2600, 3000,
  3600, 4200, 4800,
];

test("standard layout fills the wardrobe at every width", () => {
  for (const width of WIDTHS) {
    const bays = createStandardBays(width);
    assertFillsWidth(bays, width, `standard ${width}`);
    const modules = createStandardModules(bays, 2400, 2000);
    assertDrawerBaysLocked(bays, modules, `standard ${width}`);
  }
});

test("resizing to any width keeps the carcass fully divided", () => {
  for (const from of WIDTHS) {
    const startBays = createStandardBays(from);
    const startModules = createStandardModules(startBays, 2400, 2000);
    for (const to of WIDTHS) {
      const out = resizeWardrobeBaysForWidth(startBays, startModules, to);
      assertFillsWidth(out.bays, to, `resize ${from}->${to}`);
      assertDrawerBaysLocked(out.bays, out.modules, `resize ${from}->${to}`);
    }
  }
});

test("adding a drawer keeps the bay count the user chose", () => {
  const width = 2400;
  let bays = reindex([bay(600), bay(600), bay(600), bay(600)]);
  let modules: Module[] = [];

  const targets = [...bays];
  targets.forEach((target, step) => {
    modules = [...modules, drawerIn(target.id)];
    const out = normalizeBayWidths(bays, modules, width);
    bays = out.bays;
    modules = out.modules;
    assertFillsWidth(bays, width, `drawer in bay ${target.index}`);
    assertDrawerBaysLocked(bays, modules, `drawer in bay ${target.index}`);

    // Only the final drawer uses up every bay, leaving 400 mm that has to
    // become a bay of its own. Up to then the count must not move.
    const expected = step < targets.length - 1 ? 4 : 5;
    assert.equal(
      bays.length,
      expected,
      `bay count went to ${bays.length} after drawer ${step + 1}`,
    );
  });
});

test("locked drawer bays never leave an undivided gap", () => {
  const width = 2400;
  const a = bay(500, true);
  const b = bay(500, true);
  const c = bay(500, true);
  const bays = reindex([a, b, c]);
  const modules = [drawerIn(a.id), drawerIn(b.id), drawerIn(c.id)];

  const out = normalizeBayWidths(bays, modules, width);
  assertFillsWidth(out.bays, width, "all bays hold drawers");
  assertDrawerBaysLocked(out.bays, out.modules, "all bays hold drawers");
  assert.ok(
    out.bays.length > 3,
    "a filler bay should cover the width the drawer bays cannot",
  );
});

test("flex bays stay within the shelf sag limit on wide units", () => {
  for (const width of [2402, 2600, 3000, 3600, 4200, 4800]) {
    const bays = createStandardBays(width);
    const modules = createStandardModules(bays, 2400, 2000);
    const out = resizeWardrobeBaysForWidth(bays, modules, width);
    for (const item of out.bays) {
      if (item.lockedWidth) continue;
      assert.ok(
        item.width <= MAX_BAY_WIDTH_MM,
        `width ${width}: flex bay ${item.index} is ${item.width} mm`,
      );
    }
  }
});

test("changing bay count by hand keeps the carcass full", () => {
  const width = 2400;
  const bays = createStandardBays(width);
  const modules = createStandardModules(bays, 2400, 2000);

  for (let count = 2; count <= 8; count += 1) {
    const out = adjustBayCountKeepingDrawerEnds(bays, modules, width, count);
    assertFillsWidth(out.bays, width, `bay count ${count}`);
    assertDrawerBaysLocked(out.bays, out.modules, `bay count ${count}`);
  }
});

test("dragging one bay wider keeps the total unchanged", () => {
  const width = 2400;
  const bays = createStandardBays(width);
  const flex = bays.find((item) => !item.lockedWidth);
  assert.ok(flex, "expected a flexible bay");

  for (const next of [200, 300, 500, 800, 1200, 5000]) {
    const out = setFlexibleBayWidth(bays, flex.id, next, width);
    assertFillsWidth(out, width, `drag to ${next}`);
    for (const item of out) {
      if (item.lockedWidth) continue;
      assert.ok(
        item.width >= MIN_FLEXIBLE_BAY_WIDTH_MM,
        `drag to ${next}: bay ${item.index} collapsed to ${item.width} mm`,
      );
    }
  }
});

test("the bay count can always be stepped down, not just up", () => {
  for (const width of WIDTHS) {
    const auto = bayCountForWidth(width, 1);
    const floor = minBayCountForWidth(width, 1);
    assert.ok(
      floor < auto || auto <= 2,
      `width ${width}: opens with ${auto} bays but cannot go below ${floor}`,
    );
  }
});

test("stepping the bay count down keeps the carcass full", () => {
  for (const width of [2402, 2600, 3000, 3600, 4200, 4800]) {
    let bays = createStandardBays(width);
    let modules = createStandardModules(bays, 2400, 2000);
    const floor = minBayCountForWidth(width, countDrawerBays(bays, modules));

    for (let count = bays.length - 1; count >= floor; count -= 1) {
      const out = adjustBayCountKeepingDrawerEnds(bays, modules, width, count);
      bays = out.bays;
      modules = out.modules;
      assertFillsWidth(bays, width, `width ${width} stepped to ${count}`);
      assertDrawerBaysLocked(bays, modules, `width ${width} stepped to ${count}`);
      assert.equal(
        bays.length,
        count,
        `width ${width}: asked for ${count} bays, got ${bays.length}`,
      );
    }
  }
});

test("drawer bays raise the smallest workable bay count", () => {
  // Three 500 mm drawer bays plus the 900 mm left over needs four bays
  assert.equal(minBayCountForWidth(2400, 3), 4);
  // A pure 1500 mm drawer bank has nothing left over
  assert.equal(minBayCountForWidth(1500, 3), 3);
  // Never below two bays
  assert.equal(minBayCountForWidth(4800, 0), 2);
});

test("bays built from a raw count always add up", () => {
  for (const width of WIDTHS) {
    for (let count = 1; count <= 8; count += 1) {
      for (const keepDrawer of [false, true]) {
        const bays = createBaysWithCount(width, count, keepDrawer);
        const label = `count ${count} drawer ${keepDrawer} at ${width}`;
        assert.equal(total(bays), Math.max(width, total(bays)), label);
        assertFillsWidth(bays, total(bays), label);
      }
    }
  }
});
