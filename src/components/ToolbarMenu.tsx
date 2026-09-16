"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function ToolbarMenu({
  label,
  children,
  align = "left",
  triggerClassName,
  panelClassName,
  disabled = false,
  hideCaret = false,
  title,
  onClose,
  panelRole = "menu",
}: {
  label: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
  panelClassName?: string;
  disabled?: boolean;
  hideCaret?: boolean;
  title?: string;
  onClose?: () => void;
  panelRole?: "menu" | "dialog";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const menuId = useId();

  const updatePosition = () => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = Math.min(
      panel?.offsetWidth || 192,
      Math.max(160, window.innerWidth - 16),
    );
    const panelHeight = panel?.offsetHeight || 88;
    const gap = 6;
    let left =
      align === "right" ? rect.right - panelWidth : rect.left;
    left = Math.min(
      Math.max(8, left),
      window.innerWidth - panelWidth - 8,
    );
    let top = rect.bottom + gap;
    if (top + panelHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - gap - panelHeight);
    }
    setCoords({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const id = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(id);
  }, [open, align]);

  const close = () => {
    setOpen(false);
    onCloseRef.current?.();
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onReposition = () => updatePosition();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, align]);

  return (
    <div className="toolbar-menu" ref={rootRef} data-open={open}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? "toolbar-menu-trigger"}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={title}
        title={title}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((value) => {
            if (value) onCloseRef.current?.();
            return !value;
          });
        }}
      >
        {label}
        {!hideCaret && (
          <span className="toolbar-menu-caret" aria-hidden>
            ▾
          </span>
        )}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            className={`toolbar-menu-panel toolbar-menu-panel-fixed${
              panelClassName ? ` ${panelClassName}` : ""
            }`}
            data-align={align}
            role={panelRole}
            aria-label={title}
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { top: -9999, left: -9999, visibility: "hidden" }
            }
          >
            <div
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("button, [data-close-menu]")) {
                  close();
                }
              }}
            >
              {children}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function ToolbarMenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`toolbar-menu-item${danger ? " is-danger" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ToolbarMenuSep() {
  return <div className="toolbar-menu-sep" role="separator" />;
}
