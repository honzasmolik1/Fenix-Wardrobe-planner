"use client";

import {
  MAX_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  type ModuleType,
  useWardrobeStore,
} from "@/store/store";

const MODULE_LABEL: Record<ModuleType, string> = {
  shelf: "Shelf",
  "drawer-pack": "Drawer",
  "hanging-rail": "Rail",
};

export function SelectionDock() {
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const selectedModuleId = useWardrobeStore((state) => state.selectedModuleId);
  const defaultDrawerCount = useWardrobeStore(
    (state) => state.defaultDrawerCount,
  );

  const clearBay = useWardrobeStore((state) => state.clearBay);
  const evenSpaceShelves = useWardrobeStore((state) => state.evenSpaceShelves);
  const swapBayWithNeighbor = useWardrobeStore(
    (state) => state.swapBayWithNeighbor,
  );
  const selectModule = useWardrobeStore((state) => state.selectModule);
  const sendModuleToFloor = useWardrobeStore(
    (state) => state.sendModuleToFloor,
  );
  const setDrawerCount = useWardrobeStore((state) => state.setDrawerCount);
  const removeModule = useWardrobeStore((state) => state.removeModule);

  const selectedBay = bays.find((bay) => bay.id === selectedBayId) ?? null;
  const selectedModule =
    modules.find((mod) => mod.id === selectedModuleId) ?? null;
  const sortedBays = [...bays].sort((a, b) => a.index - b.index);
  const selectedBayOrder = selectedBay
    ? sortedBays.findIndex((bay) => bay.id === selectedBay.id)
    : -1;

  const bayModules = selectedBay
    ? modules.filter((mod) => mod.bayId === selectedBay.id)
    : modules;
  const bayShelfCount = bayModules.filter((mod) => mod.type === "shelf").length;
  const bayDrawer =
    bayModules.find((mod) => mod.type === "drawer-pack") ??
    (selectedModule?.type === "drawer-pack" ? selectedModule : null);

  if (!selectedBay && modules.length === 0) {
    return (
      <div className="toolbar-shell w-full border-t border-[var(--line)] bg-white/95 px-4 py-4 text-center text-base text-[var(--muted)] backdrop-blur-xl">
        Tap a bay on the canvas, then add a shelf, drawer or rail from the top
        bar.
      </div>
    );
  }

  return (
    <div className="toolbar-shell w-full border-t border-[var(--line)] bg-white/95 backdrop-blur-xl">
      <div className="toolbar-row toolbar-row-dock">
        <div className="toolbar-section">
          <span className="toolbar-label">
            {selectedBay
              ? `Bay ${selectedBay.index + 1}${selectedBay.lockedWidth ? " · drawer" : ""}`
              : "Select"}
          </span>
          {selectedBay && (
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
                onClick={() => swapBayWithNeighbor(selectedBay.id, "right")}
                className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
                title="Swap right"
              >
                →
              </button>
              <button
                type="button"
                disabled={bayShelfCount < 1}
                onClick={() => evenSpaceShelves(selectedBay.id)}
                className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
                title="Space shelves evenly in this bay"
              >
                Even
              </button>
              <button
                type="button"
                disabled={bayModules.length === 0}
                onClick={() => clearBay(selectedBay.id)}
                className="touch-btn touch-btn-danger disabled:cursor-not-allowed disabled:opacity-40"
                title="Remove all fittings from this bay"
              >
                Clear
              </button>
            </>
          )}
        </div>

        <div className="toolbar-section min-w-0">
          <span className="toolbar-label">Fittings</span>
          <div className="fitting-strip">
            {bayModules.length === 0 ? (
              <span className="text-sm text-[var(--muted)]">Empty bay</span>
            ) : (
              bayModules.map((mod) => {
                const bay = bays.find((item) => item.id === mod.bayId);
                const label =
                  mod.type === "drawer-pack"
                    ? `${mod.drawerCount ?? 3}-Dr`
                    : MODULE_LABEL[mod.type];
                const active = mod.id === selectedModuleId;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => selectModule(mod.id)}
                    className="touch-chip bay-chip"
                    data-active={active}
                  >
                    {label}
                    {bay ? ` · B${bay.index + 1}` : ""}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="toolbar-section">
          {bayDrawer && (
            <>
              <span className="toolbar-label">Drawers</span>
              <button
                type="button"
                disabled={(bayDrawer.drawerCount ?? 3) <= MIN_DRAWER_COUNT}
                onClick={() =>
                  setDrawerCount(
                    bayDrawer.id,
                    (bayDrawer.drawerCount ?? 3) - 1,
                  )
                }
                className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
                title="Fewer drawers"
              >
                −
              </button>
              <select
                value={bayDrawer.drawerCount ?? defaultDrawerCount}
                onChange={(event) =>
                  setDrawerCount(bayDrawer.id, Number(event.target.value))
                }
                className="toolbar-select"
                title="Drawer count"
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
                disabled={(bayDrawer.drawerCount ?? 3) >= MAX_DRAWER_COUNT}
                onClick={() =>
                  setDrawerCount(
                    bayDrawer.id,
                    (bayDrawer.drawerCount ?? 3) + 1,
                  )
                }
                className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
                title="More drawers"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => sendModuleToFloor(bayDrawer.id)}
                className="touch-btn"
              >
                Floor
              </button>
            </>
          )}
          {selectedModule && (
            <button
              type="button"
              onClick={() => removeModule(selectedModule.id)}
              className="touch-btn touch-btn-danger"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
