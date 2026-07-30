"use client";

import { useEffect, useState } from "react";
import { DRAWER_BAY_WIDTH_MM } from "@/lib/constants";
import {
  MAX_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  type BoardMaterial,
  type HardwareTier,
  type ModuleType,
  useWardrobeStore,
} from "@/store/store";

const MODULE_OPTIONS: {
  type: ModuleType;
  label: string;
  hint: string;
  accent: string;
}[] = [
  {
    type: "shelf",
    label: "Shelf",
    hint: "Aligns across bays",
    accent: "#3f6f64",
  },
  {
    type: "drawer-pack",
    label: "Drawer Unit",
    hint: "Fixed 600 mm bay",
    accent: "#8d6b45",
  },
  {
    type: "hanging-rail",
    label: "Hanging Rail",
    hint: "~1000 mm clearance",
    accent: "#5b6472",
  },
];

const WIDTH_PRESETS = [1800, 2100, 2400, 2700, 3000, 3600] as const;
const HEIGHT_PRESETS = [2100, 2400, 2700] as const;

export function Sidebar() {
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const bays = useWardrobeStore((state) => state.bays);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const selectedModuleId = useWardrobeStore((state) => state.selectedModuleId);
  const materials = useWardrobeStore((state) => state.materials);
  const bayCountInput = useWardrobeStore((state) => state.bayCountInput);
  const defaultDrawerCount = useWardrobeStore(
    (state) => state.defaultDrawerCount,
  );
  const modules = useWardrobeStore((state) => state.modules);

  const setWardrobeWidth = useWardrobeStore((state) => state.setWardrobeWidth);
  const setWardrobeHeight = useWardrobeStore((state) => state.setWardrobeHeight);
  const setBayCountInput = useWardrobeStore((state) => state.setBayCountInput);
  const setDefaultDrawerCount = useWardrobeStore(
    (state) => state.setDefaultDrawerCount,
  );
  const divideIntoBays = useWardrobeStore((state) => state.divideIntoBays);
  const applyStandardLayout = useWardrobeStore(
    (state) => state.applyStandardLayout,
  );
  const swapBayWithNeighbor = useWardrobeStore(
    (state) => state.swapBayWithNeighbor,
  );
  const selectBay = useWardrobeStore((state) => state.selectBay);
  const selectModule = useWardrobeStore((state) => state.selectModule);
  const addModule = useWardrobeStore((state) => state.addModule);
  const sendModuleToFloor = useWardrobeStore(
    (state) => state.sendModuleToFloor,
  );
  const setDrawerCount = useWardrobeStore((state) => state.setDrawerCount);
  const removeModule = useWardrobeStore((state) => state.removeModule);
  const setBoardMaterial = useWardrobeStore((state) => state.setBoardMaterial);
  const setHardwareTier = useWardrobeStore((state) => state.setHardwareTier);
  const setSlidingDoors = useWardrobeStore((state) => state.setSlidingDoors);

  // Draft strings so users can clear/rewrite freely; commit on blur or Enter
  const [widthDraft, setWidthDraft] = useState(String(wardrobe.width));
  const [heightDraft, setHeightDraft] = useState(String(wardrobe.height));

  useEffect(() => {
    setWidthDraft(String(wardrobe.width));
  }, [wardrobe.width]);

  useEffect(() => {
    setHeightDraft(String(wardrobe.height));
  }, [wardrobe.height]);

  const commitWidth = () => {
    const parsed = Number(widthDraft);
    if (!Number.isFinite(parsed)) {
      setWidthDraft(String(wardrobe.width));
      return;
    }
    setWardrobeWidth(parsed);
  };

  const commitHeight = () => {
    const parsed = Number(heightDraft);
    if (!Number.isFinite(parsed)) {
      setHeightDraft(String(wardrobe.height));
      return;
    }
    setWardrobeHeight(parsed);
  };

  const selectedBay = bays.find((bay) => bay.id === selectedBayId) ?? null;
  const selectedModule =
    modules.find((mod) => mod.id === selectedModuleId) ?? null;
  const sortedBays = [...bays].sort((a, b) => a.index - b.index);
  const selectedBayOrder = selectedBay
    ? sortedBays.findIndex((bay) => bay.id === selectedBay.id)
    : -1;

  return (
    <aside className="panel-glass flex h-full w-full max-w-[400px] flex-col border-l border-[var(--line)]">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <p className="hero-kicker">Specification</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)]">
          Configure
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <section className="section-card space-y-2.5 !p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Wardrobe size
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--ink)]">
                Width (mm)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={widthDraft}
                onChange={(event) =>
                  setWidthDraft(event.target.value.replace(/[^\d]/g, ""))
                }
                onBlur={commitWidth}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                className="field-input !px-2.5 !py-2 !text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--ink)]">
                Height (mm)
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={heightDraft}
                onChange={(event) =>
                  setHeightDraft(event.target.value.replace(/[^\d]/g, ""))
                }
                onBlur={commitHeight}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                className="field-input !px-2.5 !py-2 !text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--ink)]">
                Width preset
              </span>
              <select
                value={
                  WIDTH_PRESETS.includes(
                    wardrobe.width as (typeof WIDTH_PRESETS)[number],
                  )
                    ? String(wardrobe.width)
                    : ""
                }
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (value) setWardrobeWidth(value);
                }}
                className="field-input !px-2.5 !py-2 !text-sm"
              >
                <option value="">Custom…</option>
                {WIDTH_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset} mm
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--ink)]">
                Height preset
              </span>
              <select
                value={
                  HEIGHT_PRESETS.includes(
                    wardrobe.height as (typeof HEIGHT_PRESETS)[number],
                  )
                    ? String(wardrobe.height)
                    : ""
                }
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (value) setWardrobeHeight(value);
                }}
                className="field-input !px-2.5 !py-2 !text-sm"
              >
                <option value="">Custom…</option>
                {HEIGHT_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset} mm
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Type a size, then press Enter. Min width{" "}
            {DRAWER_BAY_WIDTH_MM + 800} mm.
          </p>
        </section>

        <section className="section-card space-y-2.5 !p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Bay layout
          </h2>

          <button
            type="button"
            onClick={() => applyStandardLayout()}
            className="btn-primary !py-2 !text-sm"
          >
            Reset standard layout
          </button>

          <div className="flex items-end gap-2">
            <label className="block min-w-0 flex-1 space-y-1">
              <span className="text-xs font-medium text-[var(--ink)]">
                Bays
              </span>
              <select
                value={bayCountInput}
                onChange={(event) =>
                  setBayCountInput(Number(event.target.value))
                }
                className="field-input !px-2.5 !py-2 !text-sm"
              >
                {Array.from({ length: 8 }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count} bay{count === 1 ? "" : "s"}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={() => divideIntoBays(bayCountInput)}
              className="btn-chip !px-3 !py-2"
            >
              Apply
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sortedBays.map((bay) => (
              <button
                key={bay.id}
                type="button"
                onClick={() => selectBay(bay.id)}
                className="btn-chip !px-2.5 !py-1"
                data-active={bay.id === selectedBayId}
              >
                Bay {bay.index + 1}
                {bay.lockedWidth ? " · D" : ""}
              </button>
            ))}
          </div>

          {selectedBay && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[#f7f8fa] px-2 py-2">
              <button
                type="button"
                disabled={selectedBayOrder <= 0}
                onClick={() => swapBayWithNeighbor(selectedBay.id, "left")}
                className="btn-chip !px-2.5 !py-1 disabled:cursor-not-allowed disabled:opacity-40"
                title="Swap left"
              >
                ←
              </button>
              <p className="min-w-0 flex-1 text-center text-[11px] text-[var(--muted)]">
                Swap Bay {selectedBay.index + 1}
                {selectedBay.lockedWidth ? " (fixed drawer)" : ""}
              </p>
              <button
                type="button"
                disabled={
                  selectedBayOrder < 0 ||
                  selectedBayOrder >= sortedBays.length - 1
                }
                onClick={() => swapBayWithNeighbor(selectedBay.id, "right")}
                className="btn-chip !px-2.5 !py-1 disabled:cursor-not-allowed disabled:opacity-40"
                title="Swap right"
              >
                →
              </button>
            </div>
          )}
        </section>

        <section className="section-card space-y-2.5 !p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Modules
          </h2>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--ink)]">
              Drawers
            </label>
            <select
              value={defaultDrawerCount}
              onChange={(event) =>
                setDefaultDrawerCount(Number(event.target.value))
              }
              className="field-input !w-auto !min-w-[4.5rem] !px-2 !py-1.5 !text-sm"
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
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MODULE_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => addModule(option.type)}
                disabled={!selectedBayId && bays.length === 0}
                className="module-btn !rounded-lg !px-2 !py-2"
                title={option.hint}
              >
                <span
                  className="mx-auto mb-1 block h-1.5 w-1.5 rounded-full"
                  style={{ background: option.accent }}
                />
                <span className="block text-center text-[11px] font-semibold leading-tight text-[var(--ink)]">
                  {option.type === "drawer-pack"
                    ? `${defaultDrawerCount} Dr`
                    : option.label}
                </span>
              </button>
            ))}
          </div>

          {selectedModule?.type === "drawer-pack" && (
            <div className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--ink)]">
                  Drawer count
                </span>
                <select
                  value={selectedModule.drawerCount ?? defaultDrawerCount}
                  onChange={(event) =>
                    setDrawerCount(
                      selectedModule.id,
                      Number(event.target.value),
                    )
                  }
                  className="field-input !w-auto !min-w-[4.5rem] !px-2 !py-1 !text-sm"
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
                  onClick={() => sendModuleToFloor(selectedModule.id)}
                  className="btn-chip ml-auto !px-2 !py-1"
                >
                  Floor
                </button>
              </div>
            </div>
          )}

          {modules.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {modules.map((mod) => {
                const bay = bays.find((item) => item.id === mod.bayId);
                const label =
                  mod.type === "drawer-pack"
                    ? `${mod.drawerCount ?? 3}-Dr`
                    : (MODULE_OPTIONS.find((item) => item.type === mod.type)
                        ?.label ?? mod.type);
                const active = mod.id === selectedModuleId;
                return (
                  <li
                    key={mod.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-[11px] ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--line)] bg-[#f7f8fa]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectModule(mod.id)}
                      className="text-left text-[var(--ink)]"
                    >
                      {label}
                      {bay ? ` · B${bay.index + 1}` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeModule(mod.id)}
                      className="font-semibold text-[var(--accent-deep)]"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="section-card space-y-2.5 !p-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Materials
          </h2>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--ink)]">Board</span>
            <select
              value={materials.boardMaterial}
              onChange={(event) =>
                setBoardMaterial(event.target.value as BoardMaterial)
              }
              className="field-input !px-2.5 !py-2 !text-sm"
            >
              <option value="white-melamine">White Melamine</option>
              <option value="woodgrain">Woodgrain</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--ink)]">
              Hardware
            </span>
            <select
              value={materials.hardwareTier}
              onChange={(event) =>
                setHardwareTier(event.target.value as HardwareTier)
              }
              className="field-input !px-2.5 !py-2 !text-sm"
            >
              <option value="standard">Standard</option>
              <option value="soft-close">Soft-Close</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[#f7f8fa] px-2.5 py-2">
            <span className="text-xs font-medium text-[var(--ink)]">
              Sliding doors
            </span>
            <input
              type="checkbox"
              checked={materials.slidingDoors}
              onChange={(event) => setSlidingDoors(event.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
          </label>
        </section>
      </div>
    </aside>
  );
}
