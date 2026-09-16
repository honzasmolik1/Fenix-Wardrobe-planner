"use client";

import { useEffect, useState } from "react";
import { InfoSetupPanel } from "@/components/InfoSetupPanel";
import { SelectionDock } from "@/components/SelectionDock";
import { TopBar } from "@/components/TopBar";
import { TvSetupPanel } from "@/components/TvSetupPanel";
import { WardrobeSetupPanel } from "@/components/WardrobeSetupPanel";
import { WardrobeCanvasLoader } from "@/components/WardrobeCanvasLoader";
import { useWardrobeStore } from "@/store/store";

export default function HomePage() {
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const tvNiche = useWardrobeStore((state) => state.tvNiche);
  const isMedia = unitMode === "media";
  const [hydrated, setHydrated] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [tvPanelOpen, setTvPanelOpen] = useState(false);
  const [wardrobePanelOpen, setWardrobePanelOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isMedia) {
      setTvPanelOpen(false);
      return;
    }
    setWardrobePanelOpen(false);
    if (tvNiche) setTvPanelOpen(true);
  }, [hydrated, isMedia, tvNiche]);

  useEffect(() => {
    if (isMedia) setWardrobePanelOpen(false);
  }, [isMedia]);

  const showTvChrome = isMedia && Boolean(tvNiche);
  const showWardrobeChrome = !isMedia;
  const doorSystemRequired = useWardrobeStore(
    (state) => state.doorSystemRequired,
  );
  const doorSystemPromptKey = useWardrobeStore(
    (state) => state.doorSystemPromptKey,
  );

  if (!hydrated) {
    return (
      <main className="app-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-white text-sm text-[var(--muted)]">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <TopBar
        onAddTvUnit={() => setTvPanelOpen(true)}
        onOpenWardrobePanel={() => setWardrobePanelOpen(true)}
        onOpenInfoPanel={() => setInfoPanelOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="info-panel-shell"
          data-open={infoPanelOpen}
          aria-hidden={!infoPanelOpen}
        >
          <InfoSetupPanel onClose={() => setInfoPanelOpen(false)} />
        </aside>

        <div className="side-tab-stack-left" data-open={infoPanelOpen}>
          <button
            type="button"
            className="tv-panel-tab info-panel-tab"
            data-open={infoPanelOpen}
            onClick={() => setInfoPanelOpen((open) => !open)}
            title={infoPanelOpen ? "Hide description" : "Description"}
            aria-expanded={infoPanelOpen}
          >
            {infoPanelOpen ? "Hide" : "Description"}
          </button>
        </div>

        <div
          id="wardrobe-canvas-capture"
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-white touch-none"
        >
          <WardrobeCanvasLoader />
        </div>

        {showTvChrome && (
          <>
            <aside
              className="tv-panel-shell"
              data-open={tvPanelOpen}
              aria-hidden={!tvPanelOpen}
            >
              <TvSetupPanel onClose={() => setTvPanelOpen(false)} />
            </aside>

            <div className="side-tab-stack" data-open={tvPanelOpen}>
              <button
                type="button"
                className="tv-panel-tab"
                data-open={tvPanelOpen}
                onClick={() => setTvPanelOpen((open) => !open)}
                title={tvPanelOpen ? "Hide TV panel" : "Show TV panel"}
                aria-expanded={tvPanelOpen}
              >
                {tvPanelOpen ? "Hide" : "TV"}
              </button>
            </div>
          </>
        )}

        {showWardrobeChrome && (
          <>
            <aside
              className="tv-panel-shell"
              data-open={wardrobePanelOpen}
              aria-hidden={!wardrobePanelOpen}
            >
              <WardrobeSetupPanel onClose={() => setWardrobePanelOpen(false)} />
            </aside>

            <div className="side-tab-stack" data-open={wardrobePanelOpen}>
              <button
                key={doorSystemPromptKey || "doors-tab"}
                type="button"
                className="tv-panel-tab"
                data-open={wardrobePanelOpen}
                data-attention={doorSystemRequired}
                onClick={() => setWardrobePanelOpen((open) => !open)}
                title={
                  wardrobePanelOpen
                    ? "Hide doors & materials"
                    : "Doors & materials"
                }
                aria-expanded={wardrobePanelOpen}
              >
                {wardrobePanelOpen ? "Hide" : "Doors"}
              </button>
            </div>
          </>
        )}
      </div>

      <SelectionDock />
    </main>
  );
}
