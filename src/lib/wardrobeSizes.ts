/** Standard wardrobe overall sizes (mm). Door count follows width. */

export type WardrobeSizePreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  depth: number;
  /** Main carcass height from floor to construction shelf */
  carcassHeight: number;
  /** Optional sliding door leaf height (mm); leaves a top fascia above */
  slidingDoorHeight?: number;
};

/** Preset labels are W × H × D only — door count and faces are not part of unit size. */
export const WARDROBE_SIZE_PRESETS: WardrobeSizePreset[] = [
  {
    id: "1000x2400x450-2x500",
    label: "1000 × 2400 × 450",
    width: 1000,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
    slidingDoorHeight: 2400,
  },
  {
    id: "1500x2400x450-3x500",
    label: "1500 × 2400 × 450",
    width: 1500,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
    slidingDoorHeight: 2400,
  },
  {
    id: "2000x2400x450-4x500",
    label: "2000 × 2400 × 450",
    width: 2000,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
    slidingDoorHeight: 2400,
  },
  {
    id: "1800x2400x450",
    label: "1800 × 2400 × 450",
    width: 1800,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
  },
  {
    id: "2400x2400x450",
    label: "2400 × 2400 × 450",
    width: 2400,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
  },
  {
    id: "2400x2500x450-doors2350",
    label: "2400 × 2500 × 450",
    width: 2400,
    height: 2500,
    depth: 450,
    carcassHeight: 2350,
    slidingDoorHeight: 2350,
  },
  {
    id: "2700x2400x450",
    label: "2700 × 2400 × 450",
    width: 2700,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
  },
  {
    id: "3000x2400x450",
    label: "3000 × 2400 × 450",
    width: 3000,
    height: 2400,
    depth: 450,
    carcassHeight: 2000,
  },
  {
    id: "3600x2400x600",
    label: "3600 × 2400 × 600",
    width: 3600,
    height: 2400,
    depth: 600,
    carcassHeight: 2000,
  },
  {
    id: "4800x2400x600",
    label: "4800 × 2400 × 600",
    width: 4800,
    height: 2400,
    depth: 600,
    carcassHeight: 2000,
  },
];

/** Re-exports for older imports */
export {
  SLIDING_OPENING_2_MAX_MM as SLIDING_DOORS_2_MAX_WIDTH_MM,
  slidingDoorCount,
  slidingDoorRuleLabel,
  slidingOpeningBandLabel,
} from "@/lib/wardrobeDoors";

