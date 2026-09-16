import { create } from "zustand";
import {
  DEFAULT_CARCASS_HEIGHT_MM,
  DEFAULT_DRAWER_COUNT,
  MIN_WARDROBE_WIDTH_MM,
  DRAWER_UNIT_HEIGHT_MM,
  JACKET_CLEARANCE_MM,
  MAX_DRAWER_COUNT,
  MAX_RAILS_PER_BAY,
  MIN_DRAWER_COUNT,
  MODULE_CLEARANCE_MM,
  MODULE_HEIGHTS,
  SNAP_INCREMENT_MM,
  clampCarcassHeight,
  drawerPackHeight,
  mainZoneTop,
} from "@/lib/constants";
import {
  clampSlidingDoorHeightMm,
  normalizeSlidingDoorFaces,
  normalizePolyShakerRebate,
  slidingDoorCount,
} from "@/lib/wardrobeDoors";
import {
  isGlassSlidingFace,
  SLIDING_NARROW_LEAF_MAX_HEIGHT_MM,
  SLIDING_NARROW_LEAF_MM,
  slidingProductById,
  type SlidingDoorFace as TmFace,
  type SlidingDoorProductId as TmProduct,
  type SlidingFrameColour as TmFrame,
} from "@/lib/trademasterDoors";
import {
  BOARD_THICKNESS_MM,
  DEFAULT_KICKER_HEIGHT_MM,
  DEFAULT_MEDIA_DEPTH_INSIDE_MM,
  DEFAULT_MEDIA_DEPTH_TOTAL_MM,
  DEFAULT_TV_BOTTOM_FROM_FLOOR_MM,
  DEFAULT_TV_NICHE,
  DEFAULT_WARDROBE_DEPTH_INSIDE_MM,
  DEFAULT_WARDROBE_DEPTH_TOTAL_MM,
  MIN_OUTER_BAY_WIDTH_MM,
  bayInTvNiche,
  centeredTvStartBayIndex,
  clampTvNiche,
  createMediaBays,
  createMediaModules,
  evenTvFirstCompartmentBottomFromKicker,
  resizeBaysToTvWidth,
  resizeTvColumnsPreservingOuters,
  tvNicheAssembly,
  tvNicheMergesColumns,
  tvNichePrimaryBayId,
  tvNicheWidthMm,
  type TvBayZone,
  type TvNiche,
} from "@/lib/mediaLayout";
import {
  tvOpeningFromSelection,
  clampTvBezelMm,
  type TvMountType,
} from "@/lib/tvSizes";
import { WARDROBE_SIZE_PRESETS } from "@/lib/wardrobeSizes";
import {
  type CarcassColour,
} from "@/lib/carcassColours";

export type { TvNiche, TvBayZone };
import {
  canAddDrawer,
  findDrawerTargetBayId,
  canAddRail,
  canAddShelf,
  evenShelfYsInSpan,
  evenSpaceShelvesInBay,
  findHangingRailPlacementY,
  pickEvenShelfLines,
  collapseCloseShelfLines,
  alignAndCenterShelfYs,
  snapShelvesToAlignLines,
  reconcileModulesForCarcassHeight,
  redistributeShelvesEvenly,
  resolveFloorY,
  resolveModuleY,
  syncBayRailPositions,
  type EvenRemainderMode,
} from "@/lib/placement";
import {
  adjustBayCountKeepingDrawerEnds,
  createBaysWithCount,
  createStandardBays,
  createStandardModules,
  MAX_WARDROBE_BAY_COUNT,
  minBayCountForWidth,
  resizeBaysPreservingLocks,
  resizeWardrobeBaysForWidth,
  setFlexibleBayWidth,
} from "@/lib/standardLayout";

export type ModuleType = "shelf" | "drawer-pack" | "hanging-rail" | "divider";
export type BoardMaterial = "white-melamine" | "woodgrain";
export type HardwareTier = "standard" | "soft-close";
export type MirrorSide = "none" | "left" | "right" | "both";
export type DoorSystem = "none" | "sliding" | "hinged";
export type UnitMode = "wardrobe" | "media";
export type SlidingWidthMode = "trademaster" | "500mm";
export type SlidingDoorProductId =
  | "white-panel"
  | "mirror-glass"
  | "frameless-mirror"
  | "tradecor";
export type SlidingDoorFace =
  | "white"
  | "poly"
  | "mirror"
  | "frosted"
  | "super-white"
  | "tradecor";
export type SlidingFrameColour =
  | "white"
  | "black"
  | "matt-silver"
  | "bright-silver"
  | "off-white";
export type { CarcassColour };

export interface Wardrobe {
  width: number;
  height: number;
  /** Main carcass height from floor up to the thick construction line */
  carcassHeight: number;
  /** Inside / carcass depth, mm */
  depth: number;
  /** Overall depth including doors / returns, mm */
  depthTotal: number;
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
  carcassColour: CarcassColour;
  hardwareTier: HardwareTier;
  /** none | sliding (Trademaster bands) | hinged (~550 mm leaves) */
  doorSystem: DoorSystem;
  /**
   * When false, door config is kept but doors are not drawn —
   * so interior layout work can continue.
   */
  doorsVisible: boolean;
  /** @deprecated prefer doorSystem === "sliding"; kept in sync for older UI */
  slidingDoors: boolean;
  /** Which door panel(s) have a mirror insert */
  mirrorSide: MirrorSide;
  /**
   * Sliding door leaf height (mm). Null = run up to the top fascia
   * (not tied to interior carcass height).
   */
  slidingDoorHeightMm: number | null;
  /** Trademaster min count vs ~500 mm leaves */
  slidingWidthMode: SlidingWidthMode;
  slidingProduct: SlidingDoorProductId;
  slidingFace: SlidingDoorFace;
  slidingFrameColour: SlidingFrameColour;
  /** Sliding leaf count — kept in sync with wardrobe width (2 or 3). */
  slidingLeafCount: number;
  /** Face / material for Door 1 … Door N (includes Poly finish) */
  slidingDoorFaces: SlidingDoorFace[];
  /** Shaker rebate on matching poly doors only */
  polyShakerRebate: boolean[];
}

/** One saved wardrobe / media unit in the job (tab dropdown). */
export interface DesignUnit {
  id: string;
  label: string;
  caption: string;
  unitMode: UnitMode;
  wardrobe: Wardrobe;
  bays: Bay[];
  modules: Module[];
  materials: Materials;
  bayCountInput: number;
  defaultDrawerCount: number;
  kickerEnabled: boolean;
  kickerHeight: number;
  lineShelves: boolean;
  tvNiche: TvNiche | null;
  tvActiveZone: TvBayZone;
  selectedBayId: string | null;
  selectedModuleId: string | null;
}

export interface WardrobeState {
  wardrobe: Wardrobe;
  bays: Bay[];
  modules: Module[];
  selectedBayId: string | null;
  selectedModuleId: string | null;
  /** When false, canvas shows no bay/module highlight (for clean screenshots). */
  canvasHighlight: boolean;
  /** Larger dimension labels + no chrome while capturing PDF */
  pdfExporting: boolean;
  /** PDF heading — always Fenix Wardrobes & Joinery */
  quoteTitle: string;
  /** Tab name, e.g. Wardrobe 1 */
  unitTabLabel: string;
  /** Room name on the PDF, e.g. Master bedroom */
  unitCaption: string;
  /** Client name printed under Fenix Wardrobes & Joinery */
  clientName: string;
  /** Highlight the client field after a blocked PDF export */
  clientNameRequired: boolean;
  /** Highlight doors after a blocked PDF export */
  doorSystemRequired: boolean;
  /** Bumps so the doors tab pulse replays on each PDF click */
  doorSystemPromptKey: number;
  /** Extra quote notes (handles, install, colour extras) */
  extraNotes: string;
  /** When true, extra notes print on the PDF */
  extraNotesOnPdf: boolean;
  /** All units in this job */
  designs: DesignUnit[];
  activeDesignId: string;
  materials: Materials;
  bayCountInput: number;
  defaultDrawerCount: number;
  /** Wardrobe fittings vs open shelf / TV media unit */
  unitMode: UnitMode;
  /** Optional 100 mm plinth under the carcass (media units) */
  kickerEnabled: boolean;
  kickerHeight: number;
  /** Draw shelves as double black lines (like uprights) instead of green bars */
  lineShelves: boolean;
  tvNiche: TvNiche | null;
  /** Which TV pocket is being edited: above or below */
  tvActiveZone: TvBayZone;

  setWardrobeWidth: (width: number) => void;
  setWardrobeHeight: (height: number) => void;
  setWardrobeDepth: (depth: number) => void;
  setWardrobeDepthTotal: (depth: number) => void;
  setCarcassHeight: (height: number) => void;
  /** Set sliding door leaf height (mm); keeps unit size, adds top fascia if taller. */
  setSlidingDoorHeight: (heightMm: number) => void;
  setBayCountInput: (count: number) => void;
  setDefaultDrawerCount: (count: number) => void;
  divideIntoBays: (count: number) => void;
  applyStandardLayout: () => void;
  setUnitMode: (mode: UnitMode) => void;
  setKickerEnabled: (enabled: boolean) => void;
  setLineShelves: (enabled: boolean) => void;
  applyMediaLayout: () => void;
  setTvNiche: (niche: TvNiche | null) => void;
  placeTvNicheOnSelection: () => void;
  centerTvNiche: () => void;
  clearTvNiche: () => void;
  setTvOpeningHeight: (height: number) => void;
  setTvBottomFromKicker: (mm: number) => void;
  setTvBaySpan: (bayCount: number) => void;
  setTvWidth: (widthMm: number) => void;
  /** Toggle uprights for the active above/below zone only */
  setTvDivideAboveBelow: (enabled: boolean) => void;
  /** Set column count for the active above/below zone only */
  setTvZoneColumns: (count: number) => void;
  setTvDoubleWallUprights: (enabled: boolean) => void;
  /** Wall mount vs with stand — resizes niche from current size/model */
  setTvMountType: (mount: TvMountType) => void;
  /** Apply screen size (+ optional brand model) with current mount type */
  applyTvSelection: (inches: number, modelId?: string | null) => void;
  setTvBezelMm: (mm: number) => void;
  setTvActiveZone: (zone: TvBayZone) => void;
  setTvAboveShelfCount: (count: number) => void;
  setTvBelowShelfCount: (count: number) => void;
  adaptTvColumnShelves: () => void;
  setBayWidth: (bayId: string, width: number) => void;
  evenSpaceShelves: (
    bayId?: string,
    options?: {
      /** Even only this bay, or snap to closest side-bay shelf lines */
      target?: "bay" | "sides";
      /** Leftover mm when evening this bay: bottom gap or middle */
      remainder?: EvenRemainderMode;
    },
  ) => void;
  /** Snap TV-column shelves onto the same Y lines as outer left/right bays */
  alignTvShelvesWithOuterBays: () => void;
  /** Move TV so the first compartment above and below are equal height */
  evenTvFirstCompartments: () => void;
  /** Split selected bay into two columns with a vertical upright */
  splitBayVertical: (bayId?: string) => void;
  /** Add a fixed horizontal upright (cross board) in the bay / TV pocket */
  addHorizontalUpright: (bayId?: string) => void;
  swapBayWithNeighbor: (bayId: string, direction: "left" | "right") => void;
  selectBay: (bayId: string | null, zone?: TvBayZone) => void;
  selectModule: (moduleId: string | null) => void;
  clearCanvasHighlight: () => void;
  addModule: (type: ModuleType) => void;
  updateModuleY: (moduleId: string, y: number) => void;
  sendModuleToFloor: (moduleId: string) => void;
  setDrawerCount: (moduleId: string, count: number) => void;
  removeModule: (moduleId: string) => void;
  clearBay: (bayId?: string) => void;
  setBoardMaterial: (material: BoardMaterial) => void;
  setCarcassColour: (colour: CarcassColour) => void;
  setHardwareTier: (tier: HardwareTier) => void;
  setDoorSystem: (system: DoorSystem) => void;
  setDoorsVisible: (visible: boolean) => void;
  setSlidingDoors: (enabled: boolean) => void;
  setMirrorSide: (side: MirrorSide) => void;
  setSlidingWidthMode: (mode: SlidingWidthMode) => void;
  /** 500 mm sliding leaves × count, height up to 2400 — sets wardrobe W×H. */
  applySliding500Kit: (doorCount: number, heightMm?: number) => void;
  setSlidingDoorProduct: (product: SlidingDoorProductId) => void;
  setSlidingDoorFace: (face: SlidingDoorFace) => void;
  setSlidingLeafCount: (count: number) => void;
  setSlidingDoorFaceAt: (index: number, face: SlidingDoorFace) => void;
  setPolyShakerRebateAt: (index: number, enabled: boolean) => void;
  setSlidingFrameColour: (colour: SlidingFrameColour) => void;
  /** Apply a standard wardrobe size preset. Does not change doors. */
  applyWardrobeSizePreset: (presetId: string) => void;
  setPdfExporting: (enabled: boolean) => void;
  setQuoteTitle: (title: string) => void;
  setUnitTabLabel: (label: string) => void;
  setUnitCaption: (caption: string) => void;
  setClientName: (name: string) => void;
  setClientNameRequired: (required: boolean) => void;
  setDoorSystemRequired: (required: boolean) => void;
  setExtraNotes: (notes: string) => void;
  setExtraNotesOnPdf: (enabled: boolean) => void;
  commitAndGetDesigns: () => DesignUnit[];
  addDesign: (mode?: UnitMode) => void;
  switchDesign: (id: string) => void;
  renameDesign: (id: string, label: string) => void;
  removeDesign: (id: string) => void;
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
const DEFAULT_QUOTE_TITLE = "Fenix Wardrobes & Joinery";
const DEFAULT_WARDROBE_TAB = "Wardrobe 1";
const DEFAULT_WARDROBE_CAPTION = "Master bedroom";
const DEFAULT_MEDIA_CAPTION = "Living room";
const FIRST_DESIGN_ID = "unit-1";
const MEDIA_DEFAULT_WIDTH = 3200;
/** Overall media unit height including kicker (carcass = this − kicker). */
const MEDIA_DEFAULT_HEIGHT = 2284;
const MEDIA_DEFAULT_BAYS = 6;
const DEFAULT_MATERIALS: Materials = {
  boardMaterial: "white-melamine",
  carcassColour: "white",
  hardwareTier: "standard",
  doorSystem: "none",
  doorsVisible: true,
  slidingDoors: false,
  mirrorSide: "none",
  slidingDoorHeightMm: null,
  slidingWidthMode: "trademaster",
  slidingProduct: "white-panel",
  slidingFace: "white",
  slidingFrameColour: "white",
  slidingLeafCount: 2,
  slidingDoorFaces: ["white", "white"],
  polyShakerRebate: [false, false],
};

function materialsWithDoorCount(
  materials: Materials,
  widthMm: number,
): Materials {
  const count = slidingDoorCount(widthMm);
  const slidingDoorFaces = normalizeSlidingDoorFaces(
    materials.slidingDoorFaces,
    count,
    materials.slidingFace,
  );
  return {
    ...materials,
    slidingLeafCount: count,
    slidingDoorFaces,
    polyShakerRebate: normalizePolyShakerRebate(
      materials.polyShakerRebate,
      slidingDoorFaces,
      count,
    ),
  };
}

function depthsForMode(mode: UnitMode): {
  depth: number;
  depthTotal: number;
} {
  return mode === "media"
    ? {
        depth: DEFAULT_MEDIA_DEPTH_INSIDE_MM,
        depthTotal: DEFAULT_MEDIA_DEPTH_TOTAL_MM,
      }
    : {
        depth: DEFAULT_WARDROBE_DEPTH_INSIDE_MM,
        depthTotal: DEFAULT_WARDROBE_DEPTH_TOTAL_MM,
      };
}

function clampDepthInside(depth: number): number {
  return Math.max(200, Math.min(800, Math.round(depth)));
}

function clampDepthTotal(depth: number, inside: number): number {
  return Math.max(inside, Math.min(900, Math.round(depth)));
}

function nextWardrobeLabel(designs: DesignUnit[]): string {
  const n = designs.filter((item) => item.unitMode === "wardrobe").length + 1;
  return `Wardrobe ${n}`;
}

function nextMediaLabel(designs: DesignUnit[]): string {
  const n = designs.filter((item) => item.unitMode === "media").length + 1;
  return `Media ${n}`;
}

function liveToSnapshot(state: {
  activeDesignId: string;
  unitTabLabel: string;
  unitCaption: string;
  unitMode: UnitMode;
  wardrobe: Wardrobe;
  bays: Bay[];
  modules: Module[];
  materials: Materials;
  bayCountInput: number;
  defaultDrawerCount: number;
  kickerEnabled: boolean;
  kickerHeight: number;
  lineShelves: boolean;
  tvNiche: TvNiche | null;
  tvActiveZone: TvBayZone;
  selectedBayId: string | null;
  selectedModuleId: string | null;
}): DesignUnit {
  return {
    id: state.activeDesignId,
    label: state.unitTabLabel,
    caption: state.unitCaption,
    unitMode: state.unitMode,
    wardrobe: state.wardrobe,
    bays: state.bays,
    modules: state.modules,
    materials: state.materials,
    bayCountInput: state.bayCountInput,
    defaultDrawerCount: state.defaultDrawerCount,
    kickerEnabled: state.kickerEnabled,
    kickerHeight: state.kickerHeight,
    lineShelves: state.lineShelves,
    tvNiche: state.tvNiche,
    tvActiveZone: state.tvActiveZone,
    selectedBayId: state.selectedBayId,
    selectedModuleId: state.selectedModuleId,
  };
}

function commitActiveDesign(state: {
  designs: DesignUnit[];
  activeDesignId: string;
  unitTabLabel: string;
  unitCaption: string;
  unitMode: UnitMode;
  wardrobe: Wardrobe;
  bays: Bay[];
  modules: Module[];
  materials: Materials;
  bayCountInput: number;
  defaultDrawerCount: number;
  kickerEnabled: boolean;
  kickerHeight: number;
  lineShelves: boolean;
  tvNiche: TvNiche | null;
  tvActiveZone: TvBayZone;
  selectedBayId: string | null;
  selectedModuleId: string | null;
}): DesignUnit[] {
  const snap = liveToSnapshot(state);
  const exists = state.designs.some((item) => item.id === state.activeDesignId);
  if (!exists) return [...state.designs, snap];
  return state.designs.map((item) =>
    item.id === state.activeDesignId ? snap : item,
  );
}

function snapshotToLive(snap: DesignUnit) {
  return {
    activeDesignId: snap.id,
    unitTabLabel: snap.label,
    unitCaption: snap.caption,
    unitMode: snap.unitMode,
    wardrobe: snap.wardrobe,
    bays: snap.bays,
    modules: snap.modules,
    materials: snap.materials,
    bayCountInput: snap.bayCountInput,
    defaultDrawerCount: snap.defaultDrawerCount,
    kickerEnabled: snap.kickerEnabled,
    kickerHeight: snap.kickerHeight,
    lineShelves: snap.lineShelves,
    tvNiche: snap.tvNiche,
    tvActiveZone: snap.tvActiveZone,
    selectedBayId: snap.selectedBayId,
    selectedModuleId: snap.selectedModuleId,
    canvasHighlight: true,
  };
}

function createWardrobeSnapshot(id: string, label: string): DesignUnit {
  const bays = createStandardBays(DEFAULT_WIDTH);
  return {
    id,
    label,
    caption: "Master bedroom",
    unitMode: "wardrobe",
    wardrobe: {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      carcassHeight: DEFAULT_CARCASS_HEIGHT_MM,
      ...depthsForMode("wardrobe"),
    },
    bays,
    modules: createStandardModules(bays, DEFAULT_HEIGHT),
    materials: { ...DEFAULT_MATERIALS },
    bayCountInput: bays.length,
    defaultDrawerCount: DEFAULT_DRAWER_COUNT,
    kickerEnabled: false,
    kickerHeight: DEFAULT_KICKER_HEIGHT_MM,
    lineShelves: true,
    tvNiche: null,
    tvActiveZone: "below",
    selectedBayId: bays[0]?.id ?? null,
    selectedModuleId: null,
  };
}

function createMediaSnapshot(id: string, label: string): DesignUnit {
  const kickerMm = DEFAULT_KICKER_HEIGHT_MM;
  const height = Math.max(600, MEDIA_DEFAULT_HEIGHT - kickerMm);
  const bays = createMediaBays(MEDIA_DEFAULT_WIDTH, MEDIA_DEFAULT_BAYS);
  return {
    id,
    label,
    caption: "Living room",
    unitMode: "media",
    wardrobe: {
      width: MEDIA_DEFAULT_WIDTH,
      height,
      carcassHeight: clampCarcassHeight(height, height),
      ...depthsForMode("media"),
    },
    bays,
    modules: createMediaModules(bays, height, null, kickerMm),
    materials: { ...DEFAULT_MATERIALS },
    bayCountInput: MEDIA_DEFAULT_BAYS,
    defaultDrawerCount: DEFAULT_DRAWER_COUNT,
    kickerEnabled: true,
    kickerHeight: DEFAULT_KICKER_HEIGHT_MM,
    lineShelves: true,
    tvNiche: null,
    tvActiveZone: "below",
    selectedBayId: bays[0]?.id ?? null,
    selectedModuleId: null,
  };
}

const FIRST_DESIGN: DesignUnit = {
  ...createWardrobeSnapshot(FIRST_DESIGN_ID, DEFAULT_WARDROBE_TAB),
  caption: DEFAULT_WARDROBE_CAPTION,
};

function activeKickerMm(state: {
  unitMode: UnitMode;
  kickerEnabled: boolean;
  kickerHeight: number;
}): number {
  return state.unitMode === "media" && state.kickerEnabled
    ? state.kickerHeight
    : 0;
}

function nicheBlockedSpans(
  tvNiche: TvNiche | null,
  bayIndex: number,
  unitHeight: number,
  kickerMm: number,
): { start: number; end: number }[] {
  if (!tvNiche || !bayInTvNiche(bayIndex, tvNiche)) return [];
  const assembly = tvNicheAssembly(tvNiche, unitHeight, kickerMm);
  return [{ start: assembly.blocked.start, end: assembly.blocked.end }];
}

function shelfOptionsForBay(
  state: Pick<
    WardrobeState,
    | "unitMode"
    | "tvNiche"
    | "wardrobe"
    | "bays"
    | "kickerEnabled"
    | "kickerHeight"
  >,
  bayId: string,
) {
  if (state.unitMode !== "media") {
    return {
      carcassHeight: state.wardrobe.carcassHeight,
    };
  }
  const bay = state.bays.find((item) => item.id === bayId);
  const kickerMm = activeKickerMm(state);
  return {
    carcassHeight: state.wardrobe.height,
    zoneTop: 0 as number | undefined,
    blockedSpans: nicheBlockedSpans(
      state.tvNiche,
      bay?.index ?? -1,
      state.wardrobe.height,
      kickerMm,
    ),
  };
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  wardrobe: FIRST_DESIGN.wardrobe,
  bays: FIRST_DESIGN.bays,
  modules: FIRST_DESIGN.modules,
  selectedBayId: FIRST_DESIGN.selectedBayId,
  selectedModuleId: null,
  canvasHighlight: true,
  pdfExporting: false,
  quoteTitle: DEFAULT_QUOTE_TITLE,
  unitTabLabel: FIRST_DESIGN.label,
  unitCaption: FIRST_DESIGN.caption,
  clientName: "",
  clientNameRequired: false,
  doorSystemRequired: false,
  doorSystemPromptKey: 0,
  extraNotes: "",
  extraNotesOnPdf: true,
  designs: [FIRST_DESIGN],
  activeDesignId: FIRST_DESIGN.id,
  materials: { ...FIRST_DESIGN.materials },
  bayCountInput: FIRST_DESIGN.bays.length,
  defaultDrawerCount: DEFAULT_DRAWER_COUNT,
  unitMode: "wardrobe",
  kickerEnabled: false,
  kickerHeight: DEFAULT_KICKER_HEIGHT_MM,
  lineShelves: true,
  tvNiche: null,
  tvActiveZone: "below",

  setWardrobeWidth: (width) => {
    const state = get();
    const nextWidth = Math.max(
      state.unitMode === "media" ? 1200 : MIN_WARDROBE_WIDTH_MM,
      Math.round(width),
    );

    // Media: keep the TV opening width; only outer bays absorb the change
    if (state.unitMode === "media" && state.tvNiche) {
      const kickerMm = activeKickerMm(state);
      const niche = clampTvNiche(
        state.tvNiche,
        state.bays.length,
        state.wardrobe.height,
        kickerMm,
      );
      const nextBays = resizeBaysToTvWidth(
        state.bays,
        niche,
        niche.width,
        nextWidth,
      );
      const synced: TvNiche = {
        ...niche,
        width: tvNicheWidthMm(nextBays, niche),
      };
      set({
        wardrobe: { ...state.wardrobe, width: nextWidth },
        bays: nextBays,
        tvNiche: synced,
      });
      get().adaptTvColumnShelves();
      return;
    }

    const { bays: nextBays, modules: nextModules } = resizeWardrobeBaysForWidth(
      state.bays,
      state.modules,
      nextWidth,
    );
    const prevIndex =
      state.bays.find((bay) => bay.id === state.selectedBayId)?.index ?? 0;
    set({
      wardrobe: { ...state.wardrobe, width: nextWidth },
      bays: nextBays,
      modules: nextModules,
      selectedBayId:
        nextBays.find((bay) => bay.index === prevIndex)?.id ??
        nextBays[0]?.id ??
        null,
      bayCountInput: nextBays.length,
      materials: materialsWithDoorCount(state.materials, nextWidth),
    });
  },

  setWardrobeHeight: (height) => {
    const nextHeight = Math.max(600, Math.round(height));
    set((state) => {
      const kickerMm = activeKickerMm(state);
      return {
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
        tvNiche: state.tvNiche
          ? clampTvNiche(
              state.tvNiche,
              state.bays.length,
              nextHeight,
              kickerMm,
            )
          : null,
      };
    });
    if (get().unitMode === "media" && get().tvNiche) {
      get().adaptTvColumnShelves();
    }
  },

  setWardrobeDepth: (depth) => {
    const next = clampDepthInside(depth);
    set((state) => ({
      wardrobe: {
        ...state.wardrobe,
        depth: next,
        depthTotal: clampDepthTotal(
          state.wardrobe.depthTotal ?? next,
          next,
        ),
      },
    }));
  },

  setWardrobeDepthTotal: (depth) => {
    set((state) => {
      const inside = clampDepthInside(
        state.wardrobe.depth ?? DEFAULT_WARDROBE_DEPTH_INSIDE_MM,
      );
      return {
        wardrobe: {
          ...state.wardrobe,
          depth: inside,
          depthTotal: clampDepthTotal(depth, inside),
        },
      };
    });
  },

  setCarcassHeight: (height) => {
    const { wardrobe, modules, bays, selectedModuleId, unitMode } = get();
    if (unitMode === "media") return;
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

  setSlidingDoorHeight: (heightMm) => {
    const state = get();
    if (state.unitMode === "media") return;
    const leaf = clampSlidingDoorHeightMm(heightMm, state.wardrobe.height);
    set({
      materials: {
        ...state.materials,
        doorSystem: "sliding",
        slidingDoors: true,
        doorsVisible: true,
        slidingDoorHeightMm: leaf,
      },
    });
  },

  setBayCountInput: (count) => {
    set({ bayCountInput: Math.max(1, Math.min(12, Math.round(count))) });
  },

  setDefaultDrawerCount: (count) => {
    set({ defaultDrawerCount: clampDrawerCount(count) });
  },

  divideIntoBays: (count) => {
    const { wardrobe, bays, modules, unitMode, tvNiche } = get();
    const safeCount =
      unitMode === "media"
        ? Math.max(1, Math.floor(count))
        : Math.max(
            minBayCountForWidth(wardrobe.width),
            Math.min(MAX_WARDROBE_BAY_COUNT, Math.floor(count)),
          );

    if (unitMode === "media") {
      const kickerMm = activeKickerMm(get());
      let nextBays = createMediaBays(wardrobe.width, safeCount);
      const niche = tvNiche
        ? clampTvNiche(tvNiche, nextBays.length, wardrobe.height, kickerMm)
        : null;
      if (niche) {
        nextBays = resizeBaysToTvWidth(
          nextBays,
          niche,
          niche.width,
          wardrobe.width,
        );
      }
      const synced = niche
        ? { ...niche, width: tvNicheWidthMm(nextBays, niche) }
        : null;
      set({
        bays: nextBays,
        modules: synced
          ? createMediaModules(
              nextBays,
              wardrobe.height,
              synced,
              kickerMm,
            )
          : [],
        selectedBayId: nextBays[0]?.id ?? null,
        selectedModuleId: null,
        bayCountInput: safeCount,
        tvNiche: synced,
      });
      return;
    }

    const { bays: nextBays, modules: nextModules } =
      adjustBayCountKeepingDrawerEnds(
        bays,
        modules,
        wardrobe.width,
        safeCount,
      );
    const prevIndex =
      bays.find((bay) => bay.id === get().selectedBayId)?.index ?? 0;
    const addedBay = safeCount > bays.length;
    const existingIds = new Set(bays.map((bay) => bay.id));
    const selectedBayId = addedBay
      ? ([...nextBays].find(
          (bay) => !bay.lockedWidth && !existingIds.has(bay.id),
        ) ?? nextBays.find((bay) => !bay.lockedWidth))?.id ??
        nextBays[Math.floor(nextBays.length / 2)]?.id ??
        null
      : (nextBays.find((bay) => bay.index === prevIndex)?.id ??
        nextBays[0]?.id ??
        null);

    set({
      bays: nextBays,
      modules: nextModules,
      selectedBayId,
      selectedModuleId: null,
      bayCountInput: safeCount,
    });
  },

  applyStandardLayout: () => {
    const state = get();
    const { wardrobe } = state;
    const nextWidth = Math.max(MIN_WARDROBE_WIDTH_MM, wardrobe.width);
    const nextBays = createStandardBays(nextWidth);
    const nextModules = createStandardModules(
      nextBays,
      wardrobe.height,
      wardrobe.carcassHeight,
    );
    const keepLabel = state.unitTabLabel.trim() || nextWardrobeLabel(state.designs);
    const nextCaption =
      state.unitMode === "media"
        ? "Master bedroom"
        : state.unitCaption;
    const nextLive = {
      ...state,
      unitMode: "wardrobe" as const,
      kickerEnabled: false,
      tvNiche: null,
      wardrobe: {
        ...wardrobe,
        width: nextWidth,
        depth:
          state.unitMode === "media"
            ? DEFAULT_WARDROBE_DEPTH_INSIDE_MM
            : (wardrobe.depth ?? DEFAULT_WARDROBE_DEPTH_INSIDE_MM),
        depthTotal:
          state.unitMode === "media"
            ? DEFAULT_WARDROBE_DEPTH_TOTAL_MM
            : (wardrobe.depthTotal ?? DEFAULT_WARDROBE_DEPTH_TOTAL_MM),
      },
      bays: nextBays,
      modules: nextModules,
      selectedBayId: nextBays[0]?.id ?? null,
      selectedModuleId: null,
      bayCountInput: nextBays.length,
      unitTabLabel: keepLabel,
      unitCaption: nextCaption,
    };
    set({
      unitMode: "wardrobe",
      kickerEnabled: false,
      tvNiche: null,
      wardrobe: nextLive.wardrobe,
      bays: nextBays,
      modules: nextModules,
      selectedBayId: nextBays[0]?.id ?? null,
      selectedModuleId: null,
      bayCountInput: nextBays.length,
      unitTabLabel: keepLabel,
      unitCaption: nextCaption,
      designs: commitActiveDesign(nextLive),
    });
  },

  setUnitMode: (mode) => {
    if (mode === get().unitMode) return;
    if (mode === "media") {
      get().applyMediaLayout();
      return;
    }
    get().applyStandardLayout();
  },

  setKickerEnabled: (enabled) => {
    const state = get();
    const nextEnabled = Boolean(enabled);
    if (state.unitMode !== "media") {
      set({ kickerEnabled: nextEnabled });
      return;
    }

    const kick = state.kickerHeight;
    // Keep overall height (carcass + kicker) stable when toggling the plinth
    let nextCarcass = state.wardrobe.height;
    if (nextEnabled && !state.kickerEnabled) {
      nextCarcass = Math.max(600, state.wardrobe.height - kick);
    } else if (!nextEnabled && state.kickerEnabled) {
      nextCarcass = state.wardrobe.height + kick;
    }
    const kickerMm = nextEnabled ? kick : 0;
    const niche = state.tvNiche
      ? clampTvNiche(
          state.tvNiche,
          state.bays.length,
          nextCarcass,
          kickerMm,
        )
      : null;
    set({
      kickerEnabled: nextEnabled,
      wardrobe: {
        ...state.wardrobe,
        height: nextCarcass,
        carcassHeight: clampCarcassHeight(nextCarcass, nextCarcass),
      },
      tvNiche: niche,
    });
    if (niche) get().adaptTvColumnShelves();
  },

  applyMediaLayout: () => {
    const state = get();
    const width = MEDIA_DEFAULT_WIDTH;
    const kickerMm = DEFAULT_KICKER_HEIGHT_MM;
    // 2284 is the full unit (carcass + kicker)
    const height = Math.max(600, MEDIA_DEFAULT_HEIGHT - kickerMm);
    const nextBays = createMediaBays(width, MEDIA_DEFAULT_BAYS);
    const nextModules = createMediaModules(nextBays, height, null, kickerMm);
    const keepLabel = state.unitTabLabel.trim() || nextMediaLabel(state.designs);
    const nextCaption =
      state.unitMode === "wardrobe"
        ? "Living room"
        : state.unitCaption;
    const nextMaterials: Materials = {
      ...state.materials,
      doorSystem: "none",
      doorsVisible: true,
      slidingDoors: false,
      mirrorSide: "none",
      slidingDoorHeightMm: null,
      slidingWidthMode: "trademaster",
      slidingProduct: "white-panel",
      slidingFace: "white",
      slidingFrameColour: "white",
      slidingLeafCount: 2,
      slidingDoorFaces: ["white", "white"],
      polyShakerRebate: [false, false],
    };
    set({
      unitMode: "media",
      kickerEnabled: true,
      kickerHeight: DEFAULT_KICKER_HEIGHT_MM,
      tvNiche: null,
      wardrobe: {
        width,
        height,
        carcassHeight: clampCarcassHeight(height, height),
        ...depthsForMode("media"),
      },
      bays: nextBays,
      modules: nextModules,
      selectedBayId: nextBays[0]?.id ?? null,
      selectedModuleId: null,
      bayCountInput: MEDIA_DEFAULT_BAYS,
      unitTabLabel: keepLabel,
      unitCaption: nextCaption,
      materials: nextMaterials,
      designs: commitActiveDesign({
        ...state,
        unitMode: "media",
        kickerEnabled: true,
        kickerHeight: DEFAULT_KICKER_HEIGHT_MM,
        tvNiche: null,
        wardrobe: {
          width,
          height,
          carcassHeight: clampCarcassHeight(height, height),
          ...depthsForMode("media"),
        },
        bays: nextBays,
        modules: nextModules,
        selectedBayId: nextBays[0]?.id ?? null,
        selectedModuleId: null,
        bayCountInput: MEDIA_DEFAULT_BAYS,
        unitTabLabel: keepLabel,
        unitCaption: nextCaption,
        materials: nextMaterials,
      }),
    });
  },

  setTvNiche: (niche) => {
    const state = get();
    const kickerMm = activeKickerMm(state);
    let next = niche
      ? clampTvNiche(
          niche,
          state.bays.length,
          state.wardrobe.height,
          kickerMm,
        )
      : null;
    const primaryId = tvNichePrimaryBayId(state.bays, next);
    let nextBays = state.bays;
    if (next) {
      nextBays = resizeBaysToTvWidth(
        state.bays,
        next,
        next.width,
        state.wardrobe.width,
      );
      // Keep stored width in sync with what the bays actually became
      next = {
        ...next,
        width: tvNicheWidthMm(nextBays, next),
      };
    }
    const assembly = next
      ? tvNicheAssembly(next, state.wardrobe.height, kickerMm)
      : null;
    const cleaned =
      next && primaryId && assembly
        ? state.modules.filter((mod) => {
            const bay = nextBays.find((item) => item.id === mod.bayId);
            if (!bay) return true;
            if (!bayInTvNiche(bay.index, next)) return true;
            if (mod.bayId === primaryId) return true;
            // Drop secondary-bay fittings that belong to an undivided zone
            const mid = mod.y + mod.height / 2;
            if (mid <= assembly.aboveBay.end) {
              return next.divideAbove === true;
            }
            if (mid >= assembly.belowBay.start) {
              return next.divideBelow === true;
            }
            return false;
          })
        : state.modules;
    const mergesBoth = tvNicheMergesColumns(next);
    set({
      tvNiche: next,
      bays: nextBays,
      modules: cleaned,
      selectedBayId:
        mergesBoth && primaryId ? primaryId : state.selectedBayId,
    });
  },

  placeTvNicheOnSelection: () => {
    const state = get();
    const { bays, tvNiche, wardrobe } = state;
    const sorted = [...bays].sort((a, b) => a.index - b.index);
    if (sorted.length === 0) return;

    const tvW = tvNiche?.width ?? DEFAULT_TV_NICHE.width;
    const avg =
      sorted.reduce((sum, bay) => sum + bay.width, 0) / sorted.length ||
      wardrobe.width / sorted.length;
    // Span enough existing bays to cover the TV without stealing one whole side
    let span = Math.max(1, Math.round(tvW / Math.max(1, avg)));
    if (sorted.length >= 3) {
      span = Math.min(span, sorted.length - 2);
    }
    span = Math.max(1, Math.min(sorted.length, span));

    const start = centeredTvStartBayIndex(sorted.length, span);
    get().setTvNiche({
      startBayIndex: start,
      bayCount: span,
      height: tvNiche?.height ?? DEFAULT_TV_NICHE.height,
      bottomFromKicker: DEFAULT_TV_BOTTOM_FROM_FLOOR_MM,
      // Always start with uprights off — above/below stay independent
      aboveColumnCount: 1,
      belowColumnCount: 1,
      divideAbove: false,
      divideBelow: false,
      doubleWallUprights: tvNiche?.doubleWallUprights ?? true,
      mountType: tvNiche?.mountType ?? DEFAULT_TV_NICHE.mountType,
      selectedInches: tvNiche?.selectedInches ?? DEFAULT_TV_NICHE.selectedInches,
      tvModelId: tvNiche?.tvModelId ?? null,
      bezelMm: tvNiche?.bezelMm ?? 0,
      width: tvW,
      aboveShelfCount: tvNiche?.aboveShelfCount ?? 1,
      belowShelfCount: tvNiche?.belowShelfCount ?? 2,
    });
    get().adaptTvColumnShelves();
    set({ canvasHighlight: true });
  },

  centerTvNiche: () => {
    const state = get();
    if (!state.tvNiche) return;
    const sorted = [...state.bays].sort((a, b) => a.index - b.index);
    const start = centeredTvStartBayIndex(
      sorted.length,
      state.tvNiche.bayCount,
    );
    get().setTvNiche({
      ...state.tvNiche,
      startBayIndex: start,
      bottomFromKicker: DEFAULT_TV_BOTTOM_FROM_FLOOR_MM,
    });
    get().adaptTvColumnShelves();
    set({ canvasHighlight: true });
  },

  clearTvNiche: () => set({ tvNiche: null }),

  setTvOpeningHeight: (height) => {
    const state = get();
    if (!state.tvNiche) return;
    const kickerMm = activeKickerMm(state);
    const next = clampTvNiche(
      {
        ...state.tvNiche,
        height: Math.round(height),
        bottomFromKicker: state.tvNiche.bottomFromKicker,
      },
      state.bays.length,
      state.wardrobe.height,
      kickerMm,
    );
    set({ tvNiche: next });
    get().adaptTvColumnShelves();
  },

  setTvBottomFromKicker: (mm) => {
    const state = get();
    if (!state.tvNiche) return;
    const kickerMm = activeKickerMm(state);
    const next = clampTvNiche(
      {
        ...state.tvNiche,
        bottomFromKicker: Math.round(mm),
        height: state.tvNiche.height,
      },
      state.bays.length,
      state.wardrobe.height,
      kickerMm,
    );
    set({ tvNiche: next });
    get().adaptTvColumnShelves();
  },

  setTvBaySpan: (bayCount) => {
    get().setTvZoneColumns(bayCount);
  },

  setTvWidth: (widthMm) => {
    const state = get();
    if (!state.tvNiche) return;
    get().setTvNiche({
      ...state.tvNiche,
      width: Math.max(400, Math.round(widthMm)),
    });
    get().adaptTvColumnShelves();
  },

  setTvDivideAboveBelow: (enabled) => {
    const state = get();
    if (!state.tvNiche) return;
    const zone = state.tvActiveZone;
    const niche = state.tvNiche;
    const on = Boolean(enabled);
    const otherCount =
      zone === "above" ? niche.belowColumnCount : niche.aboveColumnCount;
    const nextCount = on
      ? Math.max(2, otherCount > 1 ? otherCount : niche.bayCount || 2)
      : 1;
    get().setTvZoneColumns(nextCount);
  },

  setTvZoneColumns: (count) => {
    const state = get();
    if (!state.tvNiche) return;
    const kickerMm = activeKickerMm(state);
    const niche = state.tvNiche;
    const zone = state.tvActiveZone;
    const safe = Math.max(1, Math.min(8, Math.round(count)));

    // Zones stay independent — changing above never writes below (and vice versa)
    let above =
      niche.aboveColumnCount ?? (niche.divideAbove ? niche.bayCount : 1);
    let below =
      niche.belowColumnCount ?? (niche.divideBelow ? niche.bayCount : 1);
    if (zone === "above") above = safe;
    else below = safe;

    // Carcass span grows/shrinks with the larger zone column count only
    const spanTarget = Math.max(above, below);

    let sorted = [...state.bays].sort((a, b) => a.index - b.index);
    let start = Math.max(0, niche.startBayIndex);
    let span = Math.max(1, niche.bayCount);
    start = Math.min(start, Math.max(0, sorted.length - span));

    if (spanTarget > span) {
      const toAdd = spanTarget - span;
      for (let n = 0; n < toAdd; n += 1) {
        if (sorted.length >= 12) break;
        const insertAt = start + Math.floor(span / 2);
        const newBay = {
          id: createId(),
          index: insertAt + 1,
          width: MIN_OUTER_BAY_WIDTH_MM,
        };
        sorted = [
          ...sorted.slice(0, insertAt + 1),
          newBay,
          ...sorted.slice(insertAt + 1),
        ].map((bay, index) => ({ ...bay, index }));
        span += 1;
      }
    } else if (spanTarget < span && spanTarget > 1) {
      // Shrink only while a zone still needs multiple carcass columns.
      // When both zones are undivided (1), keep the existing TV opening span.
      const toRemove = span - spanTarget;
      for (let n = 0; n < toRemove; n += 1) {
        if (span <= 1) break;
        const removeIndex = start + span - 1;
        if (!sorted[removeIndex]) break;
        sorted = sorted
          .filter((_, index) => index !== removeIndex)
          .map((bay, index) => ({ ...bay, index }));
        span -= 1;
      }
    }

    const nextNiche = clampTvNiche(
      {
        ...niche,
        startBayIndex: start,
        bayCount: span,
        aboveColumnCount: above,
        belowColumnCount: below,
        divideAbove: above > 1,
        divideBelow: below > 1,
      },
      sorted.length,
      state.wardrobe.height,
      kickerMm,
    );

    const nextBays = resizeTvColumnsPreservingOuters(
      sorted,
      nextNiche,
      niche.width,
      state.wardrobe.width,
    );
    const synced = {
      ...nextNiche,
      width: tvNicheWidthMm(nextBays, nextNiche),
    };

    const bayIds = new Set(nextBays.map((bay) => bay.id));
    const oldTvIds = new Set(
      state.bays
        .filter((bay) => bayInTvNiche(bay.index, niche))
        .map((bay) => bay.id),
    );
    const outside = state.modules.filter((mod) => {
      if (!bayIds.has(mod.bayId)) return false;
      const bay = nextBays.find((item) => item.id === mod.bayId);
      if (!bay) return false;
      return !bayInTvNiche(bay.index, synced);
    });
    const tvDividers = state.modules.filter((mod) => {
      if (mod.type !== "divider") return false;
      if (!bayIds.has(mod.bayId)) return false;
      const bay = nextBays.find((item) => item.id === mod.bayId);
      return bay && bayInTvNiche(bay.index, synced);
    });

    const rebuilt = createMediaModules(
      nextBays,
      state.wardrobe.height,
      synced,
      kickerMm,
    ).filter((mod) => {
      const bay = nextBays.find((item) => item.id === mod.bayId);
      return bay && bayInTvNiche(bay.index, synced);
    });

    let modules = [...outside, ...tvDividers, ...rebuilt];
    for (const bay of nextBays) {
      if (bayInTvNiche(bay.index, synced)) continue;
      if (!oldTvIds.has(bay.id)) continue;
      modules = modules.filter((mod) => mod.bayId !== bay.id);
      modules = [
        ...modules,
        ...Array.from({ length: 4 }, () => ({
          id: createId(),
          type: "shelf" as const,
          bayId: bay.id,
          y: 0,
          height: BOARD_THICKNESS_MM,
        })),
      ];
      modules = evenSpaceShelvesInBay(
        modules,
        bay.id,
        state.wardrobe.height,
        state.wardrobe.height,
        { zoneTop: 0 },
      );
    }

    modules = modules.filter((mod) => bayIds.has(mod.bayId));

    set({
      tvNiche: synced,
      bays: nextBays,
      modules,
      bayCountInput: nextBays.length,
      selectedBayId: bayIds.has(state.selectedBayId ?? "")
        ? state.selectedBayId
        : (nextBays[start]?.id ?? state.selectedBayId),
    });
  },

  setTvDoubleWallUprights: (enabled) => {
    const state = get();
    if (!state.tvNiche) return;
    set({
      tvNiche: {
        ...state.tvNiche,
        doubleWallUprights: Boolean(enabled),
      },
    });
  },

  applyTvSelection: (inches, modelId = null) => {
    const state = get();
    if (!state.tvNiche) {
      get().placeTvNicheOnSelection();
    }
    const niche = get().tvNiche;
    if (!niche) return;
    const mount = niche.mountType ?? "wall";
    const bezelMm = clampTvBezelMm(niche.bezelMm ?? 0);
    const opening = tvOpeningFromSelection({
      inches,
      mount,
      modelId,
      bezelMm,
    });
    get().setTvNiche({
      ...niche,
      selectedInches: inches,
      tvModelId: modelId ?? null,
      bezelMm,
      width: opening.widthMm,
      height: opening.heightMm,
    });
    get().adaptTvColumnShelves();
  },

  setTvBezelMm: (mm) => {
    const state = get();
    if (!state.tvNiche) return;
    const niche = state.tvNiche;
    const bezelMm = clampTvBezelMm(mm);
    const inches =
      niche.selectedInches ?? DEFAULT_TV_NICHE.selectedInches ?? 50;
    const opening = tvOpeningFromSelection({
      inches,
      mount: niche.mountType ?? "wall",
      modelId: niche.tvModelId,
      bezelMm,
    });
    get().setTvNiche({
      ...niche,
      bezelMm,
      width: opening.widthMm,
      height: opening.heightMm,
    });
    get().adaptTvColumnShelves();
  },

  setTvMountType: (mount) => {
    const state = get();
    if (!state.tvNiche) return;
    const niche = state.tvNiche;
    const inches = niche.selectedInches ?? DEFAULT_TV_NICHE.selectedInches ?? 50;
    const bezelMm = clampTvBezelMm(niche.bezelMm ?? 0);
    const opening = tvOpeningFromSelection({
      inches,
      mount,
      modelId: niche.tvModelId,
      bezelMm,
    });
    get().setTvNiche({
      ...niche,
      mountType: mount,
      bezelMm,
      width: opening.widthMm,
      height: opening.heightMm,
    });
    get().adaptTvColumnShelves();
  },

  setTvActiveZone: (zone) => set({ tvActiveZone: zone }),

  setTvAboveShelfCount: (count) => {
    const state = get();
    if (!state.tvNiche) return;
    get().setTvNiche({
      ...state.tvNiche,
      aboveShelfCount: Math.max(0, Math.min(8, Math.round(count))),
    });
    get().adaptTvColumnShelves();
  },

  setTvBelowShelfCount: (count) => {
    const state = get();
    if (!state.tvNiche) return;
    get().setTvNiche({
      ...state.tvNiche,
      belowShelfCount: Math.max(0, Math.min(8, Math.round(count))),
    });
    get().adaptTvColumnShelves();
  },

  adaptTvColumnShelves: () => {
    const state = get();
    if (!state.tvNiche || state.unitMode !== "media") return;
    const kickerMm = activeKickerMm(state);
    const niche = state.tvNiche;
    const outside = state.modules.filter((mod) => {
      const bay = state.bays.find((item) => item.id === mod.bayId);
      return !bay || !bayInTvNiche(bay.index, niche);
    });
    // Keep outer bay shelves; rebuild TV-column shelves around new size
    const rebuilt = createMediaModules(
      state.bays,
      state.wardrobe.height,
      niche,
      kickerMm,
    ).filter((mod) => {
      const bay = state.bays.find((item) => item.id === mod.bayId);
      return bay && bayInTvNiche(bay.index, niche);
    });
    // Also even-space shelves in outer bays so clearances stay tidy
    let modules = [...outside, ...rebuilt];
    for (const bay of state.bays) {
      if (bayInTvNiche(bay.index, niche)) continue;
      modules = evenSpaceShelvesInBay(
        modules,
        bay.id,
        state.wardrobe.height,
        state.wardrobe.height,
        { zoneTop: 0 },
      );
    }
    set({ modules });
  },

  setBayWidth: (bayId, width) => {
    const state = get();
    const { wardrobe, bays, unitMode, tvNiche } = state;
    const target = bays.find((bay) => bay.id === bayId);
    if (!target || target.lockedWidth) return;

    // Media + TV: never let a bay tweak steal the TV opening width
    if (unitMode === "media" && tvNiche) {
      if (bayInTvNiche(target.index, tvNiche)) {
        const sorted = [...bays].sort((a, b) => a.index - b.index);
        const start = tvNiche.startBayIndex;
        const end = Math.min(
          sorted.length - 1,
          tvNiche.startBayIndex + tvNiche.bayCount - 1,
        );
        const spanOthers = sorted
          .slice(start, end + 1)
          .filter((bay) => bay.id !== bayId)
          .reduce((sum, bay) => sum + bay.width, 0);
        get().setTvWidth(Math.round(width) + spanOthers);
        return;
      }
      const tentative = setFlexibleBayWidth(
        bays,
        bayId,
        width,
        wardrobe.width,
      );
      const nextBays = resizeBaysToTvWidth(
        tentative,
        tvNiche,
        tvNiche.width,
        wardrobe.width,
      );
      set({
        bays: nextBays,
        tvNiche: {
          ...tvNiche,
          width: tvNicheWidthMm(nextBays, tvNiche),
        },
      });
      return;
    }

    set({
      bays: setFlexibleBayWidth(bays, bayId, width, wardrobe.width),
    });
  },

  evenSpaceShelves: (bayId, options) => {
    const state = get();
    const { selectedBayId, wardrobe, modules, tvNiche, tvActiveZone, unitMode } =
      state;
    const id = bayId ?? selectedBayId;
    if (!id) return;
    const bay = state.bays.find((item) => item.id === id);
    if (!bay) return;
    const kickerMm = activeKickerMm(state);
    const target = options?.target ?? "bay";
    const remainder: EvenRemainderMode = options?.remainder ?? "bottom";
    const shelfH = MODULE_HEIGHTS.shelf;

    const isTvPocket =
      unitMode === "media" &&
      Boolean(tvNiche) &&
      bayInTvNiche(bay.index, tvNiche);

    // —— Match closest side-bay shelf lines ——————————————
    if (target === "sides") {
      const sorted = [...state.bays].sort((a, b) => a.index - b.index);
      const order = sorted.findIndex((item) => item.id === id);
      let sourceBayIds: string[] = [];

      if (isTvPocket && tvNiche) {
        sourceBayIds = sorted
          .filter((item) => !bayInTvNiche(item.index, tvNiche))
          .map((item) => item.id);
      } else {
        if (order > 0) sourceBayIds.push(sorted[order - 1].id);
        if (order >= 0 && order < sorted.length - 1) {
          sourceBayIds.push(sorted[order + 1].id);
        }
      }

      if (sourceBayIds.length === 0) {
        // No neighbors — fall back to bay even
        get().evenSpaceShelves(id, { target: "bay", remainder });
        return;
      }

      let spanStart = 0;
      let spanEnd = wardrobe.height;
      if (isTvPocket && tvNiche) {
        const assembly = tvNicheAssembly(tvNiche, wardrobe.height, kickerMm);
        const span =
          tvActiveZone === "above" ? assembly.aboveBay : assembly.belowBay;
        spanStart = span.start;
        spanEnd = span.end;
      } else {
        spanStart = mainZoneTop(wardrobe.height, wardrobe.carcassHeight);
      }

      const rawSideLines = [
        ...new Set(
          modules
            .filter(
              (mod) =>
                mod.type === "shelf" &&
                sourceBayIds.includes(mod.bayId) &&
                mod.y >= spanStart &&
                mod.y + shelfH <= spanEnd,
            )
            .map((mod) => Math.round(mod.y)),
        ),
      ].sort((a, b) => a - b);

      const localYs = modules
        .filter(
          (mod) =>
            mod.bayId === id &&
            mod.type === "shelf" &&
            mod.y >= spanStart &&
            mod.y + shelfH <= spanEnd,
        )
        .map((mod) => mod.y);
      // Ignore neighbour lines that would leave a sliver gap (e.g. 66 mm).
      const sideLines = collapseCloseShelfLines(
        rawSideLines,
        localYs,
        shelfH,
        150,
      );

      if (sideLines.length === 0) {
        get().evenSpaceShelves(id, { target: "bay", remainder });
        return;
      }

      if (isTvPocket && tvNiche) {
        const zoneShelves = modules
          .filter((mod) => {
            if (mod.bayId !== id || mod.type !== "shelf") return false;
            const mid = mod.y + mod.height / 2;
            return mid >= spanStart && mid <= spanEnd;
          })
          .sort((a, b) => a.y - b.y);
        const keepCount =
          zoneShelves.length > 0 ? zoneShelves.length : sideLines.length;
        // Keep side align lines; centre any extra shelves in the remaining pocket
        const ys =
          keepCount > sideLines.length
            ? alignAndCenterShelfYs(
                spanStart,
                spanEnd,
                shelfH,
                sideLines,
                keepCount,
                modules.filter(
                  (mod) => mod.bayId === id && mod.type !== "shelf",
                ),
              )
            : pickEvenShelfLines(sideLines, keepCount);
        let zi = 0;
        const next = modules.flatMap((mod) => {
          if (mod.bayId !== id || mod.type !== "shelf") return [mod];
          const mid = mod.y + mod.height / 2;
          if (mid < spanStart || mid > spanEnd) return [mod];
          if (zi >= ys.length) return [];
          const y = ys[zi];
          zi += 1;
          return [{ ...mod, y }];
        });
        set({ modules: next, selectedBayId: id });
        return;
      }

      const bayShelves = modules
        .filter(
          (mod) =>
            mod.bayId === id &&
            mod.type === "shelf" &&
            mod.y >= spanStart,
        )
        .sort((a, b) => a.y - b.y);
      const blockers = modules.filter(
        (mod) => mod.bayId === id && mod.type !== "shelf",
      );
      const keepCount =
        bayShelves.length > 0 ? bayShelves.length : sideLines.length;
      // Extra shelves (beyond neighbour lines) even in the leftover pocket
      // instead of sitting a sliver above the aligned shelf.
      const ys =
        keepCount > sideLines.length
          ? alignAndCenterShelfYs(
              spanStart,
              spanEnd,
              shelfH,
              sideLines,
              keepCount,
              blockers,
            )
          : bayShelves.length > 0
            ? snapShelvesToAlignLines(
                bayShelves.map((mod) => mod.y),
                sideLines,
                shelfH,
                blockers,
              )
            : pickEvenShelfLines(sideLines, keepCount);
      if (ys.length === 0) {
        get().evenSpaceShelves(id, { target: "bay", remainder });
        return;
      }
      const shelfIds = new Set(bayShelves.map((mod) => mod.id));
      let si = 0;
      const next = modules.flatMap((mod) => {
        if (mod.bayId !== id || mod.type !== "shelf") return [mod];
        if (bayShelves.length > 0 && !shelfIds.has(mod.id)) return [mod];
        if (si >= ys.length) return [];
        const y = ys[si];
        si += 1;
        return [{ ...mod, y }];
      });
      set({ modules: next, selectedBayId: id });
      return;
    }

    // —— Even this bay only ——————————————
    if (isTvPocket && tvNiche) {
      const assembly = tvNicheAssembly(tvNiche, wardrobe.height, kickerMm);
      const span =
        tvActiveZone === "above" ? assembly.aboveBay : assembly.belowBay;
      const zoneShelves = modules
        .filter((mod) => {
          if (mod.bayId !== id || mod.type !== "shelf") return false;
          const mid = mod.y + mod.height / 2;
          return mid >= span.start && mid <= span.end;
        })
        .sort((a, b) => a.y - b.y);
      if (zoneShelves.length === 0) return;
      const ys = evenShelfYsInSpan(
        span.start,
        span.end,
        zoneShelves.length,
        shelfH,
        remainder,
      );
      let zi = 0;
      const next = modules.map((mod) => {
        if (mod.bayId !== id || mod.type !== "shelf") return mod;
        const mid = mod.y + mod.height / 2;
        if (mid < span.start || mid > span.end) return mod;
        const y = ys[zi] ?? mod.y;
        zi += 1;
        return { ...mod, y };
      });
      set({ modules: next, selectedBayId: id });
      return;
    }

    const opts = shelfOptionsForBay(state, id);
    set({
      modules: evenSpaceShelvesInBay(
        modules,
        id,
        wardrobe.height,
        opts.carcassHeight,
        {
          zoneTop: opts.zoneTop,
          blockedSpans: opts.blockedSpans,
          remainder,
        },
      ),
      selectedBayId: id,
    });
  },

  evenTvFirstCompartments: () => {
    const state = get();
    if (state.unitMode !== "media" || !state.tvNiche) return;
    const kickerMm = activeKickerMm(state);
    get().setTvBottomFromKicker(
      evenTvFirstCompartmentBottomFromKicker(
        state.tvNiche,
        state.wardrobe.height,
        kickerMm,
      ),
    );
  },

  alignTvShelvesWithOuterBays: () => {
    const state = get();
    if (state.unitMode !== "media" || !state.tvNiche) return;
    const niche = state.tvNiche;
    const kickerMm = activeKickerMm(state);
    const assembly = tvNicheAssembly(
      niche,
      state.wardrobe.height,
      kickerMm,
    );
    const shelfH = MODULE_HEIGHTS.shelf;
    const primaryId = tvNichePrimaryBayId(state.bays, niche);
    const mergeAbove = tvNicheMergesColumns(niche, "above");
    const mergeBelow = tvNicheMergesColumns(niche, "below");

    const outerBayIds = new Set(
      state.bays
        .filter((bay) => !bayInTvNiche(bay.index, niche))
        .map((bay) => bay.id),
    );
    if (outerBayIds.size === 0) return;

    const outerLines = [
      ...new Set(
        state.modules
          .filter(
            (mod) => mod.type === "shelf" && outerBayIds.has(mod.bayId),
          )
          .map((mod) => Math.round(mod.y)),
      ),
    ].sort((a, b) => a - b);

    const aboveLines = outerLines.filter(
      (y) =>
        y >= assembly.aboveBay.start &&
        y + shelfH <= assembly.aboveBay.end,
    );
    const belowLines = outerLines.filter(
      (y) =>
        y >= assembly.belowBay.start &&
        y + shelfH <= assembly.belowBay.end,
    );

    // Keep non-TV modules + TV framing boards + dividers in TV bays
    const nextModules = state.modules.filter((mod) => {
      const bay = state.bays.find((item) => item.id === mod.bayId);
      if (!bay || !bayInTvNiche(bay.index, niche)) return true;
      if (mod.type === "divider") return true;
      if (mod.type !== "shelf") return true;
      const isFrame =
        Math.abs(mod.y - assembly.topBoard.y) < 0.5 ||
        Math.abs(mod.y - assembly.bottomBoard.y) < 0.5;
      return isFrame;
    });

    const tvBays = [...state.bays]
      .sort((a, b) => a.index - b.index)
      .filter((bay) => bayInTvNiche(bay.index, niche));

    for (const bay of tvBays) {
      const placeAbove = !mergeAbove || (primaryId !== null && bay.id === primaryId);
      const placeBelow = !mergeBelow || (primaryId !== null && bay.id === primaryId);
      if (placeAbove) {
        for (const y of aboveLines) {
          nextModules.push({
            id: createId(),
            type: "shelf",
            bayId: bay.id,
            y,
            height: shelfH,
          });
        }
      }
      if (placeBelow) {
        for (const y of belowLines) {
          nextModules.push({
            id: createId(),
            type: "shelf",
            bayId: bay.id,
            y,
            height: shelfH,
          });
        }
      }
    }

    set({
      modules: nextModules,
      tvNiche: {
        ...niche,
        aboveShelfCount: aboveLines.length,
        belowShelfCount: belowLines.length,
      },
      canvasHighlight: true,
    });
  },

  splitBayVertical: (bayId) => {
    const state = get();
    const id = bayId ?? state.selectedBayId;
    if (!id) return;
    const sorted = [...state.bays].sort((a, b) => a.index - b.index);
    const index = sorted.findIndex((bay) => bay.id === id);
    if (index < 0) return;
    const bay = sorted[index];
    if (bay.lockedWidth) return;
    if (sorted.length >= 12) return;

    // Media + TV niche: prefer increasing TV column span when splitting a TV bay
    if (
      state.unitMode === "media" &&
      state.tvNiche &&
      bayInTvNiche(bay.index, state.tvNiche)
    ) {
      if (tvNicheMergesColumns(state.tvNiche, state.tvActiveZone)) {
        get().setTvDivideAboveBelow(true);
      } else {
        get().setTvZoneColumns(
          (state.tvActiveZone === "above"
            ? state.tvNiche.aboveColumnCount
            : state.tvNiche.belowColumnCount) + 1,
        );
      }
      return;
    }

    const leftW = Math.floor(bay.width / 2);
    const rightW = bay.width - leftW;
    if (leftW < 200 || rightW < 200) return;

    const newBay: Bay = {
      id: createId(),
      index: bay.index + 1,
      width: rightW,
    };
    const nextBays = [
      ...sorted.slice(0, index),
      { ...bay, width: leftW },
      newBay,
      ...sorted.slice(index + 1),
    ].map((item, i) => ({ ...item, index: i }));

    // If media TV niche sits to the right of the split, shift start index
    let tvNiche = state.tvNiche;
    if (tvNiche && bay.index < tvNiche.startBayIndex) {
      tvNiche = { ...tvNiche, startBayIndex: tvNiche.startBayIndex + 1 };
    } else if (tvNiche && bayInTvNiche(bay.index, tvNiche)) {
      const zone = state.tvActiveZone;
      const nextCount =
        (zone === "above" ? tvNiche.aboveColumnCount : tvNiche.belowColumnCount) +
        1;
      tvNiche = {
        ...tvNiche,
        bayCount: tvNiche.bayCount + 1,
        ...(zone === "above"
          ? { aboveColumnCount: nextCount, divideAbove: true }
          : { belowColumnCount: nextCount, divideBelow: true }),
      };
    }

    set({
      bays: nextBays,
      tvNiche,
      selectedBayId: bay.id,
      selectedModuleId: null,
      canvasHighlight: true,
      bayCountInput: nextBays.length,
    });
  },

  addHorizontalUpright: (bayId) => {
    const state = get();
    const id = bayId ?? state.selectedBayId;
    if (!id) return;
    const bay = state.bays.find((item) => item.id === id);
    if (!bay) return;

    const height = MODULE_HEIGHTS.divider;
    let spanStart = 0;
    let spanEnd = state.wardrobe.height;

    if (
      state.unitMode === "media" &&
      state.tvNiche &&
      bayInTvNiche(bay.index, state.tvNiche)
    ) {
      const assembly = tvNicheAssembly(
        state.tvNiche,
        state.wardrobe.height,
        activeKickerMm(state),
      );
      const span =
        state.tvActiveZone === "above"
          ? assembly.aboveBay
          : assembly.belowBay;
      spanStart = span.start;
      spanEnd = span.end;
    }

    const clear = spanEnd - spanStart;
    if (clear < height * 3) return;

    // Place in the middle of the pocket; avoid stacking on an existing divider
    let y = Math.round(spanStart + (clear - height) / 2);
    const bayMods = state.modules.filter((mod) => mod.bayId === id);
    for (const mod of bayMods) {
      if (Math.abs(mod.y - y) < height + 10) {
        y = Math.min(spanEnd - height, mod.y + mod.height + 40);
      }
    }
    y = Math.max(spanStart, Math.min(spanEnd - height, y));

    const newId = createId();
    set({
      modules: [
        ...state.modules,
        {
          id: newId,
          type: "divider",
          bayId: id,
          y,
          height,
        },
      ],
      selectedBayId: id,
      selectedModuleId: newId,
      canvasHighlight: true,
    });
    // Re-even adjustable shelves around the new upright
    get().evenSpaceShelves(id);
  },

  swapBayWithNeighbor: (bayId, direction) => {
    set((state) => {
      const sorted = [...state.bays].sort((a, b) => a.index - b.index);
      const index = sorted.findIndex((bay) => bay.id === bayId);
      if (index < 0) return state;

      const swapIndex = direction === "left" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= sorted.length) return state;

      const reordered = [...sorted];
      const moved = reordered[index];
      reordered[index] = reordered[swapIndex];
      reordered[swapIndex] = moved;

      const nextBays = reordered.map((bay, i) => ({ ...bay, index: i }));

      const drawerInMovedBay = state.modules.find(
        (mod) => mod.bayId === moved.id && mod.type === "drawer-pack",
      );

      return {
        bays: nextBays,
        selectedBayId: moved.id,
        selectedModuleId: drawerInMovedBay?.id ?? state.selectedModuleId,
        canvasHighlight: true,
      };
    });
  },

  selectBay: (bayId, zone) => {
    const state = get();
    let id = bayId;
    const bay = id ? state.bays.find((item) => item.id === id) : null;
    const inTv =
      Boolean(bay) &&
      state.unitMode === "media" &&
      bayInTvNiche(bay!.index, state.tvNiche);

    // Undivided TV zone — fittings live on the primary bay only
    if (inTv && state.tvNiche) {
      const mergeZone = zone
        ? tvNicheMergesColumns(state.tvNiche, zone)
        : tvNicheMergesColumns(state.tvNiche);
      if (mergeZone) {
        id = tvNichePrimaryBayId(state.bays, state.tvNiche) ?? id;
      }
    }

    set({
      selectedBayId: id,
      selectedModuleId: null,
      canvasHighlight: id !== null,
      ...(inTv && zone ? { tvActiveZone: zone } : {}),
    });
  },

  selectModule: (moduleId) => {
    const state = get();
    const mod = state.modules.find((item) => item.id === moduleId) ?? null;
    let tvActiveZone = state.tvActiveZone;
    if (mod && state.unitMode === "media" && state.tvNiche) {
      const bay = state.bays.find((item) => item.id === mod.bayId);
      if (bay && bayInTvNiche(bay.index, state.tvNiche)) {
        const assembly = tvNicheAssembly(
          state.tvNiche,
          state.wardrobe.height,
          activeKickerMm(state),
        );
        const mid = mod.y + mod.height / 2;
        if (mid <= assembly.aboveBay.end) tvActiveZone = "above";
        else if (mid >= assembly.belowBay.start) tvActiveZone = "below";
      }
    }
    set({
      selectedModuleId: moduleId,
      selectedBayId: mod?.bayId ?? state.selectedBayId,
      canvasHighlight: true,
      tvActiveZone,
    });
  },

  clearCanvasHighlight: () =>
    set({
      canvasHighlight: false,
      selectedModuleId: null,
    }),

  setPdfExporting: (enabled) => set({ pdfExporting: Boolean(enabled) }),

  setQuoteTitle: (title) => set({ quoteTitle: title }),

  setUnitTabLabel: (label) => {
    const state = get();
    set({
      unitTabLabel: label,
      designs: state.designs.map((item) =>
        item.id === state.activeDesignId ? { ...item, label } : item,
      ),
    });
  },

  setUnitCaption: (caption) => {
    const state = get();
    set({
      unitCaption: caption,
      designs: state.designs.map((item) =>
        item.id === state.activeDesignId ? { ...item, caption } : item,
      ),
    });
  },

  setClientName: (name) =>
    set({
      clientName: name,
      clientNameRequired: name.trim() ? false : get().clientNameRequired,
    }),

  setClientNameRequired: (required) =>
    set({ clientNameRequired: Boolean(required) }),

  setDoorSystemRequired: (required) =>
    set({
      doorSystemRequired: Boolean(required),
      doorSystemPromptKey: required ? Date.now() : 0,
    }),

  setExtraNotes: (notes) => set({ extraNotes: notes }),

  setExtraNotesOnPdf: (enabled) => set({ extraNotesOnPdf: Boolean(enabled) }),

  commitAndGetDesigns: () => {
    const next = commitActiveDesign(get());
    set({ designs: next });
    return next;
  },

  addDesign: (mode = "wardrobe") => {
    const state = get();
    const committed = commitActiveDesign(state);
    const id = createId();
    const snap =
      mode === "media"
        ? createMediaSnapshot(id, nextMediaLabel(committed))
        : createWardrobeSnapshot(id, nextWardrobeLabel(committed));
    set({
      designs: [...committed, snap],
      ...snapshotToLive(snap),
    });
  },

  switchDesign: (id) => {
    const state = get();
    if (id === state.activeDesignId) return;
    const committed = commitActiveDesign(state);
    const target = committed.find((item) => item.id === id);
    if (!target) return;
    set({
      designs: committed,
      ...snapshotToLive(target),
    });
  },

  renameDesign: (id, label) => {
    const next = label.trim();
    if (!next) return;
    const state = get();
    const committed = commitActiveDesign(state);
    const target = committed.find((item) => item.id === id);
    if (!target) return;
    const autoCaption =
      !target.caption.trim() ||
      target.caption === DEFAULT_WARDROBE_CAPTION ||
      target.caption === DEFAULT_MEDIA_CAPTION ||
      target.caption.endsWith(target.label);
    const caption = autoCaption
      ? target.unitMode === "media"
        ? DEFAULT_MEDIA_CAPTION
        : DEFAULT_WARDROBE_CAPTION
      : target.caption;
    const designs = committed.map((item) =>
      item.id === id ? { ...item, label: next, caption } : item,
    );
    if (id === state.activeDesignId) {
      set({ designs, unitTabLabel: next, unitCaption: caption });
      return;
    }
    set({ designs });
  },

  removeDesign: (id) => {
    const state = get();
    if (state.designs.length <= 1) return;
    const committed = commitActiveDesign(state);
    const remaining = committed.filter((item) => item.id !== id);
    const next =
      state.activeDesignId === id
        ? remaining[0]
        : remaining.find((item) => item.id === state.activeDesignId) ??
          remaining[0];
    if (!next) return;
    set({
      designs: remaining,
      ...snapshotToLive(next),
    });
  },

  addModule: (type) => {
    const state = get();
    const {
      selectedBayId,
      bays,
      wardrobe,
      modules,
      defaultDrawerCount,
      unitMode,
      tvNiche,
    } = state;
    let bayId = selectedBayId ?? bays[0]?.id;
    if (!bayId) return;

    // Undivided TV zone — park fittings on the primary bay only
    if (unitMode === "media" && tvNiche) {
      const bay = bays.find((item) => item.id === bayId);
      if (bay && bayInTvNiche(bay.index, tvNiche)) {
        const zone = state.tvActiveZone;
        if (tvNicheMergesColumns(tvNiche, zone)) {
          bayId = tvNichePrimaryBayId(bays, tvNiche) ?? bayId;
        }
      }
    }

    const bayModules = modules.filter((mod) => mod.bayId === bayId);
    const shelfOpts = shelfOptionsForBay(state, bayId);

    if (type === "shelf") {
      // TV columns: add only in the active above/below pocket
      if (unitMode === "media" && tvNiche) {
        const bay = bays.find((item) => item.id === bayId);
        if (bay && bayInTvNiche(bay.index, tvNiche)) {
          const zone = state.tvActiveZone;
          // Uprights off — one shared count for the wide pocket
          if (tvNicheMergesColumns(tvNiche, zone)) {
            if (zone === "above") {
              get().setTvAboveShelfCount(tvNiche.aboveShelfCount + 1);
            } else {
              get().setTvBelowShelfCount(tvNiche.belowShelfCount + 1);
            }
            return;
          }
          // Uprights on — add a shelf only in this column + zone
          const assembly = tvNicheAssembly(
            tvNiche,
            wardrobe.height,
            activeKickerMm(state),
          );
          const span =
            zone === "above" ? assembly.aboveBay : assembly.belowBay;
          const shelfH = MODULE_HEIGHTS.shelf;
          const existing = modules.filter((mod) => {
            if (mod.bayId !== bayId || mod.type !== "shelf") return false;
            const mid = mod.y + mod.height / 2;
            return mid >= span.start && mid <= span.end;
          });
          const nextCount = existing.length + 1;
          const ys = evenShelfYsInSpan(
            span.start,
            span.end,
            nextCount,
            shelfH,
          );
          const withoutZone = modules.filter((mod) => {
            if (mod.bayId !== bayId || mod.type !== "shelf") return true;
            const mid = mod.y + mod.height / 2;
            return mid < span.start || mid > span.end;
          });
          const id = createId();
          const added = ys.map((y, index) => ({
            id: index === ys.length - 1 ? id : createId(),
            type: "shelf" as const,
            bayId,
            y,
            height: shelfH,
          }));
          set({
            modules: [...withoutZone, ...added],
            selectedBayId: bayId,
            selectedModuleId: id,
            canvasHighlight: true,
          });
          return;
        }
      }

      if (
        !canAddShelf(bayModules, wardrobe.height, shelfOpts.carcassHeight, {
          zoneTop: shelfOpts.zoneTop,
          blockedSpans: shelfOpts.blockedSpans,
        })
      ) {
        return;
      }

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
        modules: redistributeShelvesEvenly(withShelf, bayId, wardrobe.height, {
          forceEven: true,
          carcassHeight: shelfOpts.carcassHeight,
          zoneTop: shelfOpts.zoneTop,
          blockedSpans: shelfOpts.blockedSpans,
        }),
        selectedBayId: bayId,
        selectedModuleId: id,
      });
      return;
    }

    if (unitMode === "media") return;

    if (type === "drawer-pack") {
      const drawerBayId = findDrawerTargetBayId(bays, modules, bayId);
      if (!drawerBayId) return;
      bayId = drawerBayId;

      const drawerCount = clampDrawerCount(defaultDrawerCount);
      const height = drawerPackHeight(drawerCount);
      const y = Math.max(0, wardrobe.height - height);

      const id = createId();
      const withDrawer: Module[] = [
        ...modules,
        {
          id,
          type,
          bayId,
          y,
          height,
          drawerCount,
        },
      ];
      const laidOut = resizeWardrobeBaysForWidth(
        bays,
        withDrawer,
        wardrobe.width,
      );

      set({
        bays: laidOut.bays,
        modules: redistributeShelvesEvenly(
          laidOut.modules,
          bayId,
          wardrobe.height,
          {
            forceEven: true,
            carcassHeight: wardrobe.carcassHeight,
          },
        ),
        selectedBayId: bayId,
        selectedModuleId: id,
        canvasHighlight: true,
        bayCountInput: laidOut.bays.length,
      });
      return;
    }

    if (!canAddRail(bayModules, wardrobe.height, wardrobe.carcassHeight)) {
      return;
    }

    const existingRails = bayModules.filter(
      (mod) => mod.type === "hanging-rail",
    );
    const nextCount = existingRails.length + 1;
    const y = findHangingRailPlacementY(
      bayModules,
      wardrobe.height,
      wardrobe.carcassHeight,
    );
    if (y === null) return;

    const id = createId();
    let nextModules: Module[] = [
      ...modules,
      {
        id,
        type: "hanging-rail",
        bayId,
        y,
        height: MODULE_HEIGHTS["hanging-rail"],
      },
    ];

    let nextBays = bays;
    if (nextCount >= MAX_RAILS_PER_BAY) {
      const hadDrawers = nextModules.some(
        (mod) => mod.bayId === bayId && mod.type === "drawer-pack",
      );
      nextModules = nextModules.filter(
        (mod) =>
          !(
            mod.bayId === bayId &&
            (mod.type === "shelf" || mod.type === "drawer-pack")
          ),
      );
      if (hadDrawers) {
        const unlocked = bays.map((bay) =>
          bay.id === bayId ? { ...bay, lockedWidth: undefined } : bay,
        );
        nextBays = resizeBaysPreservingLocks(unlocked, wardrobe.width);
      }
    }

    nextModules = syncBayRailPositions(
      nextModules,
      bayId,
      wardrobe.height,
      wardrobe.carcassHeight,
    );

    set({
      bays: nextBays,
      modules: nextModules,
      selectedBayId: bayId,
      selectedModuleId: id,
    });
  },

  updateModuleY: (moduleId, y) => {
    const { wardrobe, modules, bays } = get();
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
      bays,
    );

    let nextModules = modules.map((item) =>
      item.id === moduleId ? { ...item, y: finalY } : item,
    );

    if (target.type === "hanging-rail") {
      nextModules = syncBayRailPositions(
        nextModules,
        target.bayId,
        wardrobe.height,
        wardrobe.carcassHeight,
      );
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
    const y = Math.max(0, wardrobe.height - height);
    const resized: Module = { ...target, drawerCount, height, y };

    const nextModules = modules.map((item) =>
      item.id === moduleId ? resized : item,
    );

    set({
      modules: redistributeShelvesEvenly(
        nextModules,
        target.bayId,
        wardrobe.height,
        {
          forceEven: true,
          carcassHeight: wardrobe.carcassHeight,
        },
      ),
      selectedModuleId: moduleId,
    });
  },

  removeModule: (moduleId) => {
    const state = get();
    const target = state.modules.find((mod) => mod.id === moduleId);
    if (!target) return;

    // TV pocket shelf — decrement above/below count and rebuild
    if (
      state.unitMode === "media" &&
      state.tvNiche &&
      target.type === "shelf"
    ) {
      const bay = state.bays.find((item) => item.id === target.bayId);
      if (bay && bayInTvNiche(bay.index, state.tvNiche)) {
        const kickerMm = activeKickerMm(state);
        const assembly = tvNicheAssembly(
          state.tvNiche,
          state.wardrobe.height,
          kickerMm,
        );
        const mid = target.y + target.height / 2;
        const isFrame =
          Math.abs(target.y - assembly.topBoard.y) < 0.5 ||
          Math.abs(target.y - assembly.bottomBoard.y) < 0.5;
        if (!isFrame) {
          if (mid <= assembly.aboveBay.end) {
            get().setTvAboveShelfCount(state.tvNiche.aboveShelfCount - 1);
            return;
          }
          if (mid >= assembly.belowBay.start) {
            get().setTvBelowShelfCount(state.tvNiche.belowShelfCount - 1);
            return;
          }
        }
      }
    }

    set((state) => {
      const target = state.modules.find((mod) => mod.id === moduleId);
      const remaining = state.modules.filter((mod) => mod.id !== moduleId);

      let nextBays = state.bays;
      if (target?.type === "drawer-pack") {
        const stillHasDrawers = remaining.some(
          (mod) => mod.bayId === target.bayId && mod.type === "drawer-pack",
        );
        if (!stillHasDrawers) {
          const unlocked = state.bays.map((bay) =>
            bay.id === target.bayId
              ? { ...bay, lockedWidth: undefined }
              : bay,
          );
          nextBays = resizeBaysPreservingLocks(unlocked, state.wardrobe.width);
        }
      }

      let nextModules = remaining;
      if (target) {
        if (target.type === "hanging-rail") {
          nextModules = syncBayRailPositions(
            remaining,
            target.bayId,
            state.wardrobe.height,
            state.wardrobe.carcassHeight,
          );
        }
        const opts = shelfOptionsForBay(state, target.bayId);
        nextModules = redistributeShelvesEvenly(
          nextModules,
          target.bayId,
          state.wardrobe.height,
          {
            forceEven: true,
            carcassHeight: opts.carcassHeight,
            zoneTop: opts.zoneTop,
            blockedSpans: opts.blockedSpans,
          },
        );
      }

      return {
        bays: nextBays,
        modules: nextModules,
        selectedModuleId:
          state.selectedModuleId === moduleId ? null : state.selectedModuleId,
      };
    });
  },

  clearBay: (bayId) => {
    const state = get();
    const { selectedBayId, modules, bays, wardrobe, tvNiche, tvActiveZone, unitMode } =
      state;
    const id = bayId ?? selectedBayId;
    if (!id) return;

    const bay = bays.find((item) => item.id === id);

    // TV pocket: clear only shelves in the active above/below zone
    if (
      unitMode === "media" &&
      tvNiche &&
      bay &&
      bayInTvNiche(bay.index, tvNiche)
    ) {
      const assembly = tvNicheAssembly(
        tvNiche,
        wardrobe.height,
        activeKickerMm(state),
      );
      const span =
        tvActiveZone === "above" ? assembly.aboveBay : assembly.belowBay;
      if (tvNicheMergesColumns(tvNiche, tvActiveZone)) {
        if (tvActiveZone === "above") get().setTvAboveShelfCount(0);
        else get().setTvBelowShelfCount(0);
        return;
      }
      const remaining = modules.filter((mod) => {
        if (mod.bayId !== id) return true;
        if (mod.type !== "shelf" && mod.type !== "divider") return true;
        const mid = mod.y + mod.height / 2;
        return mid < span.start || mid > span.end;
      });
      set({
        modules: remaining,
        selectedBayId: id,
        selectedModuleId: null,
      });
      return;
    }

    const hadDrawers = modules.some(
      (mod) => mod.bayId === id && mod.type === "drawer-pack",
    );
    const remaining = modules.filter((mod) => mod.bayId !== id);

    let nextBays = bays;
    if (hadDrawers) {
      const unlocked = bays.map((item) =>
        item.id === id ? { ...item, lockedWidth: undefined } : item,
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
      materials: {
        ...state.materials,
        boardMaterial: material,
        carcassColour:
          material === "woodgrain" ? "oak" : state.materials.carcassColour,
      },
    }));
  },

  setCarcassColour: (colour) => {
    set((state) => ({
      materials: {
        ...state.materials,
        carcassColour: colour,
        boardMaterial:
          colour === "oak" || colour === "walnut"
            ? "woodgrain"
            : "white-melamine",
      },
    }));
  },

  setHardwareTier: (tier) => {
    set((state) => ({
      materials: { ...state.materials, hardwareTier: tier },
    }));
  },

  setLineShelves: (enabled) => {
    set({ lineShelves: Boolean(enabled) });
  },

  setSlidingDoors: (enabled) => {
    get().setDoorSystem(enabled ? "sliding" : "none");
  },

  setDoorSystem: (system) => {
    set((state) => {
      const next = materialsWithDoorCount(
        {
          ...state.materials,
          doorSystem: system,
          slidingDoors: system === "sliding",
          doorsVisible:
            system === "none" ? state.materials.doorsVisible : true,
          mirrorSide: system === "none" ? "none" : state.materials.mirrorSide,
          slidingDoorHeightMm:
            system === "sliding" ? null : state.materials.slidingDoorHeightMm,
        },
        state.wardrobe.width,
      );
      return {
        materials: next,
        doorSystemRequired:
          system === "none" ? state.doorSystemRequired : false,
      };
    });
  },

  setDoorsVisible: (visible) => {
    set((state) => ({
      materials: {
        ...state.materials,
        doorsVisible: Boolean(visible),
      },
    }));
  },

  setMirrorSide: (side) => {
    set((state) => {
      const nextSystem =
        side === "none"
          ? state.materials.doorSystem
          : state.materials.doorSystem === "none"
            ? "sliding"
            : state.materials.doorSystem;
      return {
        materials: {
          ...state.materials,
          doorSystem: nextSystem,
          slidingDoors: nextSystem === "sliding",
          mirrorSide: side,
          doorsVisible:
            nextSystem === "none" ? state.materials.doorsVisible : true,
        },
      };
    });
  },

  setSlidingWidthMode: (mode) => {
    set((state) => ({
      materials: {
        ...state.materials,
        slidingWidthMode: mode,
        doorSystem: "sliding",
        slidingDoors: true,
        doorsVisible: true,
      },
    }));
  },

  applySliding500Kit: (doorCount, heightMm) => {
    const count = Math.max(2, Math.min(5, Math.round(doorCount)));
    const width = count * SLIDING_NARROW_LEAF_MM;
    const height = Math.min(
      SLIDING_NARROW_LEAF_MAX_HEIGHT_MM,
      Math.max(1800, Math.round(heightMm ?? SLIDING_NARROW_LEAF_MAX_HEIGHT_MM)),
    );
    const nextBays = createBaysWithCount(width, count, false);
    set((state) => ({
      unitMode: "wardrobe" as const,
      wardrobe: {
        width,
        height,
        depth: state.wardrobe.depth || DEFAULT_WARDROBE_DEPTH_INSIDE_MM,
        depthTotal:
          state.wardrobe.depthTotal || DEFAULT_WARDROBE_DEPTH_TOTAL_MM,
        carcassHeight: clampCarcassHeight(
          Math.min(2000, height),
          height,
        ),
      },
      bays: nextBays,
      modules: [],
      selectedBayId: nextBays[0]?.id ?? null,
      selectedModuleId: null,
      bayCountInput: count,
      materials: materialsWithDoorCount(
        {
          ...state.materials,
          doorSystem: "sliding",
          slidingDoors: true,
          doorsVisible: true,
          slidingWidthMode: "500mm",
          slidingDoorHeightMm: height,
        },
        width,
      ),
    }));
  },

  setSlidingDoorProduct: (product) => {
    const spec = slidingProductById(product as TmProduct);
    set((state) => {
      const face = spec.faces.includes(state.materials.slidingFace as TmFace)
        ? state.materials.slidingFace
        : (spec.faces[0] as SlidingDoorFace);
      const frame = spec.frames.includes(
        state.materials.slidingFrameColour as TmFrame,
      )
        ? state.materials.slidingFrameColour
        : (spec.frames[0] as SlidingFrameColour);
      const count = slidingDoorCount(state.wardrobe.width);
      const slidingDoorFaces = normalizeSlidingDoorFaces(
        state.materials.slidingDoorFaces.map((item) =>
          spec.faces.includes(item as TmFace)
            ? item
            : (spec.faces[0] as SlidingDoorFace),
        ),
        count,
        face,
      );
      return {
        materials: {
          ...state.materials,
          doorSystem: "sliding",
          slidingDoors: true,
          doorsVisible: true,
          slidingProduct: product,
          slidingFace: face,
          slidingFrameColour: frame,
          slidingDoorFaces,
          polyShakerRebate: normalizePolyShakerRebate(
            state.materials.polyShakerRebate,
            slidingDoorFaces,
            count,
          ),
          slidingLeafCount: count,
          mirrorSide: isGlassSlidingFace(face as TmFace)
            ? "both"
            : state.materials.mirrorSide,
        },
      };
    });
  },

  setSlidingDoorFace: (face) => {
    set((state) => {
      const count = slidingDoorCount(state.wardrobe.width);
      const slidingDoorFaces = Array.from({ length: count }, () => face);
      return {
        materials: {
          ...state.materials,
          slidingFace: face,
          slidingLeafCount: count,
          slidingDoorFaces,
          polyShakerRebate: normalizePolyShakerRebate(
            state.materials.polyShakerRebate,
            slidingDoorFaces,
            count,
          ),
          doorSystem: "sliding",
          slidingDoors: true,
          doorsVisible: true,
          mirrorSide: isGlassSlidingFace(face as TmFace)
            ? "both"
            : state.materials.mirrorSide,
        },
      };
    });
  },

  setSlidingLeafCount: (_count) => {
    set((state) => ({
      materials: materialsWithDoorCount(
        {
          ...state.materials,
          doorSystem: "sliding",
          slidingDoors: true,
          doorsVisible: true,
        },
        state.wardrobe.width,
      ),
    }));
  },

  setSlidingDoorFaceAt: (index, face) => {
    set((state) => {
      const count = slidingDoorCount(state.wardrobe.width);
      if (index < 0 || index >= count) return state;
      const faces = normalizeSlidingDoorFaces(
        state.materials.slidingDoorFaces,
        count,
        state.materials.slidingFace,
      );
      faces[index] = face;
      return {
        materials: {
          ...state.materials,
          doorSystem:
            state.materials.doorSystem === "none"
              ? "sliding"
              : state.materials.doorSystem,
          slidingDoors: state.materials.doorSystem !== "hinged",
          doorsVisible: true,
          slidingLeafCount: count,
          slidingDoorFaces: faces,
          polyShakerRebate: normalizePolyShakerRebate(
            state.materials.polyShakerRebate,
            faces,
            count,
          ),
          slidingFace: index === 0 ? face : state.materials.slidingFace,
        },
      };
    });
  },

  setPolyShakerRebateAt: (index, enabled) => {
    set((state) => {
      const count = slidingDoorCount(state.wardrobe.width);
      if (index < 0 || index >= count) return state;
      const faces = normalizeSlidingDoorFaces(
        state.materials.slidingDoorFaces,
        count,
        state.materials.slidingFace,
      );
      if (faces[index] !== "poly") return state;
      const flags = normalizePolyShakerRebate(
        state.materials.polyShakerRebate,
        faces,
        count,
      );
      flags[index] = Boolean(enabled);
      return {
        materials: {
          ...state.materials,
          polyShakerRebate: flags,
        },
      };
    });
  },

  setSlidingFrameColour: (colour) => {
    set((state) => ({
      materials: {
        ...state.materials,
        slidingFrameColour: colour,
        doorSystem: "sliding",
        slidingDoors: true,
        doorsVisible: true,
      },
    }));
  },

  applyWardrobeSizePreset: (presetId) => {
    const preset = WARDROBE_SIZE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    if (get().unitMode !== "wardrobe") {
      get().applyStandardLayout();
    }
    // Size only for W×H×D — door leaf applied separately when specified
    get().setWardrobeDepth(preset.depth);
    get().setWardrobeDepthTotal(
      preset.depth <= DEFAULT_WARDROBE_DEPTH_INSIDE_MM
        ? DEFAULT_WARDROBE_DEPTH_TOTAL_MM
        : Math.max(preset.depth, DEFAULT_WARDROBE_DEPTH_TOTAL_MM),
    );
    get().setWardrobeHeight(preset.height);
    get().setWardrobeWidth(preset.width);
    get().setCarcassHeight(preset.carcassHeight);
    if (preset.slidingDoorHeight && get().materials.doorSystem === "sliding") {
      get().setSlidingDoorHeight(preset.slidingDoorHeight);
    }
  },
}));
