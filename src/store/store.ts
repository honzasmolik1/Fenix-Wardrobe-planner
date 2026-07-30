import { create } from "zustand";
import {
  DEFAULT_CARCASS_HEIGHT_MM,
  DEFAULT_DRAWER_COUNT,
  DRAWER_BAY_WIDTH_MM,
  DRAWER_UNIT_HEIGHT_MM,
  JACKET_CLEARANCE_MM,
  MAX_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  MODULE_CLEARANCE_MM,
  MODULE_HEIGHTS,
  SNAP_INCREMENT_MM,
  clampCarcassHeight,
  drawerPackHeight,
} from "@/lib/constants";
import {
  canAddShelf,
  evenSpaceShelvesInBay,
  findDrawerPlacementY,
  findHangingRailPlacementY,
  reconcileModulesForCarcassHeight,
  redistributeShelvesEvenly,
  resolveFloorY,
  resolveModuleY,
} from "@/lib/placement";
import {
  createBaysWithCount,
  createStandardBays,
  createStandardModules,
  remapModulesToBays,
  resizeBaysPreservingLocks,
  setFlexibleBayWidth,
} from "@/lib/standardLayout";

export type ModuleType = "shelf" | "drawer-pack" | "hanging-rail";
export type BoardMaterial = "white-melamine" | "woodgrain";
export type HardwareTier = "standard" | "soft-close";
export type MirrorSide = "none" | "left" | "right";

export interface Wardrobe {
  width: number;
  height: number;
  /** Main carcass height from floor up to the thick construction line */
  carcassHeight: number;
}

export interface Bay {
  id: string;
  index: number;
  width: number;
  /** When set, this bay width is fixed (drawer bay) and never resized */
  lockedWidth?: number;
}

export interface Module {
  id: string;
  type: ModuleType;
  bayId: string;
  /** Distance from the top of the wardrobe interior, in mm */
  y: number;
  /** Vertical size of the module, in mm */
  height: number;
  /** Only for drawer-pack */
  drawerCount?: number;
}

export interface Materials {
  boardMaterial: BoardMaterial;
  hardwareTier: HardwareTier;
  slidingDoors: boolean;
  /** Which sliding door panel has a mirror insert */
  mirrorSide: MirrorSide;
}

export interface WardrobeState {
  wardrobe: Wardrobe;
  bays: Bay[];
  modules: Module[];
  selectedBayId: string | null;
  selectedModuleId: string | null;
  materials: Materials;
  bayCountInput: number;
  defaultDrawerCount: number;

  setWardrobeWidth: (width: number) => void;
  setWardrobeHeight: (height: number) => void;
  setCarcassHeight: (height: number) => void;
  setBayCountInput: (count: number) => void;
  setDefaultDrawerCount: (count: number) => void;
  divideIntoBays: (count: number) => void;
  applyStandardLayout: () => void;
  setBayWidth: (bayId: string, width: number) => void;
  evenSpaceShelves: (bayId?: string) => void;
  swapBayWithNeighbor: (bayId: string, direction: "left" | "right") => void;
  selectBay: (bayId: string | null) => void;
  selectModule: (moduleId: string | null) => void;
  addModule: (type: ModuleType) => void;
  updateModuleY: (moduleId: string, y: number) => void;
  sendModuleToFloor: (moduleId: string) => void;
  setDrawerCount: (moduleId: string, count: number) => void;
  removeModule: (moduleId: string) => void;
  clearBay: (bayId?: string) => void;
  setBoardMaterial: (material: BoardMaterial) => void;
  setHardwareTier: (tier: HardwareTier) => void;
  setSlidingDoors: (enabled: boolean) => void;
  setMirrorSide: (side: MirrorSide) => void;
}

export {
  MODULE_HEIGHTS,
  SNAP_INCREMENT_MM,
  MODULE_CLEARANCE_MM,
  JACKET_CLEARANCE_MM,
  DRAWER_UNIT_HEIGHT_MM,
  DEFAULT_DRAWER_COUNT,
  MIN_DRAWER_COUNT,
  MAX_DRAWER_COUNT,
  drawerPackHeight,
};

const createId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const clampDrawerCount = (count: number) =>
  Math.max(MIN_DRAWER_COUNT, Math.min(MAX_DRAWER_COUNT, Math.round(count)));

const DEFAULT_WIDTH = 2400;
const DEFAULT_HEIGHT = 2400;
const DEFAULT_BAY_COUNT = 3;
const DEFAULT_BAYS = createStandardBays(DEFAULT_WIDTH);
const DEFAULT_MODULES = createStandardModules(DEFAULT_BAYS, DEFAULT_HEIGHT);

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  wardrobe: {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    carcassHeight: DEFAULT_CARCASS_HEIGHT_MM,
  },
  bays: DEFAULT_BAYS,
  modules: DEFAULT_MODULES,
  selectedBayId: DEFAULT_BAYS[0]?.id ?? null,
  selectedModuleId: null,
  materials: {
    boardMaterial: "white-melamine",
    hardwareTier: "standard",
    slidingDoors: false,
    mirrorSide: "none",
  },
  bayCountInput: DEFAULT_BAY_COUNT,
  defaultDrawerCount: DEFAULT_DRAWER_COUNT,

  setWardrobeWidth: (width) => {
    const nextWidth = Math.max(
      DRAWER_BAY_WIDTH_MM + 800,
      Math.round(width),
    );
    set((state) => ({
      wardrobe: { ...state.wardrobe, width: nextWidth },
      bays: resizeBaysPreservingLocks(state.bays, nextWidth),
    }));
  },

  setWardrobeHeight: (height) => {
    const nextHeight = Math.max(600, Math.round(height));
    set((state) => ({
      wardrobe: {
        ...state.wardrobe,
        height: nextHeight,
        carcassHeight: clampCarcassHeight(
          state.wardrobe.carcassHeight,
          nextHeight,
        ),
      },
      modules: state.modules.map((mod) => ({
        ...mod,
        y: Math.min(mod.y, Math.max(0, nextHeight - mod.height)),
      })),
    }));
  },

  setCarcassHeight: (height) => {
    const { wardrobe, modules, bays, selectedModuleId } = get();
    const next = clampCarcassHeight(height, wardrobe.height);
    const nextModules = reconcileModulesForCarcassHeight(
      modules,
      bays.map((bay) => bay.id),
      wardrobe.height,
      next,
    );
    set({
      wardrobe: { ...wardrobe, carcassHeight: next },
      modules: nextModules,
      selectedModuleId:
        selectedModuleId &&
        nextModules.some((mod) => mod.id === selectedModuleId)
          ? selectedModuleId
          : null,
    });
  },

  setBayCountInput: (count) => {
    set({ bayCountInput: Math.max(1, Math.min(12, Math.round(count))) });
  },

  setDefaultDrawerCount: (count) => {
    set({ defaultDrawerCount: clampDrawerCount(count) });
  },

  divideIntoBays: (count) => {
    const { wardrobe, bays, modules } = get();
    const safeCount = Math.max(1, Math.floor(count));
    const keepDrawerBay =
      bays.some((bay) => Boolean(bay.lockedWidth)) ||
      modules.some((mod) => mod.type === "drawer-pack");

    const nextBays = createBaysWithCount(
      wardrobe.width,
      safeCount,
      keepDrawerBay && safeCount >= 2,
    );
    const nextModules = remapModulesToBays(modules, bays, nextBays);

    set({
      bays: nextBays,
      modules: nextModules,
      selectedBayId: nextBays[0]?.id ?? null,
      selectedModuleId: null,
      bayCountInput: safeCount,
    });
  },

  applyStandardLayout: () => {
    const { wardrobe } = get();
    const nextWidth = Math.max(
      DRAWER_BAY_WIDTH_MM + 800,
      wardrobe.width,
    );
    const nextBays = createStandardBays(nextWidth);
    const nextModules = createStandardModules(
      nextBays,
      wardrobe.height,
      wardrobe.carcassHeight,
    );
    set({
      wardrobe: { ...wardrobe, width: nextWidth },
      bays: nextBays,
      modules: nextModules,
      selectedBayId: nextBays[0]?.id ?? null,
      selectedModuleId: null,
      bayCountInput: 3,
    });
  },

  setBayWidth: (bayId, width) => {
    const { wardrobe, bays } = get();
    const target = bays.find((bay) => bay.id === bayId);
    if (!target || target.lockedWidth) return;

    set({
      bays: setFlexibleBayWidth(bays, bayId, width, wardrobe.width),
    });
  },

  evenSpaceShelves: (bayId) => {
    const { selectedBayId, wardrobe, modules } = get();
    const id = bayId ?? selectedBayId;
    if (!id) return;

    set({
      modules: evenSpaceShelvesInBay(
        modules,
        id,
        wardrobe.height,
        wardrobe.carcassHeight,
      ),
      selectedBayId: id,
    });
  },

  swapBayWithNeighbor: (bayId, direction) => {
    set((state) => {
      const sorted = [...state.bays].sort((a, b) => a.index - b.index);
      const index = sorted.findIndex((bay) => bay.id === bayId);
      if (index < 0) return state;

      const swapIndex = direction === "left" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return state;

      const bayA = sorted[index];
      const bayB = sorted[swapIndex];

      // Swap fittings AND widths/locks so the drawer bay keeps its fixed size
      const nextBays = sorted.map((bay, i) => {
        if (i === index) {
          return {
            ...bay,
            width: bayB.width,
            lockedWidth: bayB.lockedWidth,
          };
        }
        if (i === swapIndex) {
          return {
            ...bay,
            width: bayA.width,
            lockedWidth: bayA.lockedWidth,
          };
        }
        return bay;
      });

      const nextModules = state.modules.map((mod) => {
        if (mod.bayId === bayA.id) return { ...mod, bayId: bayB.id };
        if (mod.bayId === bayB.id) return { ...mod, bayId: bayA.id };
        return mod;
      });

      return {
        bays: nextBays,
        modules: nextModules,
        selectedBayId: bayB.id,
        selectedModuleId: null,
      };
    });
  },

  selectBay: (bayId) => set({ selectedBayId: bayId, selectedModuleId: null }),

  selectModule: (moduleId) => {
    const mod = get().modules.find((item) => item.id === moduleId) ?? null;
    set({
      selectedModuleId: moduleId,
      selectedBayId: mod?.bayId ?? get().selectedBayId,
    });
  },

  addModule: (type) => {
    const { selectedBayId, bays, wardrobe, modules, defaultDrawerCount } = get();
    const bayId = selectedBayId ?? bays[0]?.id;
    if (!bayId) return;

    const bayModules = modules.filter((mod) => mod.bayId === bayId);

    if (type === "shelf") {
      if (!canAddShelf(bayModules, wardrobe.height, wardrobe.carcassHeight)) return;

      const id = createId();
      const withShelf: Module[] = [
        ...modules,
        {
          id,
          type,
          bayId,
          y: 0,
          height: MODULE_HEIGHTS.shelf,
        },
      ];

      set({
        modules: redistributeShelvesEvenly(
          withShelf,
          bayId,
          wardrobe.height,
          {
            forceEven: true,
            carcassHeight: wardrobe.carcassHeight,
          },
        ),
        selectedBayId: bayId,
        selectedModuleId: id,
      });
      return;
    }

    if (type === "drawer-pack") {
      const drawerCount = clampDrawerCount(defaultDrawerCount);
      const height = drawerPackHeight(drawerCount);
      const y = findDrawerPlacementY(height, bayModules, wardrobe.height);
      if (y === null) return;

      const id = createId();
      const { bays: currentBays, wardrobe: currentWardrobe } = get();
      // Drawer bay width is fixed forever at DRAWER_BAY_WIDTH_MM
      const lockedBays = currentBays.map((bay) =>
        bay.id === bayId
          ? {
              ...bay,
              width: DRAWER_BAY_WIDTH_MM,
              lockedWidth: DRAWER_BAY_WIDTH_MM,
            }
          : bay,
      );

      set({
        bays: resizeBaysPreservingLocks(lockedBays, currentWardrobe.width),
        modules: [
          ...modules,
          {
            id,
            type,
            bayId,
            y,
            height,
            drawerCount,
          },
        ],
        selectedBayId: bayId,
        selectedModuleId: id,
      });
      return;
    }

    const y = findHangingRailPlacementY(bayModules, wardrobe.height);
    if (y === null) return;

    const id = createId();
    set({
      modules: [
        ...modules,
        {
          id,
          type,
          bayId,
          y,
          height: MODULE_HEIGHTS["hanging-rail"],
        },
      ],
      selectedBayId: bayId,
      selectedModuleId: id,
    });
  },

  updateModuleY: (moduleId, y) => {
    const { wardrobe, modules } = get();
    const target = modules.find((item) => item.id === moduleId);
    if (!target) return;

    const bayModules = modules.filter((mod) => mod.bayId === target.bayId);
    const finalY = resolveModuleY(
      target,
      y,
      bayModules,
      wardrobe.height,
      modules,
      wardrobe.carcassHeight,
    );

    let nextModules = modules.map((item) =>
      item.id === moduleId ? { ...item, y: finalY } : item,
    );

    // Rail move: re-space shelves for hang / above-rail rules.
    // Shelf / drawer drags stay where the user put them (use Even below).
    if (target.type === "hanging-rail") {
      nextModules = redistributeShelvesEvenly(
        nextModules,
        target.bayId,
        wardrobe.height,
        { forceEven: true, carcassHeight: wardrobe.carcassHeight },
      );
    }

    set({
      modules: nextModules,
      selectedModuleId: moduleId,
      selectedBayId: target.bayId,
    });
  },

  sendModuleToFloor: (moduleId) => {
    const { wardrobe, modules } = get();
    const target = modules.find((item) => item.id === moduleId);
    if (!target) return;

    const bayModules = modules.filter((mod) => mod.bayId === target.bayId);
    const y = resolveFloorY(target, bayModules, wardrobe.height);

    set({
      modules: modules.map((item) =>
        item.id === moduleId ? { ...item, y } : item,
      ),
      selectedModuleId: moduleId,
      selectedBayId: target.bayId,
    });
  },

  setDrawerCount: (moduleId, count) => {
    const { wardrobe, modules } = get();
    const target = modules.find((item) => item.id === moduleId);
    if (!target || target.type !== "drawer-pack") return;

    const drawerCount = clampDrawerCount(count);
    const height = drawerPackHeight(drawerCount);
    const resized: Module = { ...target, drawerCount, height };
    const bayModules = modules.map((item) =>
      item.id === moduleId ? resized : item,
    );
    const peers = bayModules.filter((mod) => mod.bayId === target.bayId);
    // Keep drawers on the floor when resizing if they were near it
    const preferFloor =
      target.y >= wardrobe.height - target.height - SNAP_INCREMENT_MM * 2;
    const y = preferFloor
      ? resolveFloorY(resized, peers, wardrobe.height)
      : resolveModuleY(
          resized,
          target.y,
          peers,
          wardrobe.height,
          bayModules,
          wardrobe.carcassHeight,
        );

    set({
      modules: modules.map((item) =>
        item.id === moduleId ? { ...resized, y } : item,
      ),
      selectedModuleId: moduleId,
    });
  },

  removeModule: (moduleId) => {
    set((state) => {
      const target = state.modules.find((mod) => mod.id === moduleId);
      const remaining = state.modules.filter((mod) => mod.id !== moduleId);

      let nextBays = state.bays;
      if (target?.type === "drawer-pack") {
        const stillHasDrawers = remaining.some(
          (mod) => mod.bayId === target.bayId && mod.type === "drawer-pack",
        );
        if (!stillHasDrawers) {
          // Unlock width when the last drawer unit leaves this bay
          const unlocked = state.bays.map((bay) =>
            bay.id === target.bayId
              ? { ...bay, lockedWidth: undefined }
              : bay,
          );
          nextBays = resizeBaysPreservingLocks(unlocked, state.wardrobe.width);
        }
      }

      return {
        bays: nextBays,
        modules:
          target?.type === "shelf"
            ? redistributeShelvesEvenly(
                remaining,
                target.bayId,
                state.wardrobe.height,
                {
                  forceEven: true,
                  carcassHeight: state.wardrobe.carcassHeight,
                },
              )
            : remaining,
        selectedModuleId:
          state.selectedModuleId === moduleId ? null : state.selectedModuleId,
      };
    });
  },

  clearBay: (bayId) => {
    const { selectedBayId, modules, bays, wardrobe } = get();
    const id = bayId ?? selectedBayId;
    if (!id) return;

    const hadDrawers = modules.some(
      (mod) => mod.bayId === id && mod.type === "drawer-pack",
    );
    const remaining = modules.filter((mod) => mod.bayId !== id);

    let nextBays = bays;
    if (hadDrawers) {
      const unlocked = bays.map((bay) =>
        bay.id === id ? { ...bay, lockedWidth: undefined } : bay,
      );
      nextBays = resizeBaysPreservingLocks(unlocked, wardrobe.width);
    }

    set({
      bays: nextBays,
      modules: remaining,
      selectedBayId: id,
      selectedModuleId: null,
    });
  },

  setBoardMaterial: (material) => {
    set((state) => ({
      materials: { ...state.materials, boardMaterial: material },
    }));
  },

  setHardwareTier: (tier) => {
    set((state) => ({
      materials: { ...state.materials, hardwareTier: tier },
    }));
  },

  setSlidingDoors: (enabled) => {
    set((state) => ({
      materials: {
        ...state.materials,
        slidingDoors: enabled,
        mirrorSide: enabled ? state.materials.mirrorSide : "none",
      },
    }));
  },

  setMirrorSide: (side) => {
    set((state) => ({
      materials: {
        ...state.materials,
        slidingDoors: side === "none" ? state.materials.slidingDoors : true,
        mirrorSide: side,
      },
    }));
  },
}));
