/** TV screen sizes, popular models, and niche openings (wall vs stand). */

export type TvMountType = "wall" | "stand";

export type TvSizePreset = {
  inches: number;
  /** Active screen width (16:9), mm — no bezel */
  widthMm: number;
  /** Active screen height (16:9), mm — no bezel */
  heightMm: number;
  viewingDistanceM: number;
};

/**
 * Real-world chassis sizes from manufacturer-style tables
 * (Samsung / LG / Sony / TCL / Hisense — approx. current lineup).
 * Heights listed both without stand (wall) and with stand.
 */
export type TvModel = {
  id: string;
  brand: string;
  name: string;
  inches: number;
  /** Overall width including bezels, mm */
  widthMm: number;
  /** Height without stand (wall mount), mm */
  heightWallMm: number;
  /** Height with stand / feet, mm */
  heightStandMm: number;
  /** Depth with stand, mm (info only) */
  depthStandMm?: number;
};

/**
 * Extra recess clearance around a TV (each edge). Default is none —
 * add it with the bezel stepper in Media setup.
 */
export const DEFAULT_TV_BEZEL_MM = 0;
/** Bezel clearance step (mm) for + / −. */
export const TV_BEZEL_STEP_MM = 10;
/** @deprecated opening no longer includes a default bevel */
export const TV_BEVEL_CLEARANCE_MM = DEFAULT_TV_BEZEL_MM;

/**
 * Extra height added under a generic (non-model) screen size when
 * “with stand” is selected — typical pedestal / foot rise.
 */
export const TV_GENERIC_STAND_EXTRA_MM = 80;

/** 16:9 screen size from diagonal inches → mm (rounded). */
function screenFromInches(inches: number): { widthMm: number; heightMm: number } {
  const diagMm = inches * 25.4;
  const widthMm = Math.round(diagMm * (16 / Math.hypot(16, 9)));
  const heightMm = Math.round(diagMm * (9 / Math.hypot(16, 9)));
  return { widthMm, heightMm };
}

function viewingDistanceM(inches: number): number {
  return Math.round(inches * 0.03 * 10) / 10;
}

function sizePreset(inches: number): TvSizePreset {
  const { widthMm, heightMm } = screenFromInches(inches);
  return { inches, widthMm, heightMm, viewingDistanceM: viewingDistanceM(inches) };
}

/**
 * Common retail diagonals (screen-only 16:9).
 */
export const TV_SIZE_PRESETS: TvSizePreset[] = [
  sizePreset(24),
  sizePreset(27),
  sizePreset(32),
  sizePreset(40),
  sizePreset(42),
  sizePreset(43),
  sizePreset(48),
  sizePreset(50),
  sizePreset(55),
  sizePreset(58),
  sizePreset(60),
  sizePreset(65),
  sizePreset(70),
  sizePreset(75),
  sizePreset(77),
  sizePreset(83),
  sizePreset(85),
  sizePreset(86),
  sizePreset(90),
  sizePreset(98),
  sizePreset(100),
  sizePreset(110),
  sizePreset(115),
];

/** Extra viewing-distance rows for the info table. */
export const TV_VIEWING_DISTANCE_EXTRA: {
  inches: number;
  viewingDistanceM: number;
}[] = [
  { inches: 120, viewingDistanceM: viewingDistanceM(120) },
  { inches: 130, viewingDistanceM: viewingDistanceM(130) },
];

/** Default / base screen size when adding a TV. */
export const DEFAULT_TV_INCHES = 50;
export const DEFAULT_TV_MOUNT: TvMountType = "wall";

/**
 * Popular models with published-style overall dims (mm).
 * Sources: manufacturer / retailer dimension tables (approximate by series).
 */
export const TV_MODELS: TvModel[] = [
  // —— 43" ——
  {
    id: "samsung-43-cu8000",
    brand: "Samsung",
    name: "Crystal UHD",
    inches: 43,
    widthMm: 965,
    heightWallMm: 559,
    heightStandMm: 619,
    depthStandMm: 193,
  },
  {
    id: "lg-43-ut80",
    brand: "LG",
    name: "UT80 UHD",
    inches: 43,
    widthMm: 967,
    heightWallMm: 564,
    heightStandMm: 622,
    depthStandMm: 216,
  },
  // —— 48" ——
  {
    id: "lg-48-c-oled",
    brand: "LG",
    name: "OLED C series",
    inches: 48,
    widthMm: 1071,
    heightWallMm: 618,
    heightStandMm: 676,
    depthStandMm: 230,
  },
  {
    id: "sony-48-a90",
    brand: "Sony",
    name: "Bravia XR A90",
    inches: 48,
    widthMm: 1069,
    heightWallMm: 622,
    heightStandMm: 685,
    depthStandMm: 259,
  },
  // —— 50" ——
  {
    id: "samsung-50-cu8000",
    brand: "Samsung",
    name: "Crystal UHD",
    inches: 50,
    widthMm: 1118,
    heightWallMm: 644,
    heightStandMm: 713,
    depthStandMm: 228,
  },
  {
    id: "lg-50-ut80",
    brand: "LG",
    name: "UT80 UHD",
    inches: 50,
    widthMm: 1121,
    heightWallMm: 651,
    heightStandMm: 716,
    depthStandMm: 231,
  },
  {
    id: "tcl-50-c745",
    brand: "TCL",
    name: "C745 QLED",
    inches: 50,
    widthMm: 1114,
    heightWallMm: 648,
    heightStandMm: 720,
    depthStandMm: 280,
  },
  // —— 58" ——
  {
    id: "samsung-58-cu8000",
    brand: "Samsung",
    name: "Crystal UHD",
    inches: 58,
    widthMm: 1295,
    heightWallMm: 747,
    heightStandMm: 820,
    depthStandMm: 247,
  },
  {
    id: "tcl-58-s55",
    brand: "TCL",
    name: "S55 series",
    inches: 58,
    widthMm: 1288,
    heightWallMm: 745,
    heightStandMm: 815,
    depthStandMm: 280,
  },
  // —— 55" ——
  {
    id: "samsung-55-qn90",
    brand: "Samsung",
    name: "Neo QLED",
    inches: 55,
    widthMm: 1227,
    heightWallMm: 709,
    heightStandMm: 782,
    depthStandMm: 256,
  },
  {
    id: "lg-55-c-oled",
    brand: "LG",
    name: "OLED C series",
    inches: 55,
    widthMm: 1228,
    heightWallMm: 708,
    heightStandMm: 772,
    depthStandMm: 231,
  },
  {
    id: "sony-55-bravia",
    brand: "Sony",
    name: "Bravia XR",
    inches: 55,
    widthMm: 1234,
    heightWallMm: 711,
    heightStandMm: 782,
    depthStandMm: 340,
  },
  {
    id: "hisense-55-u8",
    brand: "Hisense",
    name: "U8 series",
    inches: 55,
    widthMm: 1229,
    heightWallMm: 712,
    heightStandMm: 785,
    depthStandMm: 300,
  },
  // —— 65" ——
  {
    id: "samsung-65-qn90",
    brand: "Samsung",
    name: "Neo QLED QN90",
    inches: 65,
    widthMm: 1445,
    heightWallMm: 831,
    heightStandMm: 892,
    depthStandMm: 256,
  },
  {
    id: "lg-65-c-oled",
    brand: "LG",
    name: "OLED C series",
    inches: 65,
    widthMm: 1440,
    heightWallMm: 831,
    heightStandMm: 887,
    depthStandMm: 231,
  },
  {
    id: "sony-65-a95",
    brand: "Sony",
    name: "Bravia XR A95",
    inches: 65,
    widthMm: 1443,
    heightWallMm: 835,
    heightStandMm: 894,
    depthStandMm: 226,
  },
  {
    id: "tcl-65-qm8",
    brand: "TCL",
    name: "QM8 series",
    inches: 65,
    widthMm: 1448,
    heightWallMm: 838,
    heightStandMm: 909,
    depthStandMm: 307,
  },
  {
    id: "hisense-65-u8",
    brand: "Hisense",
    name: "U8 series",
    inches: 65,
    widthMm: 1450,
    heightWallMm: 836,
    heightStandMm: 902,
    depthStandMm: 300,
  },
  // —— 70" ——
  {
    id: "samsung-70-cu8000",
    brand: "Samsung",
    name: "Crystal UHD",
    inches: 70,
    widthMm: 1557,
    heightWallMm: 896,
    heightStandMm: 975,
    depthStandMm: 295,
  },
  {
    id: "tcl-70-c745",
    brand: "TCL",
    name: "C745 QLED",
    inches: 70,
    widthMm: 1554,
    heightWallMm: 898,
    heightStandMm: 980,
    depthStandMm: 310,
  },
  // —— 75" ——
  {
    id: "samsung-75-qn90",
    brand: "Samsung",
    name: "Neo QLED",
    inches: 75,
    widthMm: 1673,
    heightWallMm: 958,
    heightStandMm: 1035,
    depthStandMm: 310,
  },
  {
    id: "lg-75-qned",
    brand: "LG",
    name: "QNED",
    inches: 75,
    widthMm: 1669,
    heightWallMm: 960,
    heightStandMm: 1032,
    depthStandMm: 311,
  },
  {
    id: "hisense-75-u7",
    brand: "Hisense",
    name: "U7 series",
    inches: 75,
    widthMm: 1668,
    heightWallMm: 963,
    heightStandMm: 1024,
    depthStandMm: 325,
  },
  {
    id: "sony-75-bravia",
    brand: "Sony",
    name: "Bravia XR",
    inches: 75,
    widthMm: 1672,
    heightWallMm: 962,
    heightStandMm: 1038,
    depthStandMm: 340,
  },
  // —— 77" OLED ——
  {
    id: "lg-77-c-oled",
    brand: "LG",
    name: "OLED C series",
    inches: 77,
    widthMm: 1721,
    heightWallMm: 991,
    heightStandMm: 1055,
    depthStandMm: 251,
  },
  {
    id: "sony-77-a95",
    brand: "Sony",
    name: "Bravia XR A95",
    inches: 77,
    widthMm: 1723,
    heightWallMm: 995,
    heightStandMm: 1060,
    depthStandMm: 260,
  },
  // —— 83" ——
  {
    id: "lg-83-c-oled",
    brand: "LG",
    name: "OLED C series",
    inches: 83,
    widthMm: 1847,
    heightWallMm: 1060,
    heightStandMm: 1135,
    depthStandMm: 285,
  },
  {
    id: "sony-83-a80",
    brand: "Sony",
    name: "Bravia XR A80",
    inches: 83,
    widthMm: 1848,
    heightWallMm: 1065,
    heightStandMm: 1140,
    depthStandMm: 340,
  },
  // —— 85" ——
  {
    id: "samsung-85-qn90",
    brand: "Samsung",
    name: "Neo QLED",
    inches: 85,
    widthMm: 1895,
    heightWallMm: 1085,
    heightStandMm: 1168,
    depthStandMm: 330,
  },
  {
    id: "lg-85-qned",
    brand: "LG",
    name: "QNED",
    inches: 85,
    widthMm: 1896,
    heightWallMm: 1090,
    heightStandMm: 1170,
    depthStandMm: 340,
  },
  {
    id: "tcl-85-qm8",
    brand: "TCL",
    name: "QM8 series",
    inches: 85,
    widthMm: 1899,
    heightWallMm: 1094,
    heightStandMm: 1185,
    depthStandMm: 360,
  },
];

export function getTvPreset(inches: number): TvSizePreset | undefined {
  return TV_SIZE_PRESETS.find((p) => p.inches === inches);
}

export function getTvModel(id: string | null | undefined): TvModel | undefined {
  if (!id) return undefined;
  return TV_MODELS.find((m) => m.id === id);
}

export function tvModelsForInches(inches: number): TvModel[] {
  return TV_MODELS.filter((m) => m.inches === inches);
}

export type TvOpeningInput = {
  inches: number;
  mount: TvMountType;
  modelId?: string | null;
  /** Extra clearance on each edge (left, right, top, bottom), mm */
  bezelMm?: number;
};

export function clampTvBezelMm(mm: number): number {
  const rounded = Math.round(mm / TV_BEZEL_STEP_MM) * TV_BEZEL_STEP_MM;
  return Math.max(0, Math.min(200, rounded));
}

/** Chassis / screen size only — no bezel clearance. */
export function tvBodyFromSelection(input: TvOpeningInput): {
  widthMm: number;
  heightMm: number;
  preset: TvSizePreset;
  model?: TvModel;
} {
  const preset = getTvPreset(input.inches) ?? sizePreset(input.inches);
  const model = getTvModel(input.modelId ?? null);

  if (model) {
    const heightBody =
      input.mount === "stand" ? model.heightStandMm : model.heightWallMm;
    return {
      widthMm: model.widthMm,
      heightMm: heightBody,
      preset,
      model,
    };
  }

  if (input.mount === "stand") {
    return {
      widthMm: preset.widthMm,
      heightMm: preset.heightMm + TV_GENERIC_STAND_EXTRA_MM,
      preset,
    };
  }

  return {
    widthMm: preset.widthMm,
    heightMm: preset.heightMm,
    preset,
  };
}

/** Niche opening from screen / model + mount + optional bezel on each edge. */
export function tvOpeningFromSelection(input: TvOpeningInput): {
  widthMm: number;
  heightMm: number;
  preset: TvSizePreset;
  model?: TvModel;
} {
  const body = tvBodyFromSelection(input);
  const bezel = clampTvBezelMm(input.bezelMm ?? DEFAULT_TV_BEZEL_MM);
  return {
    widthMm: body.widthMm + bezel * 2,
    heightMm: body.heightMm + bezel * 2,
    preset: body.preset,
    model: body.model,
  };
}

/** @deprecated use tvOpeningFromSelection — kept for callers expecting screen+bevel only */
export function tvOpeningFromPreset(preset: TvSizePreset): {
  widthMm: number;
  heightMm: number;
} {
  return tvOpeningFromSelection({
    inches: preset.inches,
    mount: "wall",
  });
}

export function matchTvPresetFromOpening(
  widthMm: number,
  heightMm: number,
  mount: TvMountType = "wall",
): TvSizePreset | undefined {
  return TV_SIZE_PRESETS.find((p) => {
    const opening = tvOpeningFromSelection({ inches: p.inches, mount });
    return (
      Math.abs(opening.widthMm - widthMm) <= 30 &&
      Math.abs(opening.heightMm - heightMm) <= 40
    );
  });
}

export function matchTvModelFromOpening(
  widthMm: number,
  heightMm: number,
  mount: TvMountType,
): TvModel | undefined {
  return TV_MODELS.find((m) => {
    const opening = tvOpeningFromSelection({
      inches: m.inches,
      mount,
      modelId: m.id,
    });
    return (
      Math.abs(opening.widthMm - widthMm) <= 20 &&
      Math.abs(opening.heightMm - heightMm) <= 25
    );
  });
}

export function formatViewingDistance(meters: number): string {
  return Number.isInteger(meters) ? `${meters} m` : `${meters} m`;
}

export function formatMountLabel(mount: TvMountType): string {
  return mount === "stand" ? "With stand" : "Wall mounted";
}
