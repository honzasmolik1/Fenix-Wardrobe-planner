"use client";

import { useEffect, useRef } from "react";
import { TV_SIZE_DISCLAIMER } from "@/lib/mediaLayout";
import { doorBreakdownLines } from "@/lib/wardrobeDoors";
import { useWardrobeStore } from "@/store/store";

const fieldClass =
  "field-input doors-field w-full !min-h-[3.1rem] !px-3 !py-2.5 !text-base bg-white";

export function InfoSetupPanel({ onClose }: { onClose?: () => void }) {
  const unitCaption = useWardrobeStore((state) => state.unitCaption);
  const clientName = useWardrobeStore((state) => state.clientName);
  const clientNameRequired = useWardrobeStore(
    (state) => state.clientNameRequired,
  );
  const clientEmail = useWardrobeStore((state) => state.clientEmail);
  const clientEmailRequired = useWardrobeStore(
    (state) => state.clientEmailRequired,
  );
  const extraNotes = useWardrobeStore((state) => state.extraNotes);
  const setUnitCaption = useWardrobeStore((state) => state.setUnitCaption);
  const setClientName = useWardrobeStore((state) => state.setClientName);
  const setClientEmail = useWardrobeStore((state) => state.setClientEmail);
  const setExtraNotes = useWardrobeStore((state) => state.setExtraNotes);
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const designs = useWardrobeStore((state) => state.designs);
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const materials = useWardrobeStore((state) => state.materials);
  const captionFallback =
    unitMode === "media" ? "Living room" : "Master bedroom";
  const doorLines = doorBreakdownLines(wardrobe.width, materials);
  const hasTvUnit =
    unitMode === "media" || designs.some((item) => item.unitMode === "media");
  const clientInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!clientNameRequired) return;
    clientInputRef.current?.focus();
    clientInputRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [clientNameRequired]);

  useEffect(() => {
    if (!clientEmailRequired || clientNameRequired) return;
    emailInputRef.current?.focus();
    emailInputRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [clientEmailRequired, clientNameRequired]);

  return (
    <div className="tv-panel doors-panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Drawing
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
            Description
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
            Details
          </p>
          <p className="text-sm leading-snug text-[var(--muted)]">
            Title on the PDF is always{" "}
            <span className="font-semibold text-[var(--ink)]">
              Fenix Wardrobes & Joinery
            </span>
            . Client name prints directly underneath.
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              Client name{" "}
              <span className="text-[var(--accent-deep)]">*</span>
            </span>
            <input
              ref={clientInputRef}
              suppressHydrationWarning
              type="text"
              required
              aria-required="true"
              aria-invalid={clientNameRequired}
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className={`${fieldClass}${
                clientNameRequired ? " field-input-error" : ""
              }`}
              placeholder="Required before PDF"
            />
            {clientNameRequired && (
              <p className="text-sm font-medium text-[#9b2c2c]">
                Enter the client name before saving the PDF.
              </p>
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">
              Client email{" "}
              <span className="text-[var(--accent-deep)]">*</span>
            </span>
            <input
              ref={emailInputRef}
              suppressHydrationWarning
              type="email"
              required
              aria-required="true"
              aria-invalid={clientEmailRequired}
              autoComplete="email"
              inputMode="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              className={`${fieldClass}${
                clientEmailRequired ? " field-input-error" : ""
              }`}
              placeholder="Required before PDF"
            />
            {clientEmailRequired && (
              <p className="text-sm font-medium text-[#9b2c2c]">
                Enter a valid client email before saving the PDF.
              </p>
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[var(--ink)]">Room</span>
            <input
              suppressHydrationWarning
              type="text"
              value={unitCaption}
              onChange={(event) => setUnitCaption(event.target.value)}
              className={fieldClass}
              placeholder={captionFallback}
            />
          </label>
        </section>

        <section className="space-y-3 border-t border-[var(--line)] pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Notes
          </p>
          {hasTvUnit && (
            <div className="rounded-xl border border-[var(--line)] bg-[#f7f4ef] px-3.5 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                TV disclaimer
              </p>
              <p className="mt-2 text-sm leading-snug text-[var(--ink)]">
                {TV_SIZE_DISCLAIMER}
              </p>
              <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
                Printed on TV / bookshelf pages of the PDF only. Wardrobe
                pages do not include this note.
              </p>
            </div>
          )}
          <label className="block space-y-1.5">
            <textarea
              suppressHydrationWarning
              value={extraNotes}
              onChange={(event) => setExtraNotes(event.target.value)}
              rows={6}
              className={`${fieldClass} !min-h-[8.5rem] resize-y leading-snug`}
              placeholder="Handles, install notes, colour extras…"
            />
          </label>
          {doorLines.length > 0 && (
            <div className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                Door system
              </p>
              <ul className="mt-2 space-y-1 text-sm leading-snug text-[var(--ink)]">
                {doorLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
                Added to the PDF description automatically.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
