"use client";

import { useEffect, useState } from "react";
import { DRAWER_BAY_WIDTH_MM } from "@/lib/constants";
import { exportQuotePdf } from "@/lib/exportQuote";
import {
  canAddDrawer,
  canAddRail,
  canAddShelf,
} from "@/lib/placement";
import {
  MAX_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  type ModuleType,
  useWardrobeStore,
} from "@/store/store";

const MODULE_OPTIONS: {
  type: ModuleType;
  label: string;
  short: string;
  accent: string;
}[] = [
  { type: "shelf", label: "Shelf", short: "Shelf", accent: "#3f6f64" },
  {
    type: "drawer-pack",
    label: "Drawer Unit",
    short: "Drawer",
    accent: "#8d6b45",
  },
  {
    type: "hanging-rail",
    label: "Hanging Rail",
    short: "Rail",
    accent: "#5b6472",
  },
];

export function TopBar() {
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const materials = useWardrobeStore((state) => state.materials);
  const bayCountInput = useWardrobeStore((state) => state.bayCountInput);
  const defaultDrawerCount = useWardrobeStore(
    (state) => state.defaultDrawerCount,
  );

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
  const selectBay = useWardrobeStore((state) => state.selectBay);
  const addModule = useWardrobeStore((state) => state.addModule);
  const setSlidingDoors = useWardrobeStore((state) => state.setSlidingDoors);
  const setMirrorSide = useWardrobeStore((state) => state.setMirrorSide);
  const setBayWidth = useWardrobeStore((state) => state.setBayWidth);

  const [widthDraft, setWidthDraft] = useState(String(wardrobe.width));
  const [heightDraft, setHeightDraft] = useState(String(wardrobe.height));
  const [bayWidthDraft, setBayWidthDraft] = useState("");
  const [exporting, setExporting] = useState(false);

  const selectedBay = bays.find((bay) => bay.id === selectedBayId) ?? null;
  const bayLocked = Boolean(selectedBay?.lockedWidth);

  useEffect(() => {
    setWidthDraft(String(wardrobe.width));
  }, [wardrobe.width]);

  useEffect(() => {
    setHeightDraft(String(wardrobe.height));
  }, [wardrobe.height]);

  useEffect(() => {
    setBayWidthDraft(selectedBay ? String(selectedBay.width) : "");
  }, [selectedBay]);

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

  const commitBayWidth = () => {
    if (!selectedBay || bayLocked) return;
    const parsed = Number(bayWidthDraft);
    if (!Number.isFinite(parsed)) {
      setBayWidthDraft(String(selectedBay.width));
      return;
    }
    setBayWidth(selectedBay.id, parsed);
  };

  const nudgeBayWidth = (delta: number) => {
    if (!selectedBay || bayLocked) return;
    setBayWidth(selectedBay.id, selectedBay.width + delta);
  };

  const handleCreatePdf = async () => {
    const canvasElement = document.getElementById("wardrobe-canvas-capture");
    const bomElement = document.getElementById("bill-of-materials");
    if (!canvasElement || exporting) return;

    setExporting(true);
    try {
      await exportQuotePdf({
        canvasElement,
        bomElement,
        fileName: `fenix-wardrobe-${wardrobe.width}x${wardrobe.height}.pdf`,
      });
    } finally {
      setExporting(false);
    }
  };

  const sortedBays = [...bays].sort((a, b) => a.index - b.index);
  const canAdd = Boolean(selectedBayId) || bays.length > 0;
  const activeBayId = selectedBayId ?? bays[0]?.id ?? null;
  const activeBayModules = activeBayId
    ? modules.filter((mod) => mod.bayId === activeBayId)
    : [];

  const moduleEnabled = (type: ModuleType): boolean => {
    if (!canAdd) return false;
    if (type === "shelf") {
      return canAddShelf(
        activeBayModules,
        wardrobe.height,
        wardrobe.carcassHeight,
      );
    }
    if (type === "drawer-pack") return canAddDrawer(activeBayModules);
    return canAddRail(
      activeBayModules,
      wardrobe.height,
      wardrobe.carcassHeight,
    );
  };

  const moduleTitle = (type: ModuleType, label: string): string => {
    if (!canAdd) return label;
    if (type === "shelf" && !moduleEnabled(type)) {
      return "No shelves in a double-hang bay";
    }
    if (type === "drawer-pack" && !moduleEnabled(type)) {
      return "No drawers in a double-hang bay";
    }
    if (type === "hanging-rail" && !moduleEnabled(type)) {
      return "Max 2 rails per bay";
    }
    return label;
  };

  return (
    <header className="toolbar-shell relative z-20 w-full border-b border-[var(--line)] bg-white/95 backdrop-blur-xl">
      <div className="toolbar-row">
        <div className="toolbar-brand shrink-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            Fenix
          </p>
          <p className="brand-title font-[family-name:var(--font-display)] font-semibold tracking-tight text-[var(--ink)]">
            Wardrobe
          </p>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Size</span>
          <label className="toolbar-field">
            <span>W</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Width mm"
              value={widthDraft}
              onChange={(event) =>
                setWidthDraft(event.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={commitWidth}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="toolbar-input w-[5rem]"
            />
          </label>
          <label className="toolbar-field">
            <span>H</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Height mm"
              value={heightDraft}
              onChange={(event) =>
                setHeightDraft(event.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={commitHeight}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="toolbar-input w-[5rem]"
            />
          </label>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Bays</span>
          <select
            aria-label="Bay count"
            value={bayCountInput}
            onChange={(event) => setBayCountInput(Number(event.target.value))}
            className="toolbar-select"
          >
            {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => divideIntoBays(bayCountInput)}
            className="touch-btn"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => applyStandardLayout()}
            className="touch-btn"
            title="Reset to standard layout"
          >
            Reset
          </button>
        </div>

        <div className="toolbar-section">
          <button
            type="button"
            className="touch-chip"
            data-active={materials.slidingDoors}
            onClick={() => setSlidingDoors(!materials.slidingDoors)}
            title="Sliding doors"
          >
            Sliding
          </button>
          <button
            type="button"
            className="touch-chip"
            data-active={materials.mirrorSide === "left"}
            onClick={() =>
              setMirrorSide(
                materials.mirrorSide === "left" ? "none" : "left",
              )
            }
            title="Mirror on left door"
          >
            Mir L
          </button>
          <button
            type="button"
            className="touch-chip"
            data-active={materials.mirrorSide === "right"}
            onClick={() =>
              setMirrorSide(
                materials.mirrorSide === "right" ? "none" : "right",
              )
            }
            title="Mirror on right door"
          >
            Mir R
          </button>
          <button
            type="button"
            className="touch-btn touch-btn-primary"
            disabled={exporting}
            onClick={() => {
              void handleCreatePdf();
            }}
          >
            {exporting ? "…" : "PDF"}
          </button>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-secondary">
        <div className="toolbar-section min-w-0">
          <div className="bay-strip">
            {sortedBays.map((bay) => (
              <button
                key={bay.id}
                type="button"
                onClick={() => selectBay(bay.id)}
                className="touch-chip bay-chip"
                data-active={bay.id === selectedBayId}
                title={`Bay ${bay.index + 1} — ${bay.width} mm`}
              >
                B{bay.index + 1}·{bay.width}
                {bay.lockedWidth ? "D" : ""}
              </button>
            ))}
          </div>
        </div>

        {selectedBay && (
          <div className="toolbar-section">
            <button
              type="button"
              disabled={bayLocked}
              onClick={() => nudgeBayWidth(-50)}
              className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
            >
              −50
            </button>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Selected bay width mm"
              value={bayWidthDraft}
              disabled={bayLocked}
              onChange={(event) =>
                setBayWidthDraft(event.target.value.replace(/[^\d]/g, ""))
              }
              onBlur={commitBayWidth}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="toolbar-input w-[5.5rem] disabled:opacity-60"
            />
            <button
              type="button"
              disabled={bayLocked}
              onClick={() => nudgeBayWidth(50)}
              className="touch-btn disabled:cursor-not-allowed disabled:opacity-40"
            >
              +50
            </button>
            {bayLocked && (
              <span className="text-xs text-[var(--muted)]">
                {DRAWER_BAY_WIDTH_MM}
              </span>
            )}
          </div>
        )}

        <div className="toolbar-section">
          <select
            aria-label="Drawer count"
            value={
              modules.find(
                (mod) =>
                  mod.bayId === selectedBayId && mod.type === "drawer-pack",
              )?.drawerCount ?? defaultDrawerCount
            }
            onChange={(event) =>
              setDefaultDrawerCount(Number(event.target.value))
            }
            className="toolbar-select"
            title="Drawer count for selected bay (or new units)"
          >
            {Array.from(
              { length: MAX_DRAWER_COUNT - MIN_DRAWER_COUNT + 1 },
              (_, index) => MIN_DRAWER_COUNT + index,
            ).map((count) => (
              <option key={count} value={count}>
                {count} dr
              </option>
            ))}
          </select>
          {MODULE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => addModule(option.type)}
              disabled={!moduleEnabled(option.type)}
              className="touch-btn touch-btn-add disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: `${option.accent}55` }}
              title={moduleTitle(option.type, option.label)}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: option.accent }}
              />
              {option.type === "drawer-pack"
                ? `${defaultDrawerCount} Dr`
                : option.short}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
