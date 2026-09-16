"use client";

import { useEffect, useRef } from "react";
import {
  type DoorSystem,
  type SlidingDoorFace,
  type SlidingFrameColour,
  useWardrobeStore,
} from "@/store/store";
import {
  normalizeSlidingDoorFaces,
  planDoorPanels,
  doorHasShakerRebate,
} from "@/lib/wardrobeDoors";
import {
  SLIDING_FACE_LABELS,
  SLIDING_FRAME_LABELS,
} from "@/lib/trademasterDoors";

const SLIDING_FACE_OPTIONS = Object.keys(
  SLIDING_FACE_LABELS,
) as SlidingDoorFace[];
const SLIDING_FRAME_OPTIONS = Object.keys(
  SLIDING_FRAME_LABELS,
) as SlidingFrameColour[];

export function WardrobeSetupPanel({ onClose }: { onClose?: () => void }) {
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const materials = useWardrobeStore((state) => state.materials);

  const setDoorSystem = useWardrobeStore((state) => state.setDoorSystem);
  const setDoorsVisible = useWardrobeStore((state) => state.setDoorsVisible);
  const setSlidingDoorFaceAt = useWardrobeStore(
    (state) => state.setSlidingDoorFaceAt,
  );
  const setPolyShakerRebateAt = useWardrobeStore(
    (state) => state.setPolyShakerRebateAt,
  );
  const setSlidingFrameColour = useWardrobeStore(
    (state) => state.setSlidingFrameColour,
  );
  const doorSystemRequired = useWardrobeStore(
    (state) => state.doorSystemRequired,
  );
  const doorSystemPromptKey = useWardrobeStore(
    (state) => state.doorSystemPromptKey,
  );
  const doorSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!doorSystemRequired) return;
    doorSelectRef.current?.focus();
    doorSelectRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [doorSystemRequired, doorSystemPromptKey]);

  if (unitMode !== "wardrobe") return null;

  const system = materials.doorSystem;
  const doorsConfigured = system !== "none";
  const plan =
    system === "none"
      ? null
      : planDoorPanels({
          system,
          wardrobeWidth: wardrobe.width,
          wardrobeHeight: wardrobe.height,
          carcassHeight: wardrobe.carcassHeight,
          slidingDoorHeightMm: materials.slidingDoorHeightMm,
          slidingWidthMode: materials.slidingWidthMode,
          slidingFace: materials.slidingFace,
          slidingLeafCount: materials.slidingLeafCount,
          slidingDoorFaces: materials.slidingDoorFaces,
        });

  const leafCount = plan?.count ?? 2;
  const doorFaces = normalizeSlidingDoorFaces(
    materials.slidingDoorFaces,
    leafCount,
    materials.slidingFace,
  );
  const selectClass =
    "field-input doors-field w-full !min-h-[3.1rem] !px-3 !py-2.5 !text-base";

  return (
    <div className="tv-panel doors-panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Wardrobe
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
            Doors
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            className="touch-btn !min-h-11 !min-w-11 !text-base"
            onClick={onClose}
            aria-label="Close panel"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Door system
          </p>
          <select
            ref={doorSelectRef}
            suppressHydrationWarning
            aria-label="Door system"
            aria-invalid={doorSystemRequired}
            value={system}
            onChange={(event) =>
              setDoorSystem(event.target.value as DoorSystem)
            }
            className={`${selectClass}${
              doorSystemRequired ? " field-input-error" : ""
            }`}
          >
            <option value="none">No doors</option>
            <option value="sliding">Sliding doors</option>
            <option value="hinged">Hinged doors</option>
          </select>
          {doorSystemRequired && (
            <p className="text-sm font-medium text-[#9b2c2c]">
              You need to select door system
            </p>
          )}

          {system !== "none" && (
            <div className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-3">
              <p className="text-base font-semibold text-[var(--ink)]">
                {leafCount} doors
              </p>
            </div>
          )}
        </section>

        {doorsConfigured && (
          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Each door
            </p>
            {doorFaces.map((face, index) => (
              <div key={`door-face-${index}`} className="space-y-1.5">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    Door {index + 1}
                  </span>
                  <select
                    suppressHydrationWarning
                    aria-label={`Door ${index + 1} material`}
                    value={face}
                    onChange={(event) =>
                      setSlidingDoorFaceAt(
                        index,
                        event.target.value as SlidingDoorFace,
                      )
                    }
                    className={selectClass}
                  >
                    {SLIDING_FACE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {SLIDING_FACE_LABELS[option]}
                      </option>
                    ))}
                  </select>
                </label>
                {face === "poly" && (
                  <label className="doors-shaker-option">
                    <input
                      suppressHydrationWarning
                      type="checkbox"
                      checked={doorHasShakerRebate(
                        face,
                        materials.polyShakerRebate,
                        index,
                      )}
                      onChange={(event) =>
                        setPolyShakerRebateAt(index, event.target.checked)
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span>Shaker rebate</span>
                  </label>
                )}
              </div>
            ))}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--ink)]">
                Aluminium frame
              </span>
              <select
                suppressHydrationWarning
                aria-label="Aluminium frame colour"
                value={materials.slidingFrameColour}
                onChange={(event) =>
                  setSlidingFrameColour(
                    event.target.value as SlidingFrameColour,
                  )
                }
                className={selectClass}
              >
                {SLIDING_FRAME_OPTIONS.map((frame) => (
                  <option key={frame} value={frame}>
                    {SLIDING_FRAME_LABELS[frame]}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {doorsConfigured && (
          <button
            type="button"
            className="touch-btn w-full !min-h-12 !text-base"
            data-active={materials.doorsVisible}
            onClick={() => setDoorsVisible(!materials.doorsVisible)}
          >
            {materials.doorsVisible ? "Hide doors" : "Show doors"}
          </button>
        )}
      </div>
    </div>
  );
}
