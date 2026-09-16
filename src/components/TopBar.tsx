"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { doorBreakdownLines } from "@/lib/wardrobeDoors";
import { UnitTabMenu } from "@/components/UnitTabMenu";
import { ToolbarMenu, ToolbarMenuItem, ToolbarMenuSep } from "@/components/ToolbarMenu";
import {
  resolveUnitDepths,
  unitQuoteCopy,
} from "@/lib/mediaLayout";
import {
  canAddDrawer,
  canAddRail,
  canAddShelf,
  neighborBayHasShelves,
} from "@/lib/placement";
import {
  MAX_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  type ModuleType,
  isValidClientEmail,
  useWardrobeStore,
} from "@/store/store";

export function TopBar({
  onAddTvUnit,
  onOpenWardrobePanel,
  onOpenInfoPanel,
}: {
  onAddTvUnit?: () => void;
  onOpenWardrobePanel?: () => void;
  onOpenInfoPanel?: () => void;
}) {
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const materials = useWardrobeStore((state) => state.materials);
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const kickerEnabled = useWardrobeStore((state) => state.kickerEnabled);
  const kickerHeight = useWardrobeStore((state) => state.kickerHeight);
  const tvNiche = useWardrobeStore((state) => state.tvNiche);
  const isMedia = unitMode === "media";
  const kickerMm = isMedia && kickerEnabled ? kickerHeight : 0;
  const displayHeight = wardrobe.height + kickerMm;

  const setWardrobeWidth = useWardrobeStore((state) => state.setWardrobeWidth);
  const setWardrobeHeight = useWardrobeStore((state) => state.setWardrobeHeight);
  const setWardrobeDepth = useWardrobeStore((state) => state.setWardrobeDepth);
  const setWardrobeDepthTotal = useWardrobeStore(
    (state) => state.setWardrobeDepthTotal,
  );
  const setDefaultDrawerCount = useWardrobeStore(
    (state) => state.setDefaultDrawerCount,
  );
  const setUnitMode = useWardrobeStore((state) => state.setUnitMode);
  const setKickerEnabled = useWardrobeStore((state) => state.setKickerEnabled);
  const placeTvNicheOnSelection = useWardrobeStore(
    (state) => state.placeTvNicheOnSelection,
  );
  const addModule = useWardrobeStore((state) => state.addModule);
  const evenSpaceShelves = useWardrobeStore((state) => state.evenSpaceShelves);
  const clearBay = useWardrobeStore((state) => state.clearBay);
  const alignTvShelvesWithOuterBays = useWardrobeStore(
    (state) => state.alignTvShelvesWithOuterBays,
  );
  const unitCaption = useWardrobeStore((state) => state.unitCaption);
  const extraNotes = useWardrobeStore((state) => state.extraNotes);
  const clientName = useWardrobeStore((state) => state.clientName);
  const clientEmail = useWardrobeStore((state) => state.clientEmail);
  const setClientNameRequired = useWardrobeStore(
    (state) => state.setClientNameRequired,
  );
  const setClientEmailRequired = useWardrobeStore(
    (state) => state.setClientEmailRequired,
  );
  const setDoorSystemRequired = useWardrobeStore(
    (state) => state.setDoorSystemRequired,
  );
  const doorSystemRequired = useWardrobeStore(
    (state) => state.doorSystemRequired,
  );
  const doorSystemPromptKey = useWardrobeStore(
    (state) => state.doorSystemPromptKey,
  );

  const depths = resolveUnitDepths(wardrobe, unitMode);
  const [widthDraft, setWidthDraft] = useState(String(wardrobe.width));
  const [heightDraft, setHeightDraft] = useState(String(displayHeight));
  const [depthDraft, setDepthDraft] = useState(String(depths.depth));
  const [depthTotalDraft, setDepthTotalDraft] = useState(
    String(depths.depthTotal),
  );
  const [exporting, setExporting] = useState(false);

  const selectedBay = bays.find((bay) => bay.id === selectedBayId) ?? null;
  const selectedBayShelves = selectedBay
    ? modules.filter(
        (mod) => mod.bayId === selectedBay.id && mod.type === "shelf",
      ).length
    : 0;

  useEffect(() => {
    setWidthDraft(String(wardrobe.width));
  }, [wardrobe.width]);

  useEffect(() => {
    setHeightDraft(String(displayHeight));
  }, [displayHeight]);

  useEffect(() => {
    setDepthDraft(String(depths.depth));
    setDepthTotalDraft(String(depths.depthTotal));
  }, [depths.depth, depths.depthTotal]);

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
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setHeightDraft(String(displayHeight));
      return;
    }
    if (isMedia && kickerMm > 0) {
      setWardrobeHeight(Math.max(600, Math.round(parsed) - kickerMm));
      return;
    }
    setWardrobeHeight(parsed);
  };

  const commitDepth = () => {
    const parsed = Number(depthDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDepthDraft(String(depths.depth));
      return;
    }
    setWardrobeDepth(parsed);
  };

  const commitDepthTotal = () => {
    const parsed = Number(depthTotalDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDepthTotalDraft(String(depths.depthTotal));
      return;
    }
    setWardrobeDepthTotal(parsed);
  };

  const commitSizeMenu = () => {
    commitWidth();
    commitHeight();
    commitDepth();
    if (!isMedia) commitDepthTotal();
  };

  const handleCreatePdf = async () => {
    const missingName = !clientName.trim();
    const missingEmail = !isValidClientEmail(clientEmail);
    if (missingName || missingEmail) {
      setClientNameRequired(missingName);
      setClientEmailRequired(missingEmail);
      onOpenInfoPanel?.();
      return;
    }

    const store = useWardrobeStore.getState();
    const designs = store.commitAndGetDesigns();
    const originId = store.activeDesignId;
    const missingDoors = designs.find(
      (item) =>
        item.unitMode === "wardrobe" && item.materials.doorSystem === "none",
    );
    if (missingDoors) {
      if (missingDoors.id !== originId) {
        store.switchDesign(missingDoors.id);
      }
      setDoorSystemRequired(true);
      onOpenWardrobePanel?.();
      return;
    }

    const canvasElement = document.getElementById("wardrobe-canvas-capture");
    if (!canvasElement || exporting) return;

    setExporting(true);
    const hadHighlight = store.canvasHighlight;
    try {
      const { captureUnitJpeg, exportQuotePdf } = await import(
        "@/lib/exportQuote"
      );
      const waitPaint = async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        await new Promise((resolve) => window.setTimeout(resolve, 40));
      };

      const units = [];
      for (const design of designs) {
        flushSync(() => {
          const live = useWardrobeStore.getState();
          if (live.activeDesignId !== design.id) {
            live.switchDesign(design.id);
          }
          useWardrobeStore.getState().clearCanvasHighlight();
          useWardrobeStore.getState().setPdfExporting(true);
        });
        await waitPaint();

        const live = useWardrobeStore.getState();
        const quote = unitQuoteCopy(live.wardrobe, live.unitMode);
        units.push({
          imageData: await captureUnitJpeg(canvasElement),
          unitCaption: live.unitCaption,
          dimensions: quote.dimensions,
          measurements: quote.measurements,
          doorNotes:
            live.unitMode === "wardrobe"
              ? doorBreakdownLines(live.wardrobe.width, live.materials)
              : [],
          unitMode: live.unitMode,
        });
      }

      const clientSlug = clientName
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase();
      await exportQuotePdf({
        units,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        extraNotes,
        fileName: `fenix-${clientSlug}.pdf`,
      });
    } finally {
      flushSync(() => {
        const live = useWardrobeStore.getState();
        if (live.activeDesignId !== originId) {
          live.switchDesign(originId);
        }
        useWardrobeStore.setState({
          pdfExporting: false,
          canvasHighlight: hadHighlight,
        });
      });
      setExporting(false);
    }
  };

  const handleAddTv = () => {
    placeTvNicheOnSelection();
    onAddTvUnit?.();
  };

  const handleEven = () => {
    if (!selectedBay) return;
    evenSpaceShelves(selectedBay.id, {
      target: "bay",
      remainder: "bottom",
    });
  };

  const handleAlign = () => {
    if (!selectedBay) return;
    evenSpaceShelves(selectedBay.id, { target: "sides" });
  };

  const canAlignShelves =
    Boolean(selectedBay) &&
    selectedBayShelves >= 1 &&
    neighborBayHasShelves(modules, bays, selectedBay!.id);

  const pdfBlockedReason = !clientName.trim()
    ? "Enter client name before saving PDF"
    : !isValidClientEmail(clientEmail)
      ? "Enter a valid client email before saving PDF"
      : !isMedia && materials.doorSystem === "none"
        ? "Select a door system before saving PDF"
        : null;

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
        isMedia ? wardrobe.height : wardrobe.carcassHeight,
        isMedia ? { zoneTop: 0 } : undefined,
      );
    }
    if (isMedia) return false;
    if (type === "drawer-pack") {
      return bays.some((bay) =>
        canAddDrawer(modules.filter((mod) => mod.bayId === bay.id)),
      );
    }
    return canAddRail(
      activeBayModules,
      wardrobe.height,
      wardrobe.carcassHeight,
    );
  };

  return (
    <header className="toolbar-shell toolbar-shell-one relative z-50 w-full border-b border-[var(--line)] bg-white">
      <div className="toolbar-row toolbar-row-one desktop-only">
        <div className="toolbar-cluster shrink-0">
          <div className="toolbar-brand">
            <p className="brand-title font-[family-name:var(--font-display)] font-semibold tracking-tight text-[var(--ink)]">
              FENIX
            </p>
          </div>

          <div className="mode-seg" role="group" aria-label="Unit type">
            <button
              type="button"
              className="mode-seg-btn"
              data-active={!isMedia}
              aria-pressed={!isMedia}
              onClick={() => setUnitMode("wardrobe")}
            >
              Wardrobe
            </button>
            <button
              type="button"
              className="mode-seg-btn"
              data-active={isMedia}
              aria-pressed={isMedia}
              onClick={() => setUnitMode("media")}
            >
              TV / Bookshelf
            </button>
          </div>

          <UnitTabMenu />

          <ToolbarMenu
            label="Size"
            triggerClassName="toolbar-menu-trigger touch-btn"
            panelClassName="toolbar-menu-size"
            title="Unit measurements"
            panelRole="dialog"
            onClose={commitSizeMenu}
          >
            <SizeMeasureFields
              widthDraft={widthDraft}
              setWidthDraft={setWidthDraft}
              commitWidth={commitWidth}
              heightDraft={heightDraft}
              setHeightDraft={setHeightDraft}
              commitHeight={commitHeight}
              isMedia={isMedia}
              depthDraft={depthDraft}
              setDepthDraft={setDepthDraft}
              commitDepth={commitDepth}
              depthTotalDraft={depthTotalDraft}
              setDepthTotalDraft={setDepthTotalDraft}
              commitDepthTotal={commitDepthTotal}
            />
          </ToolbarMenu>
        </div>

        <div className="toolbar-cluster toolbar-cluster-grow justify-end">
          <div className="toolbar-btn-group" role="group" aria-label="Add fittings">
            <button
              type="button"
              className="touch-btn touch-btn-add"
              disabled={!moduleEnabled("shelf")}
              onClick={() => addModule("shelf")}
            >
              + Shelf
            </button>

            {!isMedia && (
              <>
                <ToolbarMenu
                  label="+ Drawer"
                  align="right"
                  disabled={!moduleEnabled("drawer-pack")}
                  triggerClassName="toolbar-menu-trigger touch-btn-drawer"
                >
                  {Array.from(
                    { length: MAX_DRAWER_COUNT - MIN_DRAWER_COUNT + 1 },
                    (_, index) => MIN_DRAWER_COUNT + index,
                  ).map((count) => (
                    <ToolbarMenuItem
                      key={count}
                      disabled={!moduleEnabled("drawer-pack")}
                      onClick={() => {
                        setDefaultDrawerCount(count);
                        addModule("drawer-pack");
                      }}
                    >
                      {count} drawer{count === 1 ? "" : "s"}
                    </ToolbarMenuItem>
                  ))}
                </ToolbarMenu>
                <button
                  type="button"
                  className="touch-btn touch-btn-rail"
                  disabled={!moduleEnabled("hanging-rail")}
                  onClick={() => addModule("hanging-rail")}
                >
                  + Rail
                </button>
              </>
            )}
          </div>

          {!isMedia && (
            <div className="toolbar-btn-group" role="group" aria-label="Doors">
              <button
                key={`doors-desktop-${doorSystemPromptKey}`}
                type="button"
                className="touch-btn touch-btn-doors"
                data-active={materials.doorSystem !== "none"}
                data-attention={doorSystemRequired}
                onClick={() => onOpenWardrobePanel?.()}
                title="Doors, mirrors & materials"
              >
                {materials.doorSystem === "none"
                  ? "Doors"
                  : materials.doorsVisible
                    ? materials.doorSystem === "sliding"
                      ? "Sliding"
                      : "Hinged"
                    : "Doors hidden"}
              </button>
            </div>
          )}

          {isMedia && (
            <div className="toolbar-btn-group" role="group" aria-label="TV unit">
              {!tvNiche && (
                <button
                  type="button"
                  className="touch-btn touch-btn-primary"
                  onClick={handleAddTv}
                >
                  Add TV
                </button>
              )}
              {tvNiche && (
                <button
                  type="button"
                  className="touch-btn touch-btn-primary"
                  onClick={() => alignTvShelvesWithOuterBays()}
                  title="Align TV-column shelves with outer bay shelves"
                >
                  Align TV
                </button>
              )}
              <button
                type="button"
                className="touch-btn"
                onClick={() => setKickerEnabled(!kickerEnabled)}
              >
                {kickerEnabled ? `Kicker ${kickerHeight}` : "Kicker"}
              </button>
            </div>
          )}

          {selectedBay && (
            <div className="toolbar-btn-group" role="group" aria-label="Bay">
              <button
                type="button"
                className="touch-btn touch-btn-even"
                disabled={selectedBayShelves < 1}
                onClick={handleEven}
                title="Even shelves in this bay"
              >
                Even
              </button>
              <button
                type="button"
                className="touch-btn touch-btn-align"
                disabled={!canAlignShelves}
                onClick={handleAlign}
                title="Line shelves up with the neighbouring bay"
              >
                Align
              </button>
              <button
                type="button"
                className="touch-btn"
                onClick={() => clearBay(selectedBay.id)}
              >
                Clear
              </button>
            </div>
          )}

          <div className="toolbar-btn-group" role="group" aria-label="Export">
            <button
              type="button"
              className="touch-btn touch-btn-pdf"
              disabled={exporting}
              title={pdfBlockedReason ?? "Save PDF"}
              onClick={() => {
                void handleCreatePdf();
              }}
            >
              {exporting ? "…" : "PDF"}
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar-row toolbar-row-compact compact-only">
        <p className="brand-title compact-brand font-[family-name:var(--font-display)] font-semibold tracking-tight text-[var(--ink)]">
          FENIX
        </p>
        <ToolbarMenu
          label="Size"
          triggerClassName="toolbar-menu-trigger touch-btn"
          panelClassName="toolbar-menu-size"
          title="Size and unit"
          panelRole="dialog"
          onClose={commitSizeMenu}
        >
          <div className="toolbar-menu-field">
            <span>Type</span>
            <div className="mode-seg compact-mode-seg" role="group" aria-label="Unit type">
              <button
                type="button"
                className="mode-seg-btn"
                data-active={!isMedia}
                data-close-menu
                onClick={() => setUnitMode("wardrobe")}
              >
                Wardrobe
              </button>
              <button
                type="button"
                className="mode-seg-btn"
                data-active={isMedia}
                data-close-menu
                onClick={() => setUnitMode("media")}
              >
                TV
              </button>
            </div>
          </div>
          <div className="toolbar-menu-field compact-tab-field">
            <span>Unit</span>
            <UnitTabMenu />
          </div>
          <SizeMeasureFields
            widthDraft={widthDraft}
            setWidthDraft={setWidthDraft}
            commitWidth={commitWidth}
            heightDraft={heightDraft}
            setHeightDraft={setHeightDraft}
            commitHeight={commitHeight}
            isMedia={isMedia}
            depthDraft={depthDraft}
            setDepthDraft={setDepthDraft}
            commitDepth={commitDepth}
            depthTotalDraft={depthTotalDraft}
            setDepthTotalDraft={setDepthTotalDraft}
            commitDepthTotal={commitDepthTotal}
          />
          {isMedia && (
            <>
              <ToolbarMenuSep />
              <ToolbarMenuItem
                onClick={() => setKickerEnabled(!kickerEnabled)}
              >
                {kickerEnabled ? `Kicker ${kickerHeight} on` : "Kicker off"}
              </ToolbarMenuItem>
            </>
          )}
        </ToolbarMenu>
        <ToolbarMenu
          label="Add"
          triggerClassName="toolbar-menu-trigger touch-btn-add"
          title="Add fittings"
        >
          <ToolbarMenuItem
            disabled={!moduleEnabled("shelf")}
            onClick={() => addModule("shelf")}
          >
            Shelf
          </ToolbarMenuItem>
          {!isMedia && (
            <>
              {Array.from(
                { length: MAX_DRAWER_COUNT - MIN_DRAWER_COUNT + 1 },
                (_, index) => MIN_DRAWER_COUNT + index,
              ).map((count) => (
                <ToolbarMenuItem
                  key={count}
                  disabled={!moduleEnabled("drawer-pack")}
                  onClick={() => {
                    setDefaultDrawerCount(count);
                    addModule("drawer-pack");
                  }}
                >
                  {count} drawers
                </ToolbarMenuItem>
              ))}
              <ToolbarMenuItem
                disabled={!moduleEnabled("hanging-rail")}
                onClick={() => addModule("hanging-rail")}
              >
                Rail
              </ToolbarMenuItem>
            </>
          )}
          {isMedia && !tvNiche && (
            <ToolbarMenuItem onClick={handleAddTv}>TV unit</ToolbarMenuItem>
          )}
        </ToolbarMenu>
        <button
          type="button"
          className="touch-btn"
          onClick={() => onOpenInfoPanel?.()}
        >
          Notes
        </button>
        {!isMedia && (
          <button
            key={`doors-compact-${doorSystemPromptKey}`}
            type="button"
            className="touch-btn touch-btn-doors"
            data-active={materials.doorSystem !== "none"}
            data-attention={doorSystemRequired}
            onClick={() => onOpenWardrobePanel?.()}
          >
            Doors
          </button>
        )}
        {isMedia && tvNiche && (
          <button
            type="button"
            className="touch-btn touch-btn-primary"
            onClick={() => onAddTvUnit?.()}
          >
            TV
          </button>
        )}
        <button
          type="button"
          className="touch-btn touch-btn-pdf"
          disabled={exporting}
          title={pdfBlockedReason ?? "Save PDF"}
          onClick={() => {
            void handleCreatePdf();
          }}
        >
          {exporting ? "…" : "PDF"}
        </button>
      </div>
    </header>
  );
}

function SizeMeasureFields({
  widthDraft,
  setWidthDraft,
  commitWidth,
  heightDraft,
  setHeightDraft,
  commitHeight,
  isMedia,
  depthDraft,
  setDepthDraft,
  commitDepth,
  depthTotalDraft,
  setDepthTotalDraft,
  commitDepthTotal,
}: {
  widthDraft: string;
  setWidthDraft: (value: string) => void;
  commitWidth: () => void;
  heightDraft: string;
  setHeightDraft: (value: string) => void;
  commitHeight: () => void;
  isMedia: boolean;
  depthDraft: string;
  setDepthDraft: (value: string) => void;
  commitDepth: () => void;
  depthTotalDraft: string;
  setDepthTotalDraft: (value: string) => void;
  commitDepthTotal: () => void;
}) {
  const digits = (value: string) => value.replace(/[^\d]/g, "");
  return (
    <>
      <div className="toolbar-menu-field">
        <span>Length mm</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Length along wall mm"
          value={widthDraft}
          suppressHydrationWarning
          onChange={(event) => setWidthDraft(digits(event.target.value))}
          onBlur={commitWidth}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="toolbar-input"
        />
      </div>
      <div className="toolbar-menu-field">
        <span>Width mm</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={
            isMedia ? "Width / overall height mm including kicker" : "Width mm"
          }
          value={heightDraft}
          suppressHydrationWarning
          onChange={(event) => setHeightDraft(digits(event.target.value))}
          onBlur={commitHeight}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="toolbar-input"
        />
      </div>
      <div className="toolbar-menu-field">
        <span>Depth inside mm</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Depth inside mm"
          value={depthDraft}
          suppressHydrationWarning
          onChange={(event) => setDepthDraft(digits(event.target.value))}
          onBlur={commitDepth}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="toolbar-input"
        />
      </div>
      {!isMedia && (
        <div className="toolbar-menu-field">
          <span>Depth total mm</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="Depth total mm"
            value={depthTotalDraft}
            suppressHydrationWarning
            onChange={(event) => setDepthTotalDraft(digits(event.target.value))}
            onBlur={commitDepthTotal}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="toolbar-input"
          />
        </div>
      )}
      <p className="toolbar-size-hint">
        {isMedia
          ? "TV unit base: 350 mm inside."
          : "Wardrobe base: 450 mm inside, 600 mm overall."}
      </p>
      <button
        type="button"
        className="touch-btn touch-btn-primary w-full"
        data-close-menu
      >
        Apply size
      </button>
    </>
  );
}
