"use client";

import { useEffect, useRef, useState } from "react";
import { WARDROBE_SIZE_PRESETS } from "@/lib/wardrobeSizes";
import { useWardrobeStore } from "@/store/store";

export function SlidingSizeMenu() {
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const applyWardrobeSizePreset = useWardrobeStore(
    (state) => state.applyWardrobeSizePreset,
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activePreset = WARDROBE_SIZE_PRESETS.find(
    (preset) =>
      wardrobe.width === preset.width &&
      wardrobe.height === preset.height &&
      wardrobe.depth === preset.depth,
  );

  return (
    <div className="size-menu-wrap" ref={rootRef}>
      <button
        type="button"
        className="tv-panel-tab size-tab"
        data-open={open}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Wardrobe unit sizes"
        onClick={() => setOpen((value) => !value)}
      >
        Size
      </button>

      {open && (
        <div className="size-menu" role="listbox" aria-label="Unit size">
          <p className="size-menu-kicker">Unit size</p>
          <p className="size-menu-hint">
            Sets wardrobe length × width × depth inside / total. Doors follow
            length automatically: 2 doors up to 2400 mm, 3 doors above. Current
            unit {wardrobe.width} × {wardrobe.height} × {wardrobe.depth} /{" "}
            {wardrobe.depthTotal ?? 600} mm. Wardrobe base is 450 mm inside,
            600 mm overall.
          </p>
          <div className="size-menu-list">
            {WARDROBE_SIZE_PRESETS.map((preset) => {
              const active = activePreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="size-menu-item"
                  data-active={active}
                  onClick={() => {
                    applyWardrobeSizePreset(preset.id);
                    setOpen(false);
                  }}
                >
                  <span className="size-menu-label">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
