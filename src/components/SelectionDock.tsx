"use client";

import { useEffect, useState } from "react";
import {
  MAX_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  type ModuleType,
  useWardrobeStore,
} from "@/store/store";
import { bayInTvNiche } from "@/lib/mediaLayout";
import { neighborBayHasShelves } from "@/lib/placement";
import {
  countDrawerBays,
  minBayCountForWidth,
  MAX_WARDROBE_BAY_COUNT,
} from "@/lib/standardLayout";
import { ToolbarMenu, ToolbarMenuItem } from "@/components/ToolbarMenu";

const MODULE_LABEL: Record<ModuleType, string> = {
  shelf: "Shelf",
  "drawer-pack": "Drawer",
  "hanging-rail": "Rail",
  divider: "Horizontal upright",
};

export function SelectionDock() {
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const selectedModuleId = useWardrobeStore((state) => state.selectedModuleId);
  const defaultDrawerCount = useWardrobeStore(
    (state) => state.defaultDrawerCount,
  );
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const wardrobeWidth = useWardrobeStore((state) => state.wardrobe.width);
  const tvNiche = useWardrobeStore((state) => state.tvNiche);
  const tvActiveZone = useWardrobeStore((state) => state.tvActiveZone);
  const isMedia = unitMode === "media";

  const setBayCountInput = useWardrobeStore((state) => state.setBayCountInput);
  const divideIntoBays = useWardrobeStore((state) => state.divideIntoBays);
  const selectBay = useWardrobeStore((state) => state.selectBay);
  const setBayWidth = useWardrobeStore((state) => state.setBayWidth);
  const clearBay = useWardrobeStore((state) => state.clearBay);
  const evenSpaceShelves = useWardrobeStore((state) => state.evenSpaceShelves);
  const alignTvShelvesWithOuterBays = useWardrobeStore(
    (state) => state.alignTvShelvesWithOuterBays,
  );
  const splitBayVertical = useWardrobeStore((state) => state.splitBayVertical);
  const swapBayWithNeighbor = useWardrobeStore(
    (state) => state.swapBayWithNeighbor,
  );
  const setDrawerCount = useWardrobeStore((state) => state.setDrawerCount);
  const removeModule = useWardrobeStore((state) => state.removeModule);
  const clearCanvasHighlight = useWardrobeStore(
    (state) => state.clearCanvasHighlight,
  );

  const selectedBay = bays.find((bay) => bay.id === selectedBayId) ?? null;
  const selectedModule =
    modules.find((mod) => mod.id === selectedModuleId) ?? null;
  const sortedBays = [...bays].sort((a, b) => a.index - b.index);
  const selectedBayOrder = selectedBay
    ? sortedBays.findIndex((bay) => bay.id === selectedBay.id)
    : -1;
  const [bayWidthDraft, setBayWidthDraft] = useState("");

  useEffect(() => {
    setBayWidthDraft(selectedBay ? String(selectedBay.width) : "");
  }, [selectedBay]);

  const bayModules = selectedBay
    ? modules.filter((mod) => mod.bayId === selectedBay.id)
    : [];
  const isTvPocket =
    Boolean(selectedBay) &&
    isMedia &&
    Boolean(tvNiche) &&
    bayInTvNiche(selectedBay!.index, tvNiche);
  const bayShelfCount = bayModules.filter((mod) => {
    if (mod.type !== "shelf") return false;
    if (!isTvPocket || !tvNiche) return true;
    return true;
  }).length;
  const bayDrawer =
    !isMedia
      ? (bayModules.find((mod) => mod.type === "drawer-pack") ??
        (selectedModule?.type === "drawer-pack" ? selectedModule : null))
      : null;
  const drawerTarget =
    selectedModule?.type === "drawer-pack" ? selectedModule : bayDrawer;

  const minBays = isMedia
    ? 1
    : minBayCountForWidth(wardrobeWidth, countDrawerBays(bays, modules));
  const maxBays = isMedia ? 10 : MAX_WARDROBE_BAY_COUNT;

  const applyBayCount = (count: number) => {
    setBayCountInput(count);
    divideIntoBays(count);
  };

  const commitBayWidth = () => {
    if (!selectedBay) return;
    const parsed = Number(bayWidthDraft);
    if (!Number.isFinite(parsed)) {
      setBayWidthDraft(String(selectedBay.width));
      return;
    }
    setBayWidth(selectedBay.id, parsed);
  };

  const nudgeBayWidth = (delta: number) => {
    if (!selectedBay) return;
    setBayWidth(selectedBay.id, selectedBay.width + delta);
  };

  const bayCount = bays.length;

  const bayStepper = (
    <div className="toolbar-section toolbar-section-bays shrink-0" role="group" aria-label="Number of bays">
      <span className="toolbar-label">Bays</span>
      <button
        type="button"
        className="touch-btn"
        disabled={bayCount <= minBays}
        onClick={() => applyBayCount(bayCount - 1)}
        aria-label="Remove a bay"
        title="Remove a bay"
      >
        −
      </button>
      <span className="bay-stepper-value" aria-live="polite">
        {bayCount}
      </span>
      <button
        type="button"
        className="touch-btn"
        disabled={bayCount >= maxBays}
        onClick={() => applyBayCount(bayCount + 1)}
        aria-label="Add a bay"
        title="Add a bay"
      >
        +
      </button>
    </div>
  );

  return (
    <div className="toolbar-shell bottom-dock w-full border-t border-[var(--line)] bg-white">
      <div className="toolbar-row toolbar-row-dock">
        <div className="toolbar-dock-left">
          <div className="toolbar-bays" role="group" aria-label="Bay buttons">
            {sortedBays.map((bay) => {
              const inTv =
                isMedia &&
                Boolean(tvNiche) &&
                bay.index >= (tvNiche?.startBayIndex ?? 0) &&
                bay.index <
                  (tvNiche?.startBayIndex ?? 0) + (tvNiche?.bayCount ?? 0);
              const hasDrawers = modules.some(
                (mod) => mod.bayId === bay.id && mod.type === "drawer-pack",
              );
              const role = hasDrawers ? "drawer" : inTv ? "tv" : "outer";
              return (
                <button
                  key={bay.id}
                  type="button"
                  className="bay-chip"
                  data-role={role}
                  data-active={bay.id === selectedBayId}
                  onClick={() => selectBay(bay.id)}
                  title={
                    role === "tv"
                      ? `TV column · Bay ${bay.index + 1} · ${bay.width} mm`
                      : role === "drawer"
                        ? `Drawer bay · ${bay.width} mm`
                        : `Bay ${bay.index + 1} · ${bay.width} mm`
                  }
                >
                  <span className="bay-chip-id">B{bay.index + 1}</span>
                  <span className="bay-chip-w">{bay.width}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="toolbar-dock-center">
          {bayStepper}

          {selectedBay && (
            <div className="toolbar-section desktop-only">
              <span className="toolbar-label">
                {isTvPocket
                  ? tvActiveZone === "above"
                    ? "Above TV"
                    : "Below TV"
                  : `Bay ${selectedBay.index + 1}`}
              </span>
              {!isTvPocket && (
                <>
                  <button
                    type="button"
                    disabled={selectedBayOrder <= 0}
                    onClick={() => swapBayWithNeighbor(selectedBay.id, "left")}
                    className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
                    title="Swap left"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={
                      selectedBayOrder < 0 ||
                      selectedBayOrder >= sortedBays.length - 1
                    }
                    onClick={() =>
                      swapBayWithNeighbor(selectedBay.id, "right")
                    }
                    className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
                    title="Swap right"
                  >
                    →
                  </button>
                </>
              )}
              {isMedia && tvNiche && (
                <button
                  type="button"
                  onClick={() => alignTvShelvesWithOuterBays()}
                  className="touch-btn touch-btn-primary"
                  title="Align shelves beside the TV with left/right bay shelf lines"
                >
                  Align TV shelves
                </button>
              )}
              {isMedia && (
                <button
                  type="button"
                  onClick={() => splitBayVertical(selectedBay.id)}
                  className="touch-btn"
                  title="Divide bay with a vertical upright (two columns)"
                >
                  Vertical upright
                </button>
              )}
              <button
                type="button"
                className="touch-btn touch-btn-even"
                disabled={bayShelfCount < 1}
                onClick={() =>
                  evenSpaceShelves(selectedBay.id, {
                    target: "bay",
                    remainder: "bottom",
                  })
                }
                title="Even shelves in this bay"
              >
                Even
              </button>
              <button
                type="button"
                className="touch-btn touch-btn-align"
                disabled={
                  bayShelfCount < 1 ||
                  !neighborBayHasShelves(modules, bays, selectedBay.id)
                }
                onClick={() =>
                  evenSpaceShelves(selectedBay.id, { target: "sides" })
                }
                title="Line shelves up with the neighbouring bay"
              >
                Align
              </button>
              <button
                type="button"
                disabled={bayModules.length === 0 && !isTvPocket}
                onClick={() => clearBay(selectedBay.id)}
                className="touch-btn touch-btn-danger disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  isTvPocket
                    ? "Clear shelves in this pocket"
                    : "Clear bay fittings"
                }
              >
                Clear
              </button>
            </div>
          )}

          {drawerTarget && (
            <div className="toolbar-section shrink-0">
              <span className="toolbar-label">Drawers</span>
              <button
                type="button"
                disabled={(drawerTarget.drawerCount ?? 3) <= MIN_DRAWER_COUNT}
                onClick={() =>
                  setDrawerCount(
                    drawerTarget.id,
                    (drawerTarget.drawerCount ?? 3) - 1,
                  )
                }
                className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <select
                suppressHydrationWarning
                value={drawerTarget.drawerCount ?? defaultDrawerCount}
                onChange={(event) =>
                  setDrawerCount(drawerTarget.id, Number(event.target.value))
                }
                className="toolbar-select"
              >
                {Array.from(
                  { length: MAX_DRAWER_COUNT - MIN_DRAWER_COUNT + 1 },
                  (_, index) => MIN_DRAWER_COUNT + index,
                ).map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={(drawerTarget.drawerCount ?? 3) >= MAX_DRAWER_COUNT}
                onClick={() =>
                  setDrawerCount(
                    drawerTarget.id,
                    (drawerTarget.drawerCount ?? 3) + 1,
                  )
                }
                className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
              <button
                type="button"
                className="touch-btn touch-btn-danger"
                onClick={() => {
                  removeModule(drawerTarget.id);
                  clearCanvasHighlight();
                }}
              >
                Remove
              </button>
            </div>
          )}

          {selectedModule && selectedModule.type !== "drawer-pack" && (
            <div className="toolbar-section shrink-0">
              <span className="toolbar-label">
                {MODULE_LABEL[selectedModule.type]}
              </span>
              <button
                type="button"
                className="touch-btn touch-btn-danger"
                onClick={() => {
                  removeModule(selectedModule.id);
                  clearCanvasHighlight();
                }}
              >
                Remove
              </button>
            </div>
          )}

          <div className="compact-only shrink-0">
            <ToolbarMenu
              label={selectedBay ? `Bay ${selectedBay.index + 1}` : "Bay"}
              align="right"
              triggerClassName="toolbar-menu-trigger touch-btn"
              title="Bay settings"
            >
              {selectedBay && (
                <>
                  <ToolbarMenuItem
                    disabled={selectedBayOrder <= 0}
                    onClick={() => swapBayWithNeighbor(selectedBay.id, "left")}
                  >
                    Swap left
                  </ToolbarMenuItem>
                  <ToolbarMenuItem
                    disabled={
                      selectedBayOrder < 0 ||
                      selectedBayOrder >= sortedBays.length - 1
                    }
                    onClick={() =>
                      swapBayWithNeighbor(selectedBay.id, "right")
                    }
                  >
                    Swap right
                  </ToolbarMenuItem>
                  <ToolbarMenuItem
                    disabled={bayShelfCount < 1}
                    onClick={() =>
                      evenSpaceShelves(selectedBay.id, {
                        target: "bay",
                        remainder: "bottom",
                      })
                    }
                  >
                    Even shelves
                  </ToolbarMenuItem>
                  <ToolbarMenuItem
                    disabled={
                      bayShelfCount < 1 ||
                      !neighborBayHasShelves(modules, bays, selectedBay.id)
                    }
                    onClick={() =>
                      evenSpaceShelves(selectedBay.id, { target: "sides" })
                    }
                  >
                    Align to next bay
                  </ToolbarMenuItem>
                  {isMedia && (
                    <ToolbarMenuItem
                      onClick={() => splitBayVertical(selectedBay.id)}
                    >
                      Vertical upright
                    </ToolbarMenuItem>
                  )}
                  <ToolbarMenuItem
                    danger
                    disabled={bayModules.length === 0 && !isTvPocket}
                    onClick={() => clearBay(selectedBay.id)}
                  >
                    Clear bay
                  </ToolbarMenuItem>
                </>
              )}
            </ToolbarMenu>
          </div>
        </div>

        <div className="toolbar-dock-right">
          {selectedBay && (
            <div className="toolbar-section toolbar-section-size shrink-0">
              <span className="toolbar-label">Width</span>
              <button
                type="button"
                className="touch-btn"
                disabled={Boolean(selectedBay.lockedWidth)}
                onClick={() => nudgeBayWidth(-50)}
              >
                −
              </button>
              <input
                suppressHydrationWarning
                type="text"
                inputMode="numeric"
                aria-label="Selected bay width mm"
                value={bayWidthDraft}
                disabled={Boolean(selectedBay.lockedWidth)}
                title={
                  selectedBay.lockedWidth
                    ? "Drawer bay is fixed at 500 mm"
                    : undefined
                }
                onChange={(event) =>
                  setBayWidthDraft(event.target.value.replace(/[^\d]/g, ""))
                }
                onBlur={commitBayWidth}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="toolbar-input toolbar-input-md"
              />
              <button
                type="button"
                className="touch-btn"
                disabled={Boolean(selectedBay.lockedWidth)}
                onClick={() => nudgeBayWidth(50)}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
