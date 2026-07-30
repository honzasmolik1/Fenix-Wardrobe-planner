import type {
  BoardMaterial,
  HardwareTier,
  Materials,
  Module,
  ModuleType,
  Wardrobe,
} from "@/store/store";

export interface BomLineItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const MODULE_BASE_PRICES: Record<ModuleType, number> = {
  shelf: 45,
  "drawer-pack": 320,
  "hanging-rail": 55,
};

const MODULE_LABELS: Record<ModuleType, string> = {
  shelf: "Shelf",
  "drawer-pack": "3-Drawer Unit",
  "hanging-rail": "Hanging Rail",
};

const BOARD_MULTIPLIER: Record<BoardMaterial, number> = {
  "white-melamine": 1,
  woodgrain: 1.35,
};

const HARDWARE_MULTIPLIER: Record<HardwareTier, number> = {
  standard: 1,
  "soft-close": 1.25,
};

function moduleUnitPrice(type: ModuleType, materials: Materials): number {
  const base = MODULE_BASE_PRICES[type];
  const board = BOARD_MULTIPLIER[materials.boardMaterial];
  const hardware =
    type === "drawer-pack"
      ? HARDWARE_MULTIPLIER[materials.hardwareTier]
      : 1;
  return Math.round(base * board * hardware);
}

export function buildBillOfMaterials(
  modules: Module[],
  wardrobe: Wardrobe,
  materials: Materials,
  bayCount: number,
): { items: BomLineItem[]; total: number } {
  const items: BomLineItem[] = [];

  const carcassBase =
    Math.round(((wardrobe.width * wardrobe.height) / 1_000_000) * 180) +
    bayCount * 65;
  const carcassPrice = Math.round(
    carcassBase * BOARD_MULTIPLIER[materials.boardMaterial],
  );

  items.push({
    id: "carcass",
    label: `Carcass & uprights (${bayCount} bay${bayCount === 1 ? "" : "s"})`,
    quantity: 1,
    unitPrice: carcassPrice,
    total: carcassPrice,
  });

  const counts: Record<ModuleType, number> = {
    shelf: 0,
    "drawer-pack": 0,
    "hanging-rail": 0,
  };

  for (const mod of modules) {
    counts[mod.type] += 1;
  }

  (Object.keys(counts) as ModuleType[]).forEach((type) => {
    const quantity = counts[type];
    if (quantity === 0) return;
    const unitPrice = moduleUnitPrice(type, materials);
    items.push({
      id: type,
      label: MODULE_LABELS[type],
      quantity,
      unitPrice,
      total: unitPrice * quantity,
    });
  });

  if (materials.slidingDoors) {
    const doorPanels = Math.max(2, bayCount);
    const doorUnit =
      Math.round((wardrobe.height / 1000) * 220) *
      BOARD_MULTIPLIER[materials.boardMaterial];
    const trackPrice =
      materials.hardwareTier === "soft-close" ? 280 : 160;
    const doorsTotal = Math.round(doorUnit * doorPanels + trackPrice);

    items.push({
      id: "sliding-doors",
      label: `Sliding doors (${doorPanels} panels + track)`,
      quantity: 1,
      unitPrice: doorsTotal,
      total: doorsTotal,
    });

    if (materials.mirrorSide !== "none") {
      const mirrorPrice = Math.round((wardrobe.height / 1000) * 180);
      const side =
        materials.mirrorSide === "left" ? "left" : "right";
      items.push({
        id: "mirror-door",
        label: `Mirror insert (${side} door)`,
        quantity: 1,
        unitPrice: mirrorPrice,
        total: mirrorPrice,
      });
    }
  }

  const total = items.reduce((sum, item) => sum + item.total, 0);
  return { items, total };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(amount);
}
