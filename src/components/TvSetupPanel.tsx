"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  formatMountLabel,
  formatViewingDistance,
  getTvPreset,
  matchTvPresetFromOpening,
  TV_BEZEL_STEP_MM,
  TV_GENERIC_STAND_EXTRA_MM,
  TV_SIZE_PRESETS,
  TV_VIEWING_DISTANCE_EXTRA,
  tvBodyFromSelection,
  tvModelsForInches,
  tvOpeningFromSelection,
  type TvMountType,
} from "@/lib/tvSizes";
import { useWardrobeStore } from "@/store/store";

type TvFoldId = "position" | "view";

function TvFold({
  id,
  title,
  summary,
  openId,
  onOpen,
  children,
}: {
  id: TvFoldId;
  title: string;
  summary: string;
  openId: TvFoldId;
  onOpen: (id: TvFoldId) => void;
  children: ReactNode;
}) {
  const open = openId === id;
  return (
    <section className="section-card tv-fold !p-0" data-open={open}>
      <button
        type="button"
        className="tv-fold-trigger"
        aria-expanded={open}
        onClick={() => onOpen(id)}
      >
        <span className="tv-fold-copy">
          <span className="tv-fold-title">{title}</span>
          {!open && summary ? (
            <span className="tv-fold-summary">{summary}</span>
          ) : null}
        </span>
        <span className="tv-fold-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? <div className="tv-fold-body space-y-2">{children}</div> : null}
    </section>
  );
}

export function TvSetupPanel({ onClose }: { onClose?: () => void }) {
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const tvNiche = useWardrobeStore((state) => state.tvNiche);

  const setTvOpeningHeight = useWardrobeStore(
    (state) => state.setTvOpeningHeight,
  );
  const setTvWidth = useWardrobeStore((state) => state.setTvWidth);
  const setTvBottomFromKicker = useWardrobeStore(
    (state) => state.setTvBottomFromKicker,
  );
  const placeTvNicheOnSelection = useWardrobeStore(
    (state) => state.placeTvNicheOnSelection,
  );
  const applyTvSelection = useWardrobeStore((state) => state.applyTvSelection);
  const setTvBezelMm = useWardrobeStore((state) => state.setTvBezelMm);
  const setTvMountType = useWardrobeStore((state) => state.setTvMountType);
  const clearTvNiche = useWardrobeStore((state) => state.clearTvNiche);

  const [hDraft, setHDraft] = useState("");
  const [wDraft, setWDraft] = useState("");
  const [bottomDraft, setBottomDraft] = useState("");
  const [showDistanceInfo, setShowDistanceInfo] = useState(false);
  const [openFold, setOpenFold] = useState<TvFoldId>("position");

  useEffect(() => {
    if (!tvNiche) {
      setHDraft("");
      setWDraft("");
      setBottomDraft("");
      return;
    }
    setHDraft(String(tvNiche.height));
    setWDraft(String(tvNiche.width));
    setBottomDraft(String(tvNiche.bottomFromKicker));
  }, [tvNiche?.height, tvNiche?.width, tvNiche?.bottomFromKicker, tvNiche]);

  if (unitMode !== "media") return null;

  const mountType: TvMountType = tvNiche?.mountType ?? "wall";
  const selectedInches =
    tvNiche?.selectedInches ??
    (tvNiche
      ? matchTvPresetFromOpening(tvNiche.width, tvNiche.height, mountType)
          ?.inches
      : undefined);
  const modelsForSize = selectedInches
    ? tvModelsForInches(selectedInches)
    : [];
  const matchedPreset = selectedInches
    ? getTvPreset(selectedInches)
    : undefined;
  const bezelMm = tvNiche?.bezelMm ?? 0;
  const nichePreview =
    selectedInches != null
      ? tvOpeningFromSelection({
          inches: selectedInches,
          mount: mountType,
          modelId: tvNiche?.tvModelId,
          bezelMm,
        })
      : null;
  const bodyPreview =
    selectedInches != null
      ? tvBodyFromSelection({
          inches: selectedInches,
          mount: mountType,
          modelId: tvNiche?.tvModelId,
        })
      : null;

  const commitH = () => {
    if (!tvNiche) return;
    const n = Number(hDraft);
    if (!Number.isFinite(n) || n <= 0) {
      setHDraft(String(tvNiche.height));
      return;
    }
    setTvOpeningHeight(n);
  };

  const commitW = () => {
    if (!tvNiche) return;
    const n = Number(wDraft);
    if (!Number.isFinite(n) || n <= 0) {
      setWDraft(String(tvNiche.width));
      return;
    }
    setTvWidth(n);
  };

  const commitBottom = () => {
    if (!tvNiche) return;
    const n = Number(bottomDraft);
    if (!Number.isFinite(n) || n < 0) {
      setBottomDraft(String(tvNiche.bottomFromKicker));
      return;
    }
    setTvBottomFromKicker(n);
  };

  return (
    <div className="tv-panel flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Media unit
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
            TV setup
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="touch-btn !min-h-8 !min-w-8"
            onClick={onClose}
            title="Hide panel"
          >
            ›
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!tvNiche ? (
          <button
            type="button"
            className="btn-primary !py-2.5 !text-sm"
            onClick={() => placeTvNicheOnSelection()}
          >
            Add TV bay
          </button>
        ) : (
          <>
            <section className="section-card space-y-3 !p-3.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent-deep)]">
                  TV size
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">
                  {selectedInches != null
                    ? `${selectedInches}" · ${formatMountLabel(mountType)}`
                    : "Choose a size"}
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--ink)]">
                  Screen size
                </span>
                <select
                  className="field-input tv-select"
                  aria-label="TV screen size"
                  value={selectedInches ?? ""}
                  onChange={(event) => {
                    const inches = Number(event.target.value);
                    if (!Number.isFinite(inches)) return;
                    applyTvSelection(inches, null);
                  }}
                >
                  <option value="" disabled>
                    Select size
                  </option>
                  {TV_SIZE_PRESETS.map((preset) => {
                    const body = tvBodyFromSelection({
                      inches: preset.inches,
                      mount: mountType,
                    });
                    return (
                      <option key={preset.inches} value={preset.inches}>
                        {preset.inches}&quot; — {body.widthMm} × {body.heightMm}{" "}
                        mm
                      </option>
                    );
                  })}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                {(["wall", "stand"] as TvMountType[]).map((mount) => {
                  const active = mountType === mount;
                  return (
                    <button
                      key={mount}
                      type="button"
                      className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${
                        active
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                          : "border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--ink)]"
                      }`}
                      onClick={() => setTvMountType(mount)}
                    >
                      {formatMountLabel(mount)}
                    </button>
                  );
                })}
              </div>

              {selectedInches != null && (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    Brand model
                  </span>
                  <select
                    className="field-input tv-select"
                    aria-label="TV brand model"
                    value={tvNiche.tvModelId ?? ""}
                    onChange={(event) => {
                      const id = event.target.value;
                      applyTvSelection(
                        selectedInches,
                        id === "" ? null : id,
                      );
                    }}
                  >
                    <option value="">Generic {selectedInches}&quot;</option>
                    {modelsForSize.map((model) => {
                      const body = tvBodyFromSelection({
                        inches: model.inches,
                        mount: mountType,
                        modelId: model.id,
                      });
                      return (
                        <option key={model.id} value={model.id}>
                          {model.brand} {model.name} — {body.widthMm} ×{" "}
                          {body.heightMm} mm
                        </option>
                      );
                    })}
                  </select>
                  {modelsForSize.length === 0 && (
                    <p className="text-[11px] text-[var(--muted)]">
                      No listed models for this size — uses generic screen
                      {mountType === "stand"
                        ? ` + ${TV_GENERIC_STAND_EXTRA_MM} mm stand`
                        : ""}
                      .
                    </p>
                  )}
                </label>
              )}

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-[var(--ink)]">
                  Bezel each edge
                </span>
                <div className="tv-stepper" role="group" aria-label="Bezel mm">
                  <button
                    type="button"
                    className="touch-btn"
                    disabled={bezelMm <= 0}
                    onClick={() => setTvBezelMm(bezelMm - TV_BEZEL_STEP_MM)}
                    aria-label="Less bezel"
                  >
                    −
                  </button>
                  <span className="tv-stepper-value">{bezelMm} mm</span>
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() => setTvBezelMm(bezelMm + TV_BEZEL_STEP_MM)}
                    aria-label="More bezel"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-[var(--muted)]">
                  Not added automatically. + / − changes clearance by{" "}
                  {TV_BEZEL_STEP_MM} mm on every edge.
                </p>
              </div>

              {bodyPreview && nichePreview && (
                <p className="rounded-xl border border-[var(--line)] bg-[#f7f8fa] px-3 py-2.5 text-sm leading-snug text-[var(--ink)]">
                  TV {bodyPreview.widthMm} × {bodyPreview.heightMm} mm
                  {bezelMm > 0 ? ` + ${bezelMm} mm bezel` : ""}. Opening{" "}
                  <span className="font-semibold">
                    {nichePreview.widthMm} × {nichePreview.heightMm} mm
                  </span>
                  {matchedPreset
                    ? ` · view ~${formatViewingDistance(matchedPreset.viewingDistanceM)}`
                    : ""}
                  .
                </p>
              )}
            </section>

            <TvFold
              id="position"
              title="Opening & position"
              summary={`${tvNiche.width} × ${tvNiche.height} mm`}
              openId={openFold}
              onOpen={setOpenFold}
            >
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ink)]">
                  Width (mm)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() => setTvWidth(tvNiche.width - 50)}
                  >
                    −
                  </button>
                  <input
                    className="field-input !px-2 !py-1.5 !text-sm"
                    value={wDraft}
                    inputMode="numeric"
                    suppressHydrationWarning
                    onChange={(e) =>
                      setWDraft(e.target.value.replace(/[^\d]/g, ""))
                    }
                    onBlur={commitW}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() => setTvWidth(tvNiche.width + 50)}
                  >
                    +
                  </button>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ink)]">
                  Height (mm)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() => setTvOpeningHeight(tvNiche.height - 50)}
                  >
                    −
                  </button>
                  <input
                    className="field-input !px-2 !py-1.5 !text-sm"
                    value={hDraft}
                    inputMode="numeric"
                    suppressHydrationWarning
                    onChange={(e) =>
                      setHDraft(e.target.value.replace(/[^\d]/g, ""))
                    }
                    onBlur={commitH}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() => setTvOpeningHeight(tvNiche.height + 50)}
                  >
                    +
                  </button>
                </div>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--ink)]">
                  Bottom from floor (mm)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() =>
                      setTvBottomFromKicker(tvNiche.bottomFromKicker - 50)
                    }
                  >
                    −
                  </button>
                  <input
                    className="field-input !px-2 !py-1.5 !text-sm"
                    value={bottomDraft}
                    inputMode="numeric"
                    suppressHydrationWarning
                    onChange={(e) =>
                      setBottomDraft(e.target.value.replace(/[^\d]/g, ""))
                    }
                    onBlur={commitBottom}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <button
                    type="button"
                    className="touch-btn"
                    onClick={() =>
                      setTvBottomFromKicker(tvNiche.bottomFromKicker + 50)
                    }
                  >
                    +
                  </button>
                </div>
              </label>
            </TvFold>

            <TvFold
              id="view"
              title="Viewing distance"
              summary={
                matchedPreset
                  ? `~${formatViewingDistance(matchedPreset.viewingDistanceM)}`
                  : "Pick a screen size"
              }
              openId={openFold}
              onOpen={setOpenFold}
            >
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="touch-chip !min-h-7 !px-2 !text-[0.65rem]"
                  data-active={showDistanceInfo}
                  onClick={() => setShowDistanceInfo((v) => !v)}
                >
                  Info
                </button>
              </div>
              {matchedPreset ? (
                <p className="text-sm font-semibold text-[var(--ink)]">
                  ~{formatViewingDistance(matchedPreset.viewingDistanceM)} for{" "}
                  {matchedPreset.inches}&quot;
                </p>
              ) : (
                <p className="text-[11px] text-[var(--muted)]">
                  Pick a screen size above for a recommended distance.
                </p>
              )}
              {showDistanceInfo && (
                <div className="space-y-2">
                  <p className="rounded-lg border border-[var(--line)] bg-[#f7f8fa] px-2.5 py-2 text-[11px] leading-snug text-[var(--muted)]">
                    <span className="font-semibold text-[var(--ink)]">
                      Disclaimer:
                    </span>{" "}
                    Screen size figures do not include bezels or stands. Overall
                    dimensions vary by brand — do your research and choose the
                    right size for your TV.
                  </p>
                  <div className="overflow-hidden rounded-lg border border-[var(--line)]">
                    <table className="tv-info-table w-full">
                      <thead>
                        <tr>
                          <th>Screen</th>
                          <th>Distance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TV_SIZE_PRESETS.map((row) => (
                          <tr
                            key={row.inches}
                            data-active={matchedPreset?.inches === row.inches}
                          >
                            <td>{row.inches}&quot;</td>
                            <td>
                              {formatViewingDistance(row.viewingDistanceM)}
                            </td>
                          </tr>
                        ))}
                        {TV_VIEWING_DISTANCE_EXTRA.map((row) => (
                          <tr key={row.inches}>
                            <td>{row.inches}&quot;</td>
                            <td>
                              {formatViewingDistance(row.viewingDistanceM)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TvFold>

            <button
              type="button"
              className="touch-btn touch-btn-danger w-full !justify-center"
              onClick={() => clearTvNiche()}
            >
              Remove TV
            </button>
          </>
        )}
      </div>
    </div>
  );
}
