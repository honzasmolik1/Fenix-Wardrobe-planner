export type CarcassColour = "white" | "oak" | "walnut" | "grey" | "black";

export const CARCASS_COLOURS: Record<
  CarcassColour,
  { label: string; fill: string; fascia: string }
> = {
  /** Base finish — clean melamine white, like a PAX frame */
  white: { label: "White", fill: "#f6f6f4", fascia: "#eeeeec" },
  oak: { label: "Oak", fill: "#d9bd9c", fascia: "#c9a983" },
  walnut: { label: "Walnut", fill: "#8b5a2b", fascia: "#74481f" },
  grey: { label: "Grey", fill: "#d2d5d9", fascia: "#bfc3c9" },
  black: { label: "Black", fill: "#3a3d44", fascia: "#2c2f35" },
};

export const CARCASS_COLOUR_IDS = Object.keys(
  CARCASS_COLOURS,
) as CarcassColour[];
