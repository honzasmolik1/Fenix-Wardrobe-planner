"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWardrobeStore } from "@/store/store";

export function UnitTabMenu() {
  const designs = useWardrobeStore((state) => state.designs);
  const activeDesignId = useWardrobeStore((state) => state.activeDesignId);
  const unitTabLabel = useWardrobeStore((state) => state.unitTabLabel);
  const addDesign = useWardrobeStore((state) => state.addDesign);
  const switchDesign = useWardrobeStore((state) => state.switchDesign);
  const renameDesign = useWardrobeStore((state) => state.renameDesign);
  const removeDesign = useWardrobeStore((state) => state.removeDesign);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 260;
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      );
      setMenuPos({ top: rect.bottom + 6, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setEditingId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const commitRename = () => {
    if (!editingId) return;
    renameDesign(editingId, draft);
    setEditingId(null);
  };

  const startRename = (id: string, label: string) => {
    setEditingId(id);
    setDraft(label);
    setOpen(true);
  };

  return (
    <div className="quote-tab-wrap" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="quote-tab"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch, add, or rename units"
        onClick={() => {
          setOpen((value) => !value);
          setEditingId(null);
        }}
      >
        <span className="quote-tab-mark">Tab</span>
        <span className="quote-tab-name">{unitTabLabel}</span>
        <span className="quote-tab-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open &&
        menuPos &&
        createPortal(
        <div
          ref={menuRef}
          className="quote-tab-menu quote-tab-menu-fixed"
          role="menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {designs.map((design) => (
            <div
              key={design.id}
              className="quote-tab-row"
              data-active={design.id === activeDesignId}
            >
              {editingId === design.id ? (
                <input
                  ref={inputRef}
                  className="quote-tab-rename"
                  value={draft}
                  aria-label="Rename unit"
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className="quote-tab-pick"
                  onClick={() => {
                    switchDesign(design.id);
                    setOpen(false);
                  }}
                >
                  {design.label}
                </button>
              )}
              <button
                type="button"
                className="quote-tab-icon"
                title="Rename"
                aria-label={`Rename ${design.label}`}
                onClick={() => startRename(design.id, design.label)}
              >
                ✎
              </button>
              {designs.length > 1 && (
                <button
                  type="button"
                  className="quote-tab-icon"
                  title="Remove"
                  aria-label={`Remove ${design.label}`}
                  onClick={() => removeDesign(design.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <div className="quote-tab-divider" />

          <button
            type="button"
            className="quote-tab-add"
            onClick={() => {
              addDesign("wardrobe");
              const next = useWardrobeStore.getState();
              startRename(next.activeDesignId, next.unitTabLabel);
            }}
          >
            + Add wardrobe
          </button>
          <button
            type="button"
            className="quote-tab-add"
            onClick={() => {
              addDesign("media");
              const next = useWardrobeStore.getState();
              startRename(next.activeDesignId, next.unitTabLabel);
            }}
          >
            + Add TV unit
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
