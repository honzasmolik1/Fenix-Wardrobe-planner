import assert from "node:assert/strict";
import { test } from "node:test";

import { useWardrobeStore } from "@/store/store";

const store = () => useWardrobeStore.getState();

/** Rebuild a media unit with a TV niche, the way the app does on "Add TV". */
function freshTvUnit() {
  store().setUnitMode("media");
  store().applyMediaLayout();
  store().placeTvNicheOnSelection();
}

/**
 * The TV has to read as centred on the drawing, so the columns left of the
 * opening must total the same as those on its right. Odd millimetres have to
 * land somewhere, hence the 1 mm tolerance.
 */
function assertTvCentred(label: string) {
  const { bays, wardrobe, tvNiche } = store();
  assert.ok(tvNiche, `${label}: expected a TV niche`);

  const sorted = [...bays].sort((a, b) => a.index - b.index);
  const start = tvNiche.startBayIndex;
  const end = start + tvNiche.bayCount - 1;
  const sum = (items: typeof sorted) =>
    items.reduce((total, bay) => total + bay.width, 0);

  const left = sum(sorted.slice(0, start));
  const right = sum(sorted.slice(end + 1));

  assert.ok(
    Math.abs(left - right) <= 1,
    `${label}: ${left} mm left of the TV but ${right} mm right of it`,
  );
  assert.equal(
    sum(sorted),
    wardrobe.width,
    `${label}: columns total ${sum(sorted)} mm but the unit is ${wardrobe.width} mm`,
  );
  assert.ok(
    start > 0 || sorted.length === tvNiche.bayCount,
    `${label}: TV is jammed against the left end`,
  );
  assert.ok(
    end < sorted.length - 1 || sorted.length === tvNiche.bayCount,
    `${label}: TV is jammed against the right end`,
  );
}

test("TV stays centred when columns are added or removed", () => {
  freshTvUnit();
  assertTvCentred("after adding the TV");

  for (const count of [5, 4, 3, 4, 6, 8, 7, 5]) {
    store().divideIntoBays(count);
    assertTvCentred(`with ${count} columns`);
  }
});

test("TV stays centred when the base is taken off and put back", () => {
  freshTvUnit();

  for (const enabled of [false, true, false, true]) {
    store().setKickerEnabled(enabled);
    assertTvCentred(`base ${enabled ? "on" : "off"}`);
  }
});

test("TV stays centred with no base and a different column count", () => {
  freshTvUnit();
  store().setKickerEnabled(false);

  for (const count of [3, 4, 5, 6, 7]) {
    store().divideIntoBays(count);
    assertTvCentred(`no base, ${count} columns`);
  }
});

test("TV stays centred when the opening is resized", () => {
  freshTvUnit();

  for (const width of [600, 900, 1200, 1500, 1800, 2200, 800]) {
    store().setTvWidth(width);
    assertTvCentred(`TV opening ${width} mm`);
  }
});

test("TV stays centred when the unit width changes", () => {
  freshTvUnit();

  for (const width of [1600, 2000, 2400, 3200, 4000, 2800]) {
    store().setWardrobeWidth(width);
    assertTvCentred(`unit ${width} mm wide`);
  }
});

test("TV stays centred through a mix of edits", () => {
  freshTvUnit();

  store().divideIntoBays(5);
  assertTvCentred("5 columns");

  store().setKickerEnabled(false);
  assertTvCentred("5 columns, no base");

  store().setTvWidth(1300);
  assertTvCentred("5 columns, no base, 1300 mm TV");

  store().setWardrobeWidth(2600);
  assertTvCentred("narrowed to 2600 mm");

  store().divideIntoBays(4);
  assertTvCentred("back to 4 columns");

  store().setKickerEnabled(true);
  assertTvCentred("base back on");
});
