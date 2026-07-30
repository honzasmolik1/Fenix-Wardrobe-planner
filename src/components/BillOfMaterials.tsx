"use client";

import { buildBillOfMaterials, formatCurrency } from "@/lib/pricing";
import { useWardrobeStore } from "@/store/store";

interface BillOfMaterialsProps {
  bomRef?: React.RefObject<HTMLDivElement | null>;
}

export function BillOfMaterials({ bomRef }: BillOfMaterialsProps) {
  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const materials = useWardrobeStore((state) => state.materials);

  const { items, total } = buildBillOfMaterials(
    modules,
    wardrobe,
    materials,
    bays.length,
  );

  return (
    <div
      ref={bomRef}
      id="bill-of-materials"
      className="rounded-lg border border-[var(--line)] bg-white p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-lg tracking-tight text-[var(--ink)]">
          Bill of Materials
        </h3>
        <p className="text-sm font-semibold text-[var(--accent)]">
          {formatCurrency(total)}
        </p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-2 text-sm last:border-b-0 last:pb-0"
          >
            <div>
              <p className="font-medium text-[var(--ink)]">{item.label}</p>
              <p className="text-xs text-[var(--muted)]">
                Qty {item.quantity} × {formatCurrency(item.unitPrice)}
              </p>
            </div>
            <p className="shrink-0 font-medium text-[var(--ink)]">
              {formatCurrency(item.total)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
        <span className="text-sm font-semibold text-[var(--ink)]">Live total</span>
        <span className="font-[family-name:var(--font-display)] text-xl text-[var(--accent)]">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
