"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import Konva from "konva";

if (typeof window !== "undefined") {
  Konva.pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
}
import {
  normalizeBayWidths,
} from "@/lib/standardLayout";
import {
  DRAWER_BAY_WIDTH_MM,
  CARCASS_SNAP_MM,
  CONSTRUCTION_SHELF_HEIGHT_MM,
  MIN_CARCASS_HEIGHT_MM,
  MIN_DRAWER_COUNT,
  MIN_TOP_BOX_MM,
  constructionShelfY,
  mainZoneTop,
} from "@/lib/constants";
import {
  bayInTvNiche,
  tvNicheAssembly,
  tvNicheMergesColumns,
  tvNichePrimaryBayId,
} from "@/lib/mediaLayout";
import { resolveModuleY, neighborShelfAlignLines, nearestShelfAlignLine } from "@/lib/placement";
import {
  doorHasShakerRebate,
  doorPanelLabel,
  hingedHandleOnRight,
  planDoorPanels,
} from "@/lib/wardrobeDoors";
import {
  isGlassSlidingFace,
  slidingFaceFill,
  slidingFrameStroke,
} from "@/lib/trademasterDoors";
import { CARCASS_COLOURS, type CarcassColour } from "@/lib/carcassColours";
import {
  type Module,
  useWardrobeStore,
} from "@/store/store";

/** Space around the carcass for dimension labels (must fit full height/width text) */
const DIM_LEFT = 108;
const DIM_RIGHT = 132;
const DIM_TOP = 56;
const DIM_BOTTOM = 78;
/** Extra margin so the drawing sits a bit off the screen/PDF edges */
const EDGE_GAP = 6;
/** Fill the canvas — small shrink so outer dims never clip */
const FIT_SHRINK = 0.99;
/** Minimum finger hit height for thin shelves (px) */
const SHELF_HIT_PX = 36;
/** Carcass / corpus board thickness — every panel is 18 mm. */
const CORPUS_MM = 18;
/** Hairline drawn on each face of a board (screen px). */
const EDGE_PX = 1;
/** Soft board edge — reads as a real panel edge, not a CAD line */
const EDGE_COLOR = "rgba(58, 62, 68, 0.5)";
/** Selection accent (matches the app’s warm accent) */
const SELECT_COLOR = "#8d6b45";
/** Dimension lines + badges */
const DIM_LINE_COLOR = "#4a4f57";
const BADGE_FILL = "#1f2226";
const GAP_DIM_COLOR = "#7a808a";
const GAP_DIM_ACTIVE = "#3d434c";
/**
 * Studio backdrop (screen only — PDF stays white). The wall flips light or
 * dark against the carcass finish so a white unit never washes into it.
 */
const BACKDROP_FOR_LIGHT_UNIT = {
  wallTop: "#c6ccd5",
  wallBottom: "#aab2bf",
  floorTop: "#a79e91",
  floorBottom: "#918879",
};
const BACKDROP_FOR_DARK_UNIT = {
  wallTop: "#f4f5f7",
  wallBottom: "#e4e7eb",
  floorTop: "#e2ded7",
  floorBottom: "#d1ccc2",
};

function carcassColourId(
  colour: CarcassColour | undefined,
  boardMaterial: string,
): CarcassColour {
  if (colour && CARCASS_COLOURS[colour]) return colour;
  return boardMaterial === "woodgrain" ? "oak" : "white";
}

function carcassFill(
  colour: CarcassColour | undefined,
  boardMaterial: string,
): string {
  return CARCASS_COLOURS[carcassColourId(colour, boardMaterial)].fill;
}

function carcassFascia(
  colour: CarcassColour | undefined,
  boardMaterial: string,
): string {
  return CARCASS_COLOURS[carcassColourId(colour, boardMaterial)].fascia;
}

function fillIsDark(hex: string): boolean {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function mixHex(hex: string, toward: string, amount: number): string {
  const parse = (value: string) => {
    const n = Number.parseInt(value.replace("#", ""), 16);
    if (Number.isNaN(n)) return [200, 180, 150] as const;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const a = parse(hex);
  const b = parse(toward);
  const t = Math.min(1, Math.max(0, amount));
  const ch = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `#${[ch(0), ch(1), ch(2)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function snapPx(n: number): number {
  return Math.round(n);
}

/** Raised shaker frame (~80 mm) with a recessed centre panel. */
const SHAKER_RAIL_MM = 80;
const SHAKER_REBATE_MM = 10;

function ShakerRebateVisual({
  x,
  y,
  width,
  height,
  scale,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}) {
  const rail = Math.min(
    Math.max(12, SHAKER_RAIL_MM * scale),
    width * 0.28,
    height * 0.16,
  );
  const rebate = Math.max(2, SHAKER_REBATE_MM * scale);
  const innerX = x + rail;
  const innerY = y + rail;
  const innerW = width - rail * 2;
  const innerH = height - rail * 2;
  if (innerW < 10 || innerH < 10) return null;
  const stepX = innerX - rebate;
  const stepY = innerY - rebate;
  const stepW = innerW + rebate * 2;
  const stepH = innerH + rebate * 2;

  return (
    <Group listening={false}>
      <Rect
        x={stepX}
        y={stepY}
        width={stepW}
        height={stepH}
        fill="rgba(55, 42, 28, 0.16)"
      />
      <Rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        fill="rgba(90, 72, 52, 0.1)"
      />
      <Rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={Math.max(1.5, 2.4 * scale)}
        fill="rgba(0,0,0,0.18)"
      />
      <Rect
        x={innerX}
        y={innerY}
        width={Math.max(1.5, 2.4 * scale)}
        height={innerH}
        fill="rgba(0,0,0,0.12)"
      />
      <Rect
        x={innerX}
        y={innerY + innerH - Math.max(1, 1.2 * scale)}
        width={innerW}
        height={Math.max(1, 1.2 * scale)}
        fill="rgba(255,255,255,0.28)"
      />
      <Rect
        x={innerX + innerW - Math.max(1, 1.2 * scale)}
        y={innerY}
        width={Math.max(1, 1.2 * scale)}
        height={innerH}
        fill="rgba(255,255,255,0.22)"
      />
      <Rect
        x={stepX}
        y={stepY + stepH - Math.max(1, 1.3 * scale)}
        width={stepW}
        height={Math.max(1, 1.3 * scale)}
        fill="rgba(255,255,255,0.4)"
      />
      <Rect
        x={stepX + stepW - Math.max(1, 1.3 * scale)}
        y={stepY}
        width={Math.max(1, 1.3 * scale)}
        height={stepH}
        fill="rgba(255,255,255,0.28)"
      />
    </Group>
  );
}

/**
 * Corpus metrics (18 mm boards):
 * — 1 board → one solid panel with a hairline on each face
 * — 2 boards → double wall, two panels side by side
 * At small zoom, keep a minimum screen width so panels stay readable.
 */
function corpusMetrics(scale: number, boards: 1 | 2) {
  const stroke = EDGE_PX;
  const board = Math.max(CORPUS_MM * scale, 3);
  const total = board * boards;
  return { board, stroke, total, boards };
}

/**
 * One melamine board: solid colour, soft light→shade across its thickness,
 * hairline edge on both faces. `vertical` = upright (shade left→right).
 */
function BoardRect({
  x,
  y,
  width,
  height,
  fill,
  vertical = false,
  edges = "both",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  vertical?: boolean;
  /** Which face hairlines to draw */
  edges?: "both" | "none" | "start" | "end";
}) {
  if (width <= 0 || height <= 0) return null;
  const e = EDGE_PX;
  const drawStart = edges === "both" || edges === "start";
  const drawEnd = edges === "both" || edges === "end";
  return (
    <Group listening={false}>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        perfectDrawEnabled={false}
      />
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={
          vertical ? { x: width, y: 0 } : { x: 0, y: height }
        }
        fillLinearGradientColorStops={[
          0,
          "rgba(255,255,255,0.55)",
          0.45,
          "rgba(255,255,255,0)",
          1,
          "rgba(0,0,0,0.13)",
        ]}
        perfectDrawEnabled={false}
      />
      {vertical ? (
        <>
          {drawStart && (
            <Rect x={x} y={y} width={e} height={height} fill={EDGE_COLOR} />
          )}
          {drawEnd && (
            <Rect
              x={x + width - e}
              y={y}
              width={e}
              height={height}
              fill={EDGE_COLOR}
            />
          )}
        </>
      ) : (
        <>
          {drawStart && (
            <Rect x={x} y={y} width={width} height={e} fill={EDGE_COLOR} />
          )}
          {drawEnd && (
            <Rect
              x={x}
              y={y + height - e}
              width={width}
              height={e}
              fill={EDGE_COLOR}
            />
          )}
        </>
      )}
    </Group>
  );
}

/** Soft shadow cast downwards by a horizontal board onto what’s below it. */
function BoardShadowBelow({
  x,
  y,
  width,
  scale,
  strength = 0.16,
}: {
  x: number;
  y: number;
  width: number;
  scale: number;
  strength?: number;
}) {
  const h = Math.max(3, Math.min(10, 26 * scale));
  if (width <= 0) return null;
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={h}
      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
      fillLinearGradientEndPoint={{ x: 0, y: h }}
      fillLinearGradientColorStops={[
        0,
        `rgba(0,0,0,${strength})`,
        1,
        "rgba(0,0,0,0)",
      ]}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}

/** IKEA-style black pill with white measurement text. */
function DimBadge({
  x,
  y,
  text,
  fontSize = 13,
  anchor = "center",
}: {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  anchor?: "center" | "left" | "right";
}) {
  const padX = 8;
  const h = Math.round(fontSize + 10);
  const w = Math.round(text.length * fontSize * 0.6 + padX * 2);
  const left =
    anchor === "center" ? x - w / 2 : anchor === "right" ? x - w : x;
  return (
    <Group listening={false}>
      <Rect
        x={snapPx(left)}
        y={snapPx(y - h / 2)}
        width={w}
        height={h}
        fill={BADGE_FILL}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />
      <Text
        x={snapPx(left)}
        y={snapPx(y - h / 2)}
        width={w}
        height={h}
        align="center"
        verticalAlign="middle"
        text={text}
        fontSize={fontSize}
        fill="#ffffff"
        fontStyle="bold"
        wrap="none"
      />
    </Group>
  );
}

/** Split [y, y+height] into segments that avoid the given breaks. */
function spanMinusBreaks(
  y: number,
  height: number,
  breaks: { y: number; height: number }[],
): { y: number; height: number }[] {
  if (height <= 0) return [];
  const end = y + height;
  const sorted = [...breaks]
    .map((b) => ({
      y: Math.max(y, b.y),
      end: Math.min(end, b.y + b.height),
    }))
    .filter((b) => b.end > b.y)
    .sort((a, b) => a.y - b.y);
  const out: { y: number; height: number }[] = [];
  let cursor = y;
  for (const b of sorted) {
    if (b.y > cursor) out.push({ y: cursor, height: b.y - cursor });
    cursor = Math.max(cursor, b.end);
  }
  if (end > cursor) out.push({ y: cursor, height: end - cursor });
  return out.filter((s) => s.height > 1);
}

/**
 * Vertical upright — single 18 mm board (double line) or double-wall
 * (two 18 mm boards → triple lines).
 *
 * Housed rail corner (wardrobe top / TV box):
 * — Outer face runs through the rail (“till end”)
 * — Middle + inner faces stop for the 18 mm rail
 * — Board fills stop too, so the rail stays visible inside the upright
 * — Draw the rail first, spanning to the outer face
 */
function CarcassUpright({
  centerX,
  y,
  height,
  gapFill,
  scale,
  doubleWall,
  edge = "center",
  endInsetMm = 0,
  innerBreaks = [],
}: {
  centerX: number;
  y: number;
  height: number;
  gapFill: string;
  scale: number;
  doubleWall: boolean;
  /** Which face is the outside that runs full height */
  edge?: "left" | "right" | "center";
  /** Shorten inner face(s) by this many mm at top + bottom (18 = corpus) */
  endInsetMm?: number;
  /** Gaps punched through inner/middle faces (rail tuck-ins) */
  innerBreaks?: { y: number; height: number }[];
}) {
  if (height <= 1) return null;
  const { board, stroke, total, boards } = corpusMetrics(
    scale,
    doubleWall ? 2 : 1,
  );
  const leftX = centerX - total / 2;
  const insetPx = Math.max(0, endInsetMm) * scale;
  const hasPocket = insetPx > 0 || innerBreaks.length > 0;

  const pocketSegs = hasPocket
    ? spanMinusBreaks(
        y + insetPx,
        Math.max(0, height - insetPx * 2),
        innerBreaks,
      )
    : [{ y, height }];

  const outerLineX =
    edge === "left" ? leftX : edge === "right" ? leftX + total - stroke : null;

  return (
    <Group listening={false}>
      {/* Panels open at pockets so housed rails aren’t painted over */}
      {Array.from({ length: boards }, (_, i) =>
        pocketSegs.map((seg, si) =>
          seg.height <= 1 ? null : (
            <BoardRect
              key={`board-${i}-${si}`}
              x={leftX + board * i}
              y={seg.y}
              width={board}
              height={seg.height}
              fill={gapFill}
              vertical
            />
          ),
        ),
      )}
      {/* Outside face runs the full height (“till end”) over the rail ends */}
      {outerLineX !== null && (
        <Rect
          x={outerLineX}
          y={y}
          width={stroke}
          height={height}
          fill={EDGE_COLOR}
        />
      )}
    </Group>
  );
}

/**
 * Horizontal corpus rail — one 18 mm board drawn as a double line
 * (two faces 18 mm apart), used for wardrobe top / bottom and TV box.
 */
function CorpusRail({
  x,
  y,
  width,
  scale,
  gapFill = "#ffffff",
  shadowBelow = false,
}: {
  x: number;
  y: number;
  width: number;
  scale: number;
  gapFill?: string;
  /** Cast a soft shadow onto the space under this board */
  shadowBelow?: boolean;
}) {
  if (width <= 1) return null;
  const { board } = corpusMetrics(scale, 1);
  return (
    <Group listening={false}>
      {shadowBelow && (
        <BoardShadowBelow x={x} y={y + board} width={width} scale={scale} />
      )}
      <BoardRect x={x} y={y} width={width} height={board} fill={gapFill} />
    </Group>
  );
}

/**
 * Outer side past the kicker: only the outside face continues to the floor
 * (white panel). Inner face(s) stop on the kicker.
 */
function OuterSideKickerWrap({
  side,
  centerX,
  y,
  height,
  scale,
  panelFill = "#ffffff",
  doubleWall = false,
}: {
  side: "left" | "right";
  centerX: number;
  y: number;
  height: number;
  scale: number;
  panelFill?: string;
  doubleWall?: boolean;
}) {
  if (height <= 1) return null;
  const { board, total } = corpusMetrics(scale, doubleWall ? 2 : 1);
  const leftX = centerX - total / 2;
  // Outer 18 mm board strip wraps the plinth in white
  const panelX = side === "left" ? leftX : leftX + total - board;

  return (
    <BoardRect
      x={panelX}
      y={y}
      width={board}
      height={height}
      fill={panelFill}
      vertical
      edges={side === "left" ? "start" : "end"}
    />
  );
}

function getBayOriginX(bays: { width: number }[], bayIndex: number): number {
  return bays.slice(0, bayIndex).reduce((sum, bay) => sum + bay.width, 0);
}

interface ModuleShapeProps {
  mod: Module;
  bayWidthPx: number;
  scale: number;
  wardrobeHeight: number;
  selected: boolean;
  onSelect: (moduleId: string) => void;
  onDragEnd: (moduleId: string, yMm: number) => void;
  /** Alignment grid from left-bay shelves while dragging */
  onAlignGuide?: (guide: {
    linesMm: number[];
    activeY: number | null;
  } | null) => void;
}

function ModuleShape({
  mod,
  bayWidthPx,
  scale,
  wardrobeHeight,
  selected,
  onSelect,
  onDragEnd,
  onAlignGuide,
}: ModuleShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const draggingRef = useRef(false);
  const materials = useWardrobeStore((state) => state.materials);
  const boardFill = carcassFill(materials.carcassColour, materials.boardMaterial);
  // Shelves, drawers and uprights meet the walls — no decorative side gap
  const inset =
    mod.type === "shelf" ||
    mod.type === "divider" ||
    mod.type === "drawer-pack"
      ? 0
      : Math.max(8, 10 * scale);
  const heightPx = Math.max(mod.height * scale, 3);
  const widthPx = Math.max(bayWidthPx - inset * 2, 4);
  const drawerCount = Math.max(MIN_DRAWER_COUNT, mod.drawerCount ?? 3);
  const hitHeight =
    mod.type === "shelf" || mod.type === "divider"
      ? Math.max(heightPx, SHELF_HIT_PX)
      : mod.type === "hanging-rail"
        ? Math.max(heightPx, 40)
        : heightPx;
  const hitOffsetY = (heightPx - hitHeight) / 2;

  useEffect(() => {
    if (draggingRef.current) return;
    groupRef.current?.y(mod.y * scale);
    groupRef.current?.x(inset);
  }, [inset, mod.y, scale]);

  const publishGuide = (yMm: number | null) => {
    if (!onAlignGuide || mod.type !== "shelf") return;
    if (yMm == null) {
      onAlignGuide(null);
      return;
    }
    const state = useWardrobeStore.getState();
    const linesMm = neighborShelfAlignLines(
      state.modules,
      state.bays,
      mod.bayId,
      { ignoreId: mod.id },
    );
    const activeY = nearestShelfAlignLine(yMm, linesMm);
    onAlignGuide({ linesMm, activeY });
  };

  return (
    <Group
      ref={groupRef}
      x={inset}
      y={mod.y * scale}
      draggable={mod.type !== "hanging-rail"}
      dragBoundFunc={(pos) => {
        const maxY = Math.max(0, wardrobeHeight * scale - heightPx);
        let nextY = Math.min(Math.max(0, pos.y), maxY);

        // Shelves: snap to left-bay align grid + 10 mm gap grid while dragging
        if (mod.type === "shelf" || mod.type === "divider") {
          const state = useWardrobeStore.getState();
          const bayModules = state.modules.filter(
            (item) => item.bayId === mod.bayId,
          );
          const snappedMm = resolveModuleY(
            mod,
            nextY / scale,
            bayModules,
            state.wardrobe.height,
            state.modules,
            state.wardrobe.carcassHeight,
            state.bays,
          );
          nextY = Math.min(maxY, Math.max(0, snappedMm * scale));
          if (mod.type === "shelf") {
            publishGuide(snappedMm);
          }
        }

        return {
          x: inset,
          y: nextY,
        };
      }}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect(mod.id);
      }}
      onTouchStart={(event) => {
        event.cancelBubble = true;
        event.evt.preventDefault();
        onSelect(mod.id);
      }}
      onDragStart={(event) => {
        draggingRef.current = true;
        event.evt.preventDefault();
        onSelect(mod.id);
        if (mod.type === "shelf") {
          publishGuide(mod.y);
        }
      }}
      onDragMove={(event) => {
        event.evt.preventDefault();
      }}
      onDragEnd={(event) => {
        const node = event.currentTarget;
        const yMm = node.y() / scale;
        // Resolve in store, then pin the node immediately so drawers don't
        // visually stick above the floor while React re-renders.
        onDragEnd(mod.id, yMm);
        const resolved = useWardrobeStore
          .getState()
          .modules.find((item) => item.id === mod.id);
        if (resolved) {
          node.y(resolved.y * scale);
          node.x(inset);
        }
        draggingRef.current = false;
        onAlignGuide?.(null);
      }}
      onMouseEnter={(event) => {
        const stage = event.target.getStage();
        if (stage) {
          stage.container().style.cursor =
            mod.type === "hanging-rail" ? "pointer" : "ns-resize";
        }
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    >
      {/* Invisible tall hit area — shelves are thin; fingers need this */}
      <Rect
        x={0}
        y={hitOffsetY}
        width={widthPx}
        height={hitHeight}
        fill="rgba(0,0,0,0.001)"
      />
      {mod.type === "drawer-pack" ? (
        <DrawerPackVisual
          widthPx={widthPx}
          heightPx={heightPx}
          drawerCount={drawerCount}
          selected={selected}
          boardFill={boardFill}
        />
      ) : mod.type === "hanging-rail" ? (
        <HangingRailVisual
          widthPx={widthPx}
          heightPx={heightPx}
          selected={selected}
        />
      ) : (
        // Shelf / fixed upright — a real 18 mm board with a soft shadow under it
        <Group listening={false}>
          <BoardShadowBelow
            x={0}
            y={Math.max(heightPx, 3)}
            width={widthPx}
            scale={scale}
            strength={0.14}
          />
          <BoardRect
            x={0}
            y={0}
            width={widthPx}
            height={Math.max(heightPx, 3)}
            fill={boardFill}
          />
          {mod.type === "divider" && heightPx >= 12 && (
            <Text
              x={0}
              y={Math.max(0, heightPx / 2 - 5)}
              width={widthPx}
              align="center"
              text="Upright"
              fontSize={9}
              fill={fillIsDark(boardFill) ? "#f4f4f4" : "#6d7380"}
            />
          )}
          {selected && (
            <Rect
              x={-1}
              y={-1}
              width={widthPx + 2}
              height={Math.max(heightPx, 3) + 2}
              stroke={SELECT_COLOR}
              strokeWidth={2}
              fill="rgba(141, 107, 69, 0.12)"
            />
          )}
        </Group>
      )}
    </Group>
  );
}

function HangingRailVisual({
  widthPx,
  heightPx,
  selected,
}: {
  widthPx: number;
  heightPx: number;
  selected: boolean;
}) {
  const bracketW = Math.max(10, Math.min(18, widthPx * 0.06));
  const bracketH = Math.max(16, heightPx * 0.85);
  const rodH = Math.max(6, heightPx * 0.38);
  const rodY = (heightPx - rodH) / 2;
  const rodX = bracketW * 0.55;
  const rodW = widthPx - rodX * 2;
  const accent = selected ? "#0f766e" : "#64748b";
  const chromeLight = "#f8fafc";
  const chromeMid = "#cbd5e1";
  const chromeDark = "#64748b";

  const hangerCount = Math.max(2, Math.min(5, Math.floor(widthPx / 70)));
  const hangerGap = rodW / (hangerCount + 1);

  return (
    <Group>
      {/* Invisible hit area */}
      <Rect width={widthPx} height={heightPx} fill="rgba(0,0,0,0)" />

      {/* Left wall bracket */}
      <Rect
        x={0}
        y={(heightPx - bracketH) / 2}
        width={bracketW}
        height={bracketH}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: bracketW, y: 0 }}
        fillLinearGradientColorStops={[0, chromeDark, 0.5, chromeMid, 1, chromeLight]}
        cornerRadius={3}
        stroke={accent}
        strokeWidth={selected ? 2 : 1}
      />
      <Circle
        x={bracketW * 0.55}
        y={heightPx / 2}
        radius={Math.max(3, rodH * 0.45)}
        fill={chromeDark}
        stroke={chromeLight}
        strokeWidth={1}
      />

      {/* Right wall bracket */}
      <Rect
        x={widthPx - bracketW}
        y={(heightPx - bracketH) / 2}
        width={bracketW}
        height={bracketH}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: bracketW, y: 0 }}
        fillLinearGradientColorStops={[0, chromeLight, 0.5, chromeMid, 1, chromeDark]}
        cornerRadius={3}
        stroke={accent}
        strokeWidth={selected ? 2 : 1}
      />
      <Circle
        x={widthPx - bracketW * 0.55}
        y={heightPx / 2}
        radius={Math.max(3, rodH * 0.45)}
        fill={chromeDark}
        stroke={chromeLight}
        strokeWidth={1}
      />

      {/* Chrome hanging rod */}
      <Rect
        x={rodX}
        y={rodY}
        width={rodW}
        height={rodH}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: rodH }}
        fillLinearGradientColorStops={[
          0,
          chromeLight,
          0.35,
          chromeMid,
          0.7,
          "#94a3b8",
          1,
          chromeDark,
        ]}
        cornerRadius={rodH / 2}
        shadowColor="rgba(15, 23, 42, 0.35)"
        shadowBlur={selected ? 8 : 4}
        shadowOffsetY={2}
        shadowOpacity={0.4}
        stroke={selected ? "#0f766e" : "#475569"}
        strokeWidth={selected ? 1.5 : 1}
      />
      {/* Highlight shine on rod */}
      <Rect
        x={rodX + 4}
        y={rodY + rodH * 0.18}
        width={Math.max(8, rodW - 8)}
        height={Math.max(1.5, rodH * 0.22)}
        fill="rgba(255,255,255,0.65)"
        cornerRadius={rodH}
        listening={false}
      />

      {/* Simple coat-hanger silhouettes */}
      {Array.from({ length: hangerCount }, (_, index) => {
        const cx = rodX + hangerGap * (index + 1);
        const top = rodY + rodH * 0.65;
        const arm = Math.max(10, Math.min(18, widthPx * 0.04));
        return (
          <Group key={index} listening={false} opacity={0.55}>
            <Line
              points={[cx, top, cx, top + 10]}
              stroke="#475569"
              strokeWidth={1.5}
              lineCap="round"
            />
            <Line
              points={[cx - arm, top + 16, cx, top + 10, cx + arm, top + 16]}
              stroke="#475569"
              strokeWidth={1.5}
              lineCap="round"
              lineJoin="round"
            />
          </Group>
        );
      })}
    </Group>
  );
}

function DrawerPackVisual({
  widthPx,
  heightPx,
  drawerCount,
  selected,
  boardFill,
}: {
  widthPx: number;
  heightPx: number;
  drawerCount: number;
  selected: boolean;
  boardFill: string;
}) {
  // Thin reveal between fronts, like a real drawer stack
  const gap = Math.max(1.5, Math.min(3, heightPx * 0.012));
  const slotHeight = (heightPx - gap * (drawerCount + 1)) / drawerCount;
  // Fronts match the carcass colour; the box behind sits in shadow
  const boxFill = mixHex(boardFill, "#000000", 0.16);
  const frontFill = mixHex(boardFill, "#000000", 0.02);
  const dark = fillIsDark(frontFill);
  const labelFill = dark ? "#e8e8ea" : "#6d7380";
  const handleFill = dark ? "#d8d9dc" : "#4a4f57";
  const frontW = Math.max(4, widthPx - gap * 2);

  return (
    <Group>
      <Rect
        width={widthPx}
        height={heightPx}
        fill={boxFill}
        perfectDrawEnabled={false}
      />
      {Array.from({ length: drawerCount }, (_, index) => {
        const y = gap + index * (slotHeight + gap);
        const h = Math.max(4, slotHeight);
        const handleW = Math.min(frontW * 0.3, 44);
        const handleH = Math.max(2, Math.min(3.5, h * 0.08));
        return (
          <Group key={index} listening={false}>
            <Rect
              x={gap}
              y={y}
              width={frontW}
              height={h}
              fill={frontFill}
              perfectDrawEnabled={false}
            />
            {/* Light from above: faint top highlight, deeper bottom edge */}
            <Rect
              x={gap}
              y={y}
              width={frontW}
              height={h}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 0, y: h }}
              fillLinearGradientColorStops={[
                0,
                "rgba(255,255,255,0.35)",
                0.2,
                "rgba(255,255,255,0)",
                0.85,
                "rgba(0,0,0,0)",
                1,
                "rgba(0,0,0,0.14)",
              ]}
              perfectDrawEnabled={false}
            />
            <Rect
              x={gap}
              y={y}
              width={frontW}
              height={h}
              stroke={EDGE_COLOR}
              strokeWidth={1}
              perfectDrawEnabled={false}
            />
            <Rect
              x={gap + (frontW - handleW) / 2}
              y={y + h / 2 - handleH / 2}
              width={handleW}
              height={handleH}
              fill={handleFill}
              cornerRadius={handleH}
              perfectDrawEnabled={false}
            />
          </Group>
        );
      })}
      {heightPx >= 28 && (
        <Text
          text={`${drawerCount} drawer${drawerCount === 1 ? "" : "s"}`}
          width={widthPx}
          y={gap + 4}
          align="center"
          fontSize={Math.min(11, Math.max(9, heightPx * 0.07))}
          fill={labelFill}
          fontStyle="bold"
          listening={false}
        />
      )}
      <Rect
        width={widthPx}
        height={heightPx}
        stroke={selected ? SELECT_COLOR : EDGE_COLOR}
        strokeWidth={selected ? 2 : 1}
        fill={selected ? "rgba(141, 107, 69, 0.1)" : "transparent"}
        listening={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

function GapDimLine({
  y1,
  y2,
  scale,
  color,
  lineX = 6,
  fontScale = 1,
}: {
  y1: number;
  y2: number;
  scale: number;
  color: string;
  lineX?: number;
  fontScale?: number;
}) {
  const heightPx = y2 - y1;
  if (heightPx < 8) return null;
  const a = snapPx(Math.min(y1, y2));
  const b = snapPx(Math.max(y1, y2));
  const x = snapPx(lineX);
  const midY = snapPx((a + b) / 2);
  const tick = 4;
  const fs = Math.round((heightPx >= 36 ? 13 : 12) * fontScale);
  const dash = [4, 4];
  const period = 8;
  return (
    <Group listening={false}>
      <Line
        points={[x, a, x, b]}
        stroke={color}
        strokeWidth={1}
        dash={dash}
        dashOffset={((a % period) + period) % period}
        lineCap="butt"
        perfectDrawEnabled={false}
      />
      <Line
        points={[x - tick, a, x + tick, a]}
        stroke={color}
        strokeWidth={1}
        lineCap="butt"
        perfectDrawEnabled={false}
      />
      <Line
        points={[x - tick, b, x + tick, b]}
        stroke={color}
        strokeWidth={1}
        lineCap="butt"
        perfectDrawEnabled={false}
      />
      <Text
        x={Math.round(lineX + 4)}
        y={midY - fs / 2}
        text={`${Math.round(heightPx / scale)} mm`}
        fontSize={fs}
        fill={color}
        fontStyle="bold"
        wrap="none"
        listening={false}
      />
    </Group>
  );
}

function BayMeasurements({
  modules,
  zoneTopMm,
  wardrobeHeight,
  bayWidthPx,
  scale,
  accent,
  allowZonesPx,
  fontScale = 1,
}: {
  modules: Module[];
  zoneTopMm: number;
  wardrobeHeight: number;
  bayWidthPx: number;
  scale: number;
  accent: boolean;
  /** Vertical pockets in canvas pixels (shelf faces, rails, floor). */
  allowZonesPx?: { start: number; end: number }[];
  fontScale?: number;
}) {
  const boardPx = corpusMetrics(scale, 1).board;
  const occupy = (mod: Module) => {
    const top = mod.y * scale;
    const height =
      mod.type === "shelf" || mod.type === "divider"
        ? boardPx
        : mod.height * scale;
    return { top, bottom: top + height };
  };
  const zones =
    allowZonesPx && allowZonesPx.length > 0
      ? allowZonesPx
      : [{ start: zoneTopMm * scale, end: wardrobeHeight * scale }];
  const gaps: { y1: number; y2: number }[] = [];
  for (const zone of zones) {
    if (zone.end <= zone.start) continue;
    const inZone = modules
      .filter((mod) => {
        const box = occupy(mod);
        return box.bottom > zone.start && box.top < zone.end;
      })
      .sort((a, b) => occupy(a).top - occupy(b).top);
    let cursor = zone.start;
    for (const mod of inZone) {
      const box = occupy(mod);
      const top = Math.max(box.top, zone.start);
      if (top > cursor + 1) {
        gaps.push({ y1: cursor, y2: top });
      }
      cursor = Math.max(cursor, Math.min(box.bottom, zone.end));
    }
    if (cursor < zone.end - 1) {
      gaps.push({ y1: cursor, y2: zone.end });
    }
  }
  const color = accent ? GAP_DIM_ACTIVE : GAP_DIM_COLOR;
  const uprightHalf = corpusMetrics(scale, 1).total / 2;
  const lineX = Math.min(
    Math.max(uprightHalf + 14, 22),
    Math.max(24, bayWidthPx * 0.18),
  );

  return (
    <Group listening={false}>
      {gaps.map((gap) => (
        <GapDimLine
          key={`gap-${gap.y1}-${gap.y2}`}
          y1={gap.y1}
          y2={gap.y2}
          scale={scale}
          color={color}
          lineX={lineX}
          fontScale={fontScale}
        />
      ))}
    </Group>
  );
}

export function WardrobeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [pixelRatio, setPixelRatio] = useState(2);

  useEffect(() => {
    const readRatio = () =>
      setPixelRatio(
        Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      );
    readRatio();
    const media = window.matchMedia(
      `screen and (resolution: ${window.devicePixelRatio}dppx)`,
    );
    window.addEventListener("resize", readRatio);
    media.addEventListener?.("change", readRatio);
    return () => {
      window.removeEventListener("resize", readRatio);
      media.removeEventListener?.("change", readRatio);
    };
  }, []);
  const [alignGuide, setAlignGuide] = useState<{
    linesMm: number[];
    activeY: number | null;
  } | null>(null);
  const alignGuideKeyRef = useRef("");
  const onAlignGuide = (guide: {
    linesMm: number[];
    activeY: number | null;
  } | null) => {
    const key = guide
      ? `${guide.activeY ?? "x"}:${guide.linesMm.join(",")}`
      : "";
    if (key === alignGuideKeyRef.current) return;
    alignGuideKeyRef.current = key;
    setAlignGuide(guide);
  };

  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const tvActiveZone = useWardrobeStore((state) => state.tvActiveZone);
  const selectedModuleId = useWardrobeStore((state) => state.selectedModuleId);
  const canvasHighlight = useWardrobeStore((state) => state.canvasHighlight);
  const pdfExporting = useWardrobeStore((state) => state.pdfExporting);
  const labelScale = pdfExporting ? 1.12 : 1;
  const materials = useWardrobeStore((state) => state.materials);
  const unitMode = useWardrobeStore((state) => state.unitMode);
  const kickerEnabled = useWardrobeStore((state) => state.kickerEnabled);
  const kickerHeight = useWardrobeStore((state) => state.kickerHeight);
  const tvNiche = useWardrobeStore((state) => state.tvNiche);
  const isMedia = unitMode === "media";
  const kickerMm = isMedia && kickerEnabled ? kickerHeight : 0;
  const selectBay = useWardrobeStore((state) => state.selectBay);
  const selectModule = useWardrobeStore((state) => state.selectModule);
  const clearCanvasHighlight = useWardrobeStore(
    (state) => state.clearCanvasHighlight,
  );
  const updateModuleY = useWardrobeStore((state) => state.updateModuleY);
  const setCarcassHeight = useWardrobeStore((state) => state.setCarcassHeight);
  const constructDragRef = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);
      setSize((prev) => {
        if (
          Math.abs(prev.width - nextWidth) < 2 &&
          Math.abs(prev.height - nextHeight) < 2
        ) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Drawer bays stay 500 mm, and the bays always add up to the full width
  useEffect(() => {
    const state = useWardrobeStore.getState();
    if (state.unitMode === "media") return;
    const needsLock = state.bays.some((bay) => {
      const hasDrawer = state.modules.some(
        (mod) => mod.bayId === bay.id && mod.type === "drawer-pack",
      );
      return (
        hasDrawer &&
        (bay.width !== DRAWER_BAY_WIDTH_MM || !bay.lockedWidth)
      );
    });
    const totalBayWidth = state.bays.reduce((sum, bay) => sum + bay.width, 0);
    if (!needsLock && totalBayWidth === state.wardrobe.width) return;
    const { bays, modules } = normalizeBayWidths(
      state.bays,
      state.modules,
      state.wardrobe.width,
    );
    useWardrobeStore.setState({
      bays,
      modules,
      bayCountInput: bays.length,
    });
  }, []);

  // Prevent page scroll from stealing tablet finger drags on the canvas
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    container.style.touchAction = "none";
    container.style.userSelect = "none";
    container.style.setProperty("-webkit-user-select", "none");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    Konva.pixelRatio = pixelRatio;
    for (const layer of stage.getLayers()) {
      const canvas = layer.getCanvas();
      if (canvas.getPixelRatio() !== pixelRatio) {
        canvas.setPixelRatio(pixelRatio);
      }
      const hit = layer.getHitCanvas();
      if (hit.getPixelRatio() !== pixelRatio) {
        hit.setPixelRatio(pixelRatio);
      }
    }
    stage.batchDraw();
  }, [pixelRatio, size.width, size.height]);

  const scale = useMemo(() => {
    // Outer sides = double wall; top/bottom rails = one board each
    const contentWmm = wardrobe.width + CORPUS_MM * 2 * 2;
    const contentHmm = wardrobe.height + CORPUS_MM * 2 + kickerMm;
    // Dim label gutters are fixed px — subtract them from the fit box
    const availableWidth = Math.max(
      120,
      size.width - EDGE_GAP * 2 - DIM_LEFT - DIM_RIGHT,
    );
    const availableHeight = Math.max(
      120,
      size.height - EDGE_GAP * 2 - DIM_TOP - DIM_BOTTOM,
    );
    const raw =
      Math.min(availableWidth / contentWmm, availableHeight / contentHmm) *
      FIT_SHRINK;
    // Snap board thickness to whole px for crisp edges — but never let the
    // round-up push the drawing (and its dimension badges) out of the box.
    const rounded = Math.max(2, Math.round(CORPUS_MM * raw));
    const fits =
      (rounded / CORPUS_MM) * contentWmm <= availableWidth &&
      (rounded / CORPUS_MM) * contentHmm <= availableHeight;
    return fits ? rounded / CORPUS_MM : Math.max(2 / CORPUS_MM, raw);
  }, [kickerMm, size.height, size.width, wardrobe.height, wardrobe.width]);

  /** Wardrobe + media: outer sides are always 2 uprights (double wall) */
  const useDoubleOuter =
    !isMedia || tvNiche == null || tvNiche.doubleWallUprights !== false;
  const sidePx = corpusMetrics(scale, useDoubleOuter ? 2 : 1).total;
  /** Top/bottom rails are a single 18 mm board — interior starts under them */
  const railPx = corpusMetrics(scale, 1).board;
  /** @deprecated alias — horizontal side inset */
  const boardPx = sidePx;
  const innerWidth = wardrobe.width * scale;
  const innerHeight = wardrobe.height * scale;
  const kickerPx = kickerMm * scale;
  const outerWidth = innerWidth + sidePx * 2;
  const carcassOuterHeight = innerHeight + railPx * 2;
  const outerHeight = carcassOuterHeight + kickerPx;
  const stageWidth = Math.max(1, Math.round(size.width));
  const stageHeight = Math.max(1, Math.round(size.height));
  const originX = Math.max(
    DIM_LEFT,
    Math.round((stageWidth - outerWidth) / 2),
  );
  const originY = Math.min(
    Math.max(DIM_TOP, Math.round((stageHeight - outerHeight) / 2)),
    Math.max(DIM_TOP, stageHeight - outerHeight - DIM_BOTTOM),
  );

  const boardColour = carcassFill(
    materials.carcassColour,
    materials.boardMaterial,
  );
  // Back panel sits in shade so the boards read as the lighter surface
  const interiorFill = mixHex(boardColour, "#7d828a", 0.12);
  const fasciaFill = carcassFascia(
    materials.carcassColour,
    materials.boardMaterial,
  );
  const boardPaint = boardColour;
  const kickerFill = fasciaFill;
  const showScene = !pdfExporting;
  const backdrop = fillIsDark(boardColour)
    ? BACKDROP_FOR_DARK_UNIT
    : BACKDROP_FOR_LIGHT_UNIT;
  /** Line carcass with double outer walls (wardrobe always; media when enabled) */
  const doubleOuterSides = useDoubleOuter;
  const carcassHeight = wardrobe.carcassHeight;
  const constructYmm = constructionShelfY(wardrobe.height, carcassHeight);
  const constructYpx = constructYmm * scale;
  const constructHpx = CONSTRUCTION_SHELF_HEIGHT_MM * scale;
  const mainTopPx = isMedia ? 0 : constructYpx + constructHpx;
  const zoneTopMm = isMedia ? 0 : mainZoneTop(wardrobe.height, carcassHeight);
  const dimColor = DIM_LINE_COLOR;
  const sortedBays = useMemo(
    () => [...bays].sort((a, b) => a.index - b.index),
    [bays],
  );

  const nicheGeom = useMemo(() => {
    if (!isMedia || !tvNiche) return null;
    const start = Math.max(0, tvNiche.startBayIndex);
    const end = Math.min(
      sortedBays.length - 1,
      tvNiche.startBayIndex + tvNiche.bayCount - 1,
    );
    if (start > end || sortedBays.length === 0) return null;
    const xMm = getBayOriginX(sortedBays, start);
    const widthMm = sortedBays
      .slice(start, end + 1)
      .reduce((sum, bay) => sum + bay.width, 0);
    const assembly = tvNicheAssembly(tvNiche, wardrobe.height, kickerMm);
    return { xMm, widthMm, start, end, ...assembly };
  }, [isMedia, kickerMm, sortedBays, tvNiche, wardrobe.height]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: showScene ? backdrop.wallBottom : "#ffffff" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          clearCanvasHighlight();
        }
      }}
      onTouchStart={(event) => {
        if (event.target === event.currentTarget) {
          clearCanvasHighlight();
        }
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        className="wardrobe-stage"
      >
        <Layer imageSmoothingEnabled={false}>
          {/* Backdrop — tap outside the carcass to hide selection tint.
              Screen: soft studio wall. PDF: plain white page. */}
          <Rect
            x={0}
            y={0}
            width={stageWidth}
            height={stageHeight}
            fill={showScene ? undefined : "#ffffff"}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: stageHeight }}
            fillLinearGradientColorStops={
              showScene
                ? [0, backdrop.wallTop, 1, backdrop.wallBottom]
                : undefined
            }
            onMouseDown={() => clearCanvasHighlight()}
            onTap={() => clearCanvasHighlight()}
          />

          {showScene && (
            <Group listening={false}>
              {/* Floor line where the unit stands */}
              {(() => {
                const floorY = originY + outerHeight;
                const floorH = Math.max(0, stageHeight - floorY);
                if (floorH <= 0) return null;
                return (
                  <>
                    <Rect
                      x={0}
                      y={floorY}
                      width={stageWidth}
                      height={floorH}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: 0, y: floorH }}
                      fillLinearGradientColorStops={[
                        0,
                        backdrop.floorTop,
                        1,
                        backdrop.floorBottom,
                      ]}
                    />
                    <Rect
                      x={0}
                      y={floorY}
                      width={stageWidth}
                      height={1}
                      fill="rgba(0,0,0,0.12)"
                    />
                  </>
                );
              })()}
              {/* Soft ambient shadow so the unit sits in the room */}
              <Rect
                x={originX + 2}
                y={originY + 6}
                width={outerWidth - 4}
                height={outerHeight - 4}
                fill="rgba(0,0,0,0.001)"
                shadowColor="rgba(16, 18, 22, 0.5)"
                shadowBlur={34}
                shadowOffsetY={14}
                shadowOpacity={1}
              />
              <Rect
                x={originX - 6}
                y={originY + outerHeight - 2}
                width={outerWidth + 12}
                height={8}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: 0, y: 8 }}
                fillLinearGradientColorStops={[
                  0,
                  "rgba(0,0,0,0.32)",
                  1,
                  "rgba(0,0,0,0)",
                ]}
              />
            </Group>
          )}

          <Group x={originX} y={originY}>
            {doubleOuterSides ? (
              <>
                {/*
                  Corpus frame (all boards 18 mm):
                  — Outer sides: 2 uprights (double wall)
                  — Top + bottom: double-line 18 mm rail each
                  — Inside bay uprights: single (wardrobe) / double (media)
                  — Outer face only wraps white past the kicker
                */}
                {(() => {
                  // Two uprights around the wardrobe
                  const side = corpusMetrics(scale, 2);
                  const rail = corpusMetrics(scale, 1);
                  const leftCenter = sidePx / 2;
                  const rightCenter = outerWidth - sidePx / 2;
                  const leftX = leftCenter - side.total / 2;
                  const rightX = rightCenter - side.total / 2;
                  const faceX = leftX + side.total;
                  const faceW = Math.max(0, rightX - faceX);
                  const frameX = leftX;
                  const frameW = Math.max(0, rightX + side.total - leftX);
                  const kickerX = leftX + side.stroke;
                  const kickerW = Math.max(
                    0,
                    rightX + side.total - side.stroke - kickerX,
                  );
                  const railH = rail.board;
                  return (
                    <Group listening={false}>
                      <Rect
                        x={faceX}
                        y={0}
                        width={faceW}
                        height={carcassOuterHeight}
                        fill={interiorFill}
                      />
                      {/* Ambient occlusion in the inside corners */}
                      <Rect
                        x={faceX}
                        y={0}
                        width={Math.min(28, faceW * 0.08)}
                        height={carcassOuterHeight}
                        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                        fillLinearGradientEndPoint={{
                          x: Math.min(28, faceW * 0.08),
                          y: 0,
                        }}
                        fillLinearGradientColorStops={[
                          0,
                          "rgba(0,0,0,0.09)",
                          1,
                          "rgba(0,0,0,0)",
                        ]}
                      />
                      <Rect
                        x={faceX + faceW - Math.min(28, faceW * 0.08)}
                        y={0}
                        width={Math.min(28, faceW * 0.08)}
                        height={carcassOuterHeight}
                        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                        fillLinearGradientEndPoint={{
                          x: Math.min(28, faceW * 0.08),
                          y: 0,
                        }}
                        fillLinearGradientColorStops={[
                          0,
                          "rgba(0,0,0,0)",
                          1,
                          "rgba(0,0,0,0.07)",
                        ]}
                      />
                      <CorpusRail
                        x={frameX}
                        y={0}
                        width={frameW}
                        scale={scale}
                        gapFill={boardPaint}
                        shadowBelow
                      />
                      <CorpusRail
                        x={frameX}
                        y={carcassOuterHeight - railH}
                        width={frameW}
                        scale={scale}
                        gapFill={boardPaint}
                      />
                      {/* Outer L/R — 2 uprights; outer face to the end, inner shorter by 18 mm */}
                      <CarcassUpright
                        centerX={leftCenter}
                        y={0}
                        height={carcassOuterHeight}
                        gapFill={boardPaint}
                        scale={scale}
                        doubleWall
                        edge="left"
                        endInsetMm={CORPUS_MM}
                      />
                      <CarcassUpright
                        centerX={rightCenter}
                        y={0}
                        height={carcassOuterHeight}
                        gapFill={boardPaint}
                        scale={scale}
                        doubleWall
                        edge="right"
                        endInsetMm={CORPUS_MM}
                      />
                      {kickerPx > 0 && (
                        <>
                          <Rect
                            x={kickerX}
                            y={carcassOuterHeight}
                            width={kickerW}
                            height={kickerPx}
                            fill={kickerFill}
                          />
                          <Rect
                            x={kickerX}
                            y={carcassOuterHeight}
                            width={kickerW}
                            height={Math.max(2, 3 * scale)}
                            fill="rgba(255,255,255,0.08)"
                          />
                          <Text
                            x={0}
                            y={carcassOuterHeight + kickerPx / 2 - 7}
                            width={outerWidth}
                            align="center"
                            text={`${kickerMm} kicker`}
                            fontSize={11}
                            fill="#1a1a1a"
                            fontStyle="bold"
                          />
                          <OuterSideKickerWrap
                            side="left"
                            centerX={leftCenter}
                            y={carcassOuterHeight}
                            height={kickerPx}
                            scale={scale}
                            panelFill={interiorFill}
                            doubleWall
                          />
                          <OuterSideKickerWrap
                            side="right"
                            centerX={rightCenter}
                            y={carcassOuterHeight}
                            height={kickerPx}
                            scale={scale}
                            panelFill={interiorFill}
                            doubleWall
                          />
                        </>
                      )}
                    </Group>
                  );
                })()}
              </>
            ) : (
              <>
                {/* Single-board carcass shell */}
                <Rect
                  x={0}
                  y={0}
                  width={outerWidth}
                  height={carcassOuterHeight}
                  fill={boardPaint}
                  stroke={EDGE_COLOR}
                  strokeWidth={1}
                />
                {/* Optional 100 mm kicker / plinth */}
                {kickerPx > 0 && (
                  <Group listening={false}>
                    <Rect
                      x={boardPx * 0.35}
                      y={carcassOuterHeight}
                      width={outerWidth - boardPx * 0.7}
                      height={kickerPx}
                      fill={kickerFill}
                    />
                    <Rect
                      x={boardPx * 0.35}
                      y={carcassOuterHeight}
                      width={outerWidth - boardPx * 0.7}
                      height={Math.max(2, 3 * scale)}
                      fill="rgba(255,255,255,0.08)"
                    />
                    <Text
                      x={0}
                      y={carcassOuterHeight + kickerPx / 2 - 7}
                      width={outerWidth}
                      align="center"
                      text={`${kickerMm} kicker`}
                      fontSize={11}
                      fill="#1a1a1a"
                      fontStyle="bold"
                    />
                  </Group>
                )}
              </>
            )}

            {/* Interior — starts under the top rail so uprights meet top & bottom */}
            <Group x={sidePx} y={railPx}>
              {/* Skip face fill when outer frame already painted it (avoids a second top edge) */}
              {!doubleOuterSides && (
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={innerWidth}
                    height={innerHeight}
                    fill={interiorFill}
                  />
                  <BoardShadowBelow
                    x={0}
                    y={0}
                    width={innerWidth}
                    scale={scale}
                  />
                </>
              )}

              {sortedBays.map((bay, index) => {
                const bayX = getBayOriginX(sortedBays, index) * scale;
                const bayWidthPx = bay.width * scale;
                const inTvSpan = Boolean(
                  nicheGeom && bayInTvNiche(bay.index, tvNiche),
                );
                const mergeAbove = tvNicheMergesColumns(tvNiche, "above");
                const mergeBelow = tvNicheMergesColumns(tvNiche, "below");
                const mergesBoth = mergeAbove && mergeBelow;
                const isTvPrimary =
                  Boolean(nicheGeom) && index === nicheGeom?.start;
                const needsFullSpan =
                  inTvSpan && isTvPrimary && (mergeAbove || mergeBelow);
                const drawWidthMm =
                  needsFullSpan && nicheGeom ? nicheGeom.widthMm : bay.width;
                const drawWidthPx = drawWidthMm * scale;
                const primaryId = tvNichePrimaryBayId(sortedBays, tvNiche);
                const bayIsSelected =
                  canvasHighlight && bay.id === selectedBayId;
                const bayModules = modules.filter((mod) => {
                  if (mod.bayId !== bay.id) return false;
                  if (!inTvSpan || !nicheGeom) return true;
                  if (isTvPrimary) return true;
                  const mid = mod.y + mod.height / 2;
                  if (mid <= nicheGeom.aboveBay.end) return !mergeAbove;
                  if (mid >= nicheGeom.belowBay.start) return !mergeBelow;
                  return false;
                });

                const aboveSelected =
                  bayIsSelected && inTvSpan && tvActiveZone === "above";
                const belowSelected =
                  bayIsSelected && inTvSpan && tvActiveZone === "below";
                const fullSelected = bayIsSelected && !inTvSpan;

                const showAboveHit =
                  inTvSpan && nicheGeom && (isTvPrimary || !mergeAbove);
                const showBelowHit =
                  inTvSpan && nicheGeom && (isTvPrimary || !mergeBelow);
                const showBayLabel =
                  !inTvSpan || isTvPrimary || !mergesBoth;

                const hitSelect = (zone?: "above" | "below") => {
                  if (inTvSpan && zone) {
                    const merges = zone === "above" ? mergeAbove : mergeBelow;
                    if (merges && primaryId) {
                      selectBay(primaryId, zone);
                      return;
                    }
                  }
                  selectBay(bay.id, zone);
                };

                return (
                  <Group
                    key={bay.id}
                    x={bayX}
                    y={0}
                    clipX={0}
                    clipY={0}
                    clipWidth={needsFullSpan ? drawWidthPx : bayWidthPx}
                    clipHeight={innerHeight}
                  >
                    {/* Upright to the left throws a little shade into this bay */}
                    {index > 0 && (
                      <Rect
                        x={0}
                        y={0}
                        width={Math.min(14, bayWidthPx * 0.12)}
                        height={innerHeight}
                        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                        fillLinearGradientEndPoint={{
                          x: Math.min(14, bayWidthPx * 0.12),
                          y: 0,
                        }}
                        fillLinearGradientColorStops={[
                          0,
                          "rgba(0,0,0,0.07)",
                          1,
                          "rgba(0,0,0,0)",
                        ]}
                        listening={false}
                      />
                    )}

                    {/* Outer / full-height bays */}
                    {!inTvSpan && (
                      <Rect
                        x={0}
                        y={0}
                        width={bayWidthPx}
                        height={innerHeight}
                        fill={
                          fullSelected
                            ? "rgba(141, 107, 69, 0.1)"
                            : "transparent"
                        }
                        onClick={() => hitSelect()}
                        onTap={() => hitSelect()}
                      />
                    )}

                    {/* TV columns: above and below are separate clickable units */}
                    {showAboveHit && nicheGeom && (
                      <Rect
                        x={0}
                        y={nicheGeom.aboveBay.start * scale}
                        width={
                          mergeAbove && isTvPrimary ? drawWidthPx : bayWidthPx
                        }
                        height={Math.max(
                          4,
                          (nicheGeom.aboveBay.end - nicheGeom.aboveBay.start) *
                            scale,
                        )}
                        fill={
                          aboveSelected
                            ? "rgba(141, 107, 69, 0.14)"
                            : "transparent"
                        }
                        onClick={() => hitSelect("above")}
                        onTap={() => hitSelect("above")}
                      />
                    )}
                    {showBelowHit && nicheGeom && (
                      <Rect
                        x={0}
                        y={nicheGeom.belowBay.start * scale}
                        width={
                          mergeBelow && isTvPrimary ? drawWidthPx : bayWidthPx
                        }
                        height={Math.max(
                          4,
                          (nicheGeom.belowBay.end - nicheGeom.belowBay.start) *
                            scale,
                        )}
                        fill={
                          belowSelected
                            ? "rgba(141, 107, 69, 0.14)"
                            : "transparent"
                        }
                        onClick={() => hitSelect("below")}
                        onTap={() => hitSelect("below")}
                      />
                    )}

                    {/* Wardrobe interior uprights drawn in a later pass (single) */}

                    {/* Labels: outer columns = Bay N; TV span = one “TV” box */}
                    {showBayLabel && (
                      <Text
                        x={0}
                        y={Math.max(3, 5 * scale)}
                        width={
                          mergesBoth && isTvPrimary && nicheGeom
                            ? nicheGeom.widthMm * scale
                            : bayWidthPx
                        }
                        align="center"
                        text={
                          inTvSpan && isTvPrimary
                            ? "TV"
                            : `Bay ${index + 1}`
                        }
                        fontSize={13}
                        fill={bayIsSelected ? "#3f4a58" : "#9aa0a8"}
                        fontStyle="bold"
                        listening={false}
                      />
                    )}

                    {bayModules.map((mod) => {
                      const isTvFrameBoard =
                        inTvSpan &&
                        nicheGeom &&
                        (Math.abs(mod.y - nicheGeom.topBoard.y) < 0.5 ||
                          Math.abs(mod.y - nicheGeom.bottomBoard.y) < 0.5);
                      if (isTvFrameBoard) return null;

                      let moduleWidthPx = bayWidthPx;
                      if (inTvSpan && nicheGeom) {
                        const mid = mod.y + mod.height / 2;
                        const spanWide =
                          mid <= nicheGeom.aboveBay.end
                            ? mergeAbove
                            : mid >= nicheGeom.belowBay.start
                              ? mergeBelow
                              : false;
                        if (spanWide) {
                          moduleWidthPx = nicheGeom.widthMm * scale;
                        }
                      }

                      return (
                        <ModuleShape
                          key={mod.id}
                          mod={mod}
                          bayWidthPx={moduleWidthPx}
                          scale={scale}
                          wardrobeHeight={wardrobe.height}
                          selected={
                            canvasHighlight && mod.id === selectedModuleId
                          }
                          onSelect={selectModule}
                          onDragEnd={updateModuleY}
                          onAlignGuide={onAlignGuide}
                        />
                      );
                    })}

                  </Group>
                );
              })}

              {/*
                TV is its own separate box (not “Bay 3/4”):
                — Own L/R double-wall uprights, continuous floor→top
                — Own top / bottom 18 mm rails butting into those sides
              */}
              {nicheGeom && (
                <Group listening={false}>
                  {(() => {
                    // TV box: continuous L/R double-walls with housed top/bottom rails
                    // (same join as wardrobe top — not a butt at the inner face).
                    const side = corpusMetrics(scale, 2);
                    const rail = corpusMetrics(scale, 1);
                    const leftCenter = nicheGeom.xMm * scale;
                    const rightCenter =
                      (nicheGeom.xMm + nicheGeom.widthMm) * scale;
                    // Rail runs to the OUTER faces of both uprights
                    const railX = leftCenter - side.total / 2;
                    const railW = Math.max(
                      0,
                      rightCenter + side.total / 2 - railX,
                    );
                    const topY = nicheGeom.topBoard.y * scale;
                    const botY = nicheGeom.bottomBoard.y * scale;
                    const openY = topY + rail.board;
                    const openH = Math.max(0, botY - openY);
                    const openX = leftCenter + side.total / 2;
                    const openW = Math.max(
                      0,
                      rightCenter - side.total / 2 - openX,
                    );
                    const panelFill = boardPaint;
                    const railBreaks = [
                      { y: topY, height: rail.board },
                      { y: botY, height: rail.board },
                    ];
                    const leftOuterX = leftCenter - side.total / 2;
                    const rightOuterX = rightCenter + side.total / 2 - side.stroke;
                    const bezelMm = Math.max(0, tvNiche?.bezelMm ?? 0);
                    const bezelPx = bezelMm * scale;
                    const screenX = openX + bezelPx;
                    const screenY = openY + bezelPx;
                    const screenW = Math.max(0, openW - bezelPx * 2);
                    const screenH = Math.max(0, openH - bezelPx * 2);
                    const showBezel = bezelPx >= 1 && screenW > 2 && screenH > 2;
                    return (
                      <Group>
                        {showBezel ? (
                          <>
                            <Rect
                              x={openX}
                              y={openY}
                              width={openW}
                              height={openH}
                              fill="#1a1d22"
                            />
                            <Rect
                              x={screenX}
                              y={screenY}
                              width={screenW}
                              height={screenH}
                              fill="#c5d0da"
                            />
                            <Rect
                              x={screenX}
                              y={screenY}
                              width={screenW}
                              height={Math.min(18, screenH * 0.16)}
                              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                              fillLinearGradientEndPoint={{
                                x: 0,
                                y: Math.min(18, screenH * 0.16),
                              }}
                              fillLinearGradientColorStops={[
                                0, "rgba(70, 82, 96, 0.28)",
                                1, "rgba(70, 82, 96, 0)",
                              ]}
                            />
                            <Rect
                              x={screenX}
                              y={screenY}
                              width={screenW}
                              height={Math.min(6, screenH * 0.06)}
                              fill="rgba(255, 255, 255, 0.16)"
                            />
                          </>
                        ) : (
                          <>
                            <Rect
                              x={openX}
                              y={openY}
                              width={openW}
                              height={openH}
                              fill="#c5d0da"
                            />
                            <Rect
                              x={openX}
                              y={openY}
                              width={openW}
                              height={Math.min(22, openH * 0.18)}
                              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                              fillLinearGradientEndPoint={{
                                x: 0,
                                y: Math.min(22, openH * 0.18),
                              }}
                              fillLinearGradientColorStops={[
                                0, "rgba(70, 82, 96, 0.28)",
                                1, "rgba(70, 82, 96, 0)",
                              ]}
                            />
                            <Rect
                              x={openX}
                              y={openY}
                              width={Math.min(18, openW * 0.12)}
                              height={openH}
                              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                              fillLinearGradientEndPoint={{
                                x: Math.min(18, openW * 0.12),
                                y: 0,
                              }}
                              fillLinearGradientColorStops={[
                                0, "rgba(70, 82, 96, 0.22)",
                                1, "rgba(70, 82, 96, 0)",
                              ]}
                            />
                            <Rect
                              x={openX}
                              y={openY + openH - Math.min(16, openH * 0.12)}
                              width={openW}
                              height={Math.min(16, openH * 0.12)}
                              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                              fillLinearGradientEndPoint={{
                                x: 0,
                                y: Math.min(16, openH * 0.12),
                              }}
                              fillLinearGradientColorStops={[
                                0, "rgba(70, 82, 96, 0)",
                                1, "rgba(40, 48, 58, 0.16)",
                              ]}
                            />
                            <Rect
                              x={openX}
                              y={openY}
                              width={openW}
                              height={Math.min(8, openH * 0.06)}
                              fill="rgba(255, 255, 255, 0.18)"
                            />
                          </>
                        )}
                        {/* Uprights with pockets at the rails */}
                        <CarcassUpright
                          centerX={leftCenter}
                          y={0}
                          height={innerHeight}
                          gapFill={panelFill}
                          scale={scale}
                          doubleWall
                          edge="left"
                          innerBreaks={railBreaks}
                        />
                        <CarcassUpright
                          centerX={rightCenter}
                          y={0}
                          height={innerHeight}
                          gapFill={panelFill}
                          scale={scale}
                          doubleWall
                          edge="right"
                          innerBreaks={railBreaks}
                        />
                        {/* Rails through the pockets (past inner + middle faces) */}
                        <CorpusRail
                          x={railX}
                          y={topY}
                          width={railW}
                          scale={scale}
                          gapFill={panelFill}
                          shadowBelow
                        />
                        <CorpusRail
                          x={railX}
                          y={botY}
                          width={railW}
                          scale={scale}
                          gapFill={panelFill}
                        />
                        {/* Outer faces again — continuous through the rail ends */}
                        <Rect
                          x={leftOuterX}
                          y={0}
                          width={side.stroke}
                          height={innerHeight}
                          fill={EDGE_COLOR}
                        />
                        <Rect
                          x={rightOuterX}
                          y={0}
                          width={side.stroke}
                          height={innerHeight}
                          fill={EDGE_COLOR}
                        />
                      </Group>
                    );
                  })()}

                  {/* Internal width dimension */}
                  {(() => {
                    const side = corpusMetrics(scale, 2);
                    const x = nicheGeom.xMm * scale + side.total / 2;
                    const w = Math.max(
                      0,
                      nicheGeom.widthMm * scale - side.total,
                    );
                    const y =
                      nicheGeom.opening.y * scale +
                      nicheGeom.opening.height * scale * 0.28;
                    return (
                      <Group>
                        <Line
                          points={[x + 8, y, x + w - 8, y]}
                          stroke="#111827"
                          strokeWidth={1.25}
                        />
                        <Line
                          points={[x + 8, y - 5, x + 8, y + 5]}
                          stroke="#111827"
                          strokeWidth={1.25}
                        />
                        <Line
                          points={[x + w - 8, y - 5, x + w - 8, y + 5]}
                          stroke="#111827"
                          strokeWidth={1.25}
                        />
                        <Text
                          x={x}
                          y={y - 18}
                          width={w}
                          align="center"
                          text={`${Math.round(nicheGeom.widthMm)} mm`}
                          fontSize={12}
                          fill="#111827"
                          fontStyle="bold"
                        />
                      </Group>
                    );
                  })()}

                  {/* Internal height dimension */}
                  {(() => {
                    const side = corpusMetrics(scale, 2);
                    const rail = corpusMetrics(scale, 1);
                    const x =
                      nicheGeom.xMm * scale +
                      side.total / 2 +
                      Math.max(0, nicheGeom.widthMm * scale - side.total) *
                        0.18;
                    const y1 =
                      nicheGeom.topBoard.y * scale + rail.board + 8;
                    const y2 = nicheGeom.bottomBoard.y * scale - 8;
                    const mid = (y1 + y2) / 2;
                    return (
                      <Group>
                        <Line
                          points={[x, y1, x, y2]}
                          stroke="#111827"
                          strokeWidth={1.25}
                        />
                        <Line
                          points={[x - 5, y1, x + 5, y1]}
                          stroke="#111827"
                          strokeWidth={1.25}
                        />
                        <Line
                          points={[x - 5, y2, x + 5, y2]}
                          stroke="#111827"
                          strokeWidth={1.25}
                        />
                        <Text
                          x={x + 8}
                          y={mid - 8}
                          text={`${Math.round(nicheGeom.opening.height)} mm`}
                          fontSize={12}
                          fill="#111827"
                          fontStyle="bold"
                        />
                      </Group>
                    );
                  })()}

                  <Text
                    x={nicheGeom.xMm * scale}
                    y={
                      nicheGeom.opening.y * scale +
                      nicheGeom.opening.height * scale * 0.62
                    }
                    width={nicheGeom.widthMm * scale}
                    align="center"
                    text="TV"
                    fontSize={15}
                    fill="#111827"
                    fontStyle="bold"
                  />
                </Group>
              )}

              {/*
                Interior uprights:
                — Media: double wall at bay joins (when enabled)
                — Wardrobe: single upright (one 18 mm board = 2 lines)
              */}
              {isMedia ? (
                <Group listening={false}>
                  {sortedBays.map((bay, index) => {
                    if (index === 0) return null;
                    const prev = sortedBays[index - 1];
                    const prevInTv = Boolean(
                      tvNiche && bayInTvNiche(prev.index, tvNiche),
                    );
                    const thisInTv = Boolean(
                      tvNiche && bayInTvNiche(bay.index, tvNiche),
                    );
                    const x = getBayOriginX(sortedBays, index) * scale;
                    const doubleWall = tvNiche?.doubleWallUprights !== false;

                    // Inside TV span — zone uprights drawn separately below
                    if (prevInTv && thisInTv) return null;

                    // TV left/right edges — drawn on the niche group
                    if (nicheGeom && prevInTv !== thisInTv) return null;

                    return (
                      <CarcassUpright
                        key={`upright-${bay.id}`}
                        centerX={x}
                        y={0}
                        height={innerHeight}
                        gapFill={boardPaint}
                        scale={scale}
                        doubleWall={doubleWall}
                      />
                    );
                  })}

                  {nicheGeom &&
                    tvNiche &&
                    Array.from(
                      {
                        length: Math.max(
                          0,
                          (tvNiche.aboveColumnCount ?? 1) - 1,
                        ),
                      },
                      (_, i) => {
                        const cols = tvNiche.aboveColumnCount;
                        const x =
                          nicheGeom.xMm * scale +
                          (nicheGeom.widthMm * scale * (i + 1)) / cols;
                        const topH = Math.max(0, nicheGeom.topBoard.y * scale);
                        return (
                          <CarcassUpright
                            key={`tv-above-upright-${i}`}
                            centerX={x}
                            y={0}
                            height={topH}
                            gapFill={boardPaint}
                            scale={scale}
                            doubleWall={tvNiche.doubleWallUprights !== false}
                          />
                        );
                      },
                    )}

                  {nicheGeom &&
                    tvNiche &&
                    Array.from(
                      {
                        length: Math.max(
                          0,
                          (tvNiche.belowColumnCount ?? 1) - 1,
                        ),
                      },
                      (_, i) => {
                        const cols = tvNiche.belowColumnCount;
                        const x =
                          nicheGeom.xMm * scale +
                          (nicheGeom.widthMm * scale * (i + 1)) / cols;
                        const belowY = nicheGeom.blocked.end * scale;
                        const belowH = Math.max(0, innerHeight - belowY);
                        return (
                          <CarcassUpright
                            key={`tv-below-upright-${i}`}
                            centerX={x}
                            y={belowY}
                            height={belowH}
                            gapFill={boardPaint}
                            scale={scale}
                            doubleWall={tvNiche.doubleWallUprights !== false}
                          />
                        );
                      },
                    )}
                </Group>
              ) : (
                <Group listening={false}>
                  {sortedBays.map((bay, index) => {
                    if (index === 0) return null;
                    const x = getBayOriginX(sortedBays, index) * scale;
                    // Main carcass only — top storage is one open box (no uprights)
                    const uprightH = Math.max(0, innerHeight - mainTopPx);
                    if (uprightH < 2) return null;
                    return (
                      <CarcassUpright
                        key={`wr-upright-${bay.id}`}
                        centerX={x}
                        y={mainTopPx}
                        height={uprightH}
                        gapFill={boardPaint}
                        scale={scale}
                        doubleWall={false}
                      />
                    );
                  })}
                </Group>
              )}

              {/* Gap dims drawn after uprights so dotted lines aren’t covered */}
              <Group listening={false}>
                {sortedBays.map((bay, index) => {
                  const bayX = getBayOriginX(sortedBays, bay.index) * scale;
                  const bayWidthPx = bay.width * scale;
                  const bayModules = modules.filter(
                    (mod) => mod.bayId === bay.id,
                  );
                  const inTvSpan = Boolean(
                    nicheGeom && bayInTvNiche(bay.index, tvNiche),
                  );
                  const mergeAbove = tvNicheMergesColumns(tvNiche, "above");
                  const mergeBelow = tvNicheMergesColumns(tvNiche, "below");
                  const mergesBoth = mergeAbove && mergeBelow;
                  const isTvPrimary =
                    Boolean(nicheGeom) && index === nicheGeom?.start;
                  const needsFullSpan =
                    inTvSpan && isTvPrimary && (mergeAbove || mergeBelow);
                  const drawWidthPx =
                    needsFullSpan && nicheGeom
                      ? nicheGeom.widthMm * scale
                      : bayWidthPx;
                  const showMeasurements =
                    !inTvSpan || isTvPrimary || !mergesBoth;
                  if (!showMeasurements) return null;

                  const bayIsSelected =
                    canvasHighlight && bay.id === selectedBayId;
                  const aboveSelected =
                    bayIsSelected && inTvSpan && tvActiveZone === "above";
                  const belowSelected =
                    bayIsSelected && inTvSpan && tvActiveZone === "below";
                  const fullSelected = bayIsSelected && !inTvSpan;

                  return (
                    <Group key={`gaps-${bay.id}`} x={bayX} listening={false}>
                      <BayMeasurements
                        modules={bayModules.filter((mod) => {
                          if (!inTvSpan || !nicheGeom) return true;
                          const mid = mod.y + mod.height / 2;
                          return (
                            mid <=
                              nicheGeom.topBoard.y +
                                nicheGeom.topBoard.height ||
                            mid >= nicheGeom.bottomBoard.y
                          );
                        })}
                        zoneTopMm={zoneTopMm}
                        wardrobeHeight={wardrobe.height}
                        bayWidthPx={drawWidthPx}
                        scale={scale}
                        accent={
                          inTvSpan
                            ? aboveSelected || belowSelected
                            : fullSelected
                        }
                        allowZonesPx={
                          inTvSpan && nicheGeom
                            ? [
                                {
                                  start: nicheGeom.aboveBay.start * scale,
                                  end: nicheGeom.aboveBay.end * scale,
                                },
                                {
                                  start: nicheGeom.belowBay.start * scale,
                                  end: nicheGeom.belowBay.end * scale,
                                },
                              ]
                            : !isMedia
                              ? [
                                  ...(index === 0
                                    ? [{ start: 0, end: constructYpx }]
                                    : []),
                                  {
                                    start: constructYpx + constructHpx,
                                    end: innerHeight,
                                  },
                                ]
                              : undefined
                        }
                        fontScale={labelScale}
                      />
                    </Group>
                  );
                })}
              </Group>

              {/* Shelf alignment grid from left-side bays while dragging */}
              {alignGuide && alignGuide.linesMm.length > 0 && (
                <Group listening={false}>
                  {alignGuide.linesMm.map((yMm) => {
                    const active = alignGuide.activeY === yMm;
                    const y = yMm * scale;
                    return (
                      <Line
                        key={`align-guide-${yMm}`}
                        points={[0, y, innerWidth, y]}
                        stroke={active ? "#0f766e" : "rgba(15, 118, 110, 0.35)"}
                        strokeWidth={active ? 2 : 1}
                        dash={active ? undefined : [6, 5]}
                      />
                    );
                  })}
                  {alignGuide.activeY != null && (
                    <Text
                      x={8}
                      y={alignGuide.activeY * scale - 16}
                      text="Align"
                      fontSize={11}
                      fill="#0f766e"
                      fontStyle="bold"
                    />
                  )}
                </Group>
              )}

              {/* Construction / top-bay shelf — wardrobe mode only */}
              {!isMedia && (
              <Group
                id="construct-board"
                x={0}
                y={constructYpx}
                draggable
                dragBoundFunc={(pos) => {
                  const absX = originX + sidePx;
                  const absOriginY = originY + railPx;
                  const localY = pos.y - absOriginY;
                  const rawCarcass = wardrobe.height - localY / scale;
                  const snappedCarcass =
                    Math.round(rawCarcass / CARCASS_SNAP_MM) * CARCASS_SNAP_MM;
                  const clampedCarcass = Math.max(
                    MIN_CARCASS_HEIGHT_MM,
                    Math.min(
                      wardrobe.height - MIN_TOP_BOX_MM,
                      snappedCarcass,
                    ),
                  );
                  const snappedLocal =
                    constructionShelfY(wardrobe.height, clampedCarcass) *
                    scale;
                  return {
                    x: absX,
                    y: absOriginY + snappedLocal,
                  };
                }}
                onMouseEnter={(event) => {
                  const stage = event.target.getStage();
                  if (stage) stage.container().style.cursor = "ns-resize";
                }}
                onMouseLeave={(event) => {
                  if (constructDragRef.current) return;
                  const stage = event.target.getStage();
                  if (stage) stage.container().style.cursor = "default";
                }}
                onTouchStart={(event) => {
                  constructDragRef.current = true;
                  event.evt.preventDefault();
                }}
                onDragStart={(event) => {
                  constructDragRef.current = true;
                  event.evt.preventDefault();
                  event.currentTarget.x(0);
                }}
                onDragMove={(event) => {
                  event.evt.preventDefault();
                  event.currentTarget.x(0);
                }}
                onDragEnd={(event) => {
                  const node = event.currentTarget;
                  node.x(0);
                  const yMm = node.y() / scale;
                  const nextCarcass =
                    Math.round(
                      (wardrobe.height - yMm) / CARCASS_SNAP_MM,
                    ) * CARCASS_SNAP_MM;
                  setCarcassHeight(nextCarcass);
                  const resolved = useWardrobeStore.getState().wardrobe;
                  node.y(
                    constructionShelfY(
                      resolved.height,
                      resolved.carcassHeight,
                    ) * scale,
                  );
                  node.x(0);
                  constructDragRef.current = false;
                  const stage = node.getStage();
                  if (stage) stage.container().style.cursor = "default";
                }}
              >
                <CorpusRail
                  x={0}
                  y={0}
                  width={innerWidth}
                  scale={scale}
                  gapFill={boardPaint}
                  shadowBelow
                />
                <Rect
                  x={0}
                  y={0}
                  width={innerWidth}
                  height={Math.max(constructHpx, corpusMetrics(scale, 1).board)}
                  fill="rgba(0,0,0,0.001)"
                  hitStrokeWidth={28}
                />
              </Group>
              )}

              {!isMedia &&
                !pdfExporting &&
                materials.doorSystem !== "none" &&
                materials.doorsVisible && (
                <Group
                  listening={false}
                  clipX={0}
                  clipY={0}
                  clipWidth={innerWidth}
                  clipHeight={innerHeight}
                >
                  {(() => {
                    // Doors fit current wardrobe size — never resize the unit
                    const plan = planDoorPanels({
                      system: materials.doorSystem as "sliding" | "hinged",
                      wardrobeWidth: wardrobe.width,
                      wardrobeHeight: wardrobe.height,
                      carcassHeight: wardrobe.carcassHeight,
                      slidingDoorHeightMm: materials.slidingDoorHeightMm,
                      slidingWidthMode: materials.slidingWidthMode,
                      slidingFace: materials.slidingFace,
                      slidingLeafCount: materials.slidingLeafCount,
                      slidingDoorFaces: materials.slidingDoorFaces,
                    });
                    const isSliding = plan.system === "sliding";
                    const doorTop = 0;
                    const doorH = Math.max(4, innerHeight);
                    const panels = plan.count;
                    const leafWidthsPx = plan.leafWidthsMm.map(
                      (widthMm) => widthMm * scale,
                    );
                    const doorXs = leafWidthsPx.reduce<number[]>(
                      (xs, widthPx) => {
                        xs.push((xs[xs.length - 1] ?? 0) + widthPx);
                        return xs;
                      },
                      [0],
                    );
                    const mirrorSide = materials.mirrorSide;
                    const doorFaceAt = (index: number) =>
                      plan.faces[index] ?? plan.face;

                    const isMirror = (index: number) => {
                      const leafFace = doorFaceAt(index);
                      if (isGlassSlidingFace(leafFace)) {
                        return leafFace === "mirror";
                      }
                      if (mirrorSide === "none") return false;
                      if (mirrorSide === "both") {
                        return index === 0 || index === panels - 1;
                      }
                      if (mirrorSide === "left") return index === 0;
                      return index === panels - 1;
                    };
                    const frameStroke = slidingFrameStroke(
                      materials.slidingFrameColour,
                    );

                    const drawHandle = (
                      x: number,
                      doorTopY: number,
                      w: number,
                      h: number,
                      onRight: boolean,
                    ) => {
                      const handleH = Math.min(h * 0.28, 120 * scale);
                      const handleW = Math.max(7, Math.min(12, w * 0.045));
                      const inset = Math.max(14, w * 0.08);
                      const hx = onRight
                        ? x + w - inset - handleW
                        : x + inset;
                      const hy = doorTopY + (h - handleH) / 2;
                      const metal = "#5c6570";
                      const metalDark = "#2e343c";
                      const metalLite = "#9aa3ad";
                      return (
                        <Group listening={false}>
                          <Rect
                            x={hx - 3}
                            y={hy - 6}
                            width={handleW + 6}
                            height={handleH + 12}
                            fill="rgba(23, 26, 31, 0.06)"
                            cornerRadius={4}
                          />
                          <Rect
                            x={hx + 1.5}
                            y={hy + 2}
                            width={handleW}
                            height={handleH}
                            fill="rgba(0,0,0,0.22)"
                            cornerRadius={handleW / 2}
                          />
                          <Rect
                            x={hx}
                            y={hy}
                            width={handleW}
                            height={handleH}
                            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                            fillLinearGradientEndPoint={{ x: handleW, y: 0 }}
                            fillLinearGradientColorStops={[
                              0,
                              metalLite,
                              0.35,
                              metal,
                              1,
                              metalDark,
                            ]}
                            cornerRadius={handleW / 2}
                            stroke={metalDark}
                            strokeWidth={1}
                          />
                          <Rect
                            x={hx + 1.5}
                            y={hy + 8}
                            width={Math.max(2, handleW * 0.35)}
                            height={handleH - 16}
                            fill="rgba(255,255,255,0.35)"
                            cornerRadius={2}
                          />
                          <Circle
                            x={hx + handleW / 2}
                            y={hy + 5}
                            radius={Math.max(2, handleW * 0.28)}
                            fill={metalLite}
                          />
                          <Circle
                            x={hx + handleW / 2}
                            y={hy + handleH - 5}
                            radius={Math.max(2, handleW * 0.28)}
                            fill={metalDark}
                          />
                        </Group>
                      );
                    };

                    return (
                      <>
                        {Array.from({ length: panels }, (_, index) => {
                          const doorW = leafWidthsPx[index] ?? 0;
                          const x = doorXs[index] ?? 0;
                          const leafFace = doorFaceAt(index);
                          const mirrored = isMirror(index);
                          const shaker = doorHasShakerRebate(
                            leafFace,
                            materials.polyShakerRebate,
                            index,
                          );
                          const fill = mirrored
                            ? isSliding
                              ? slidingFaceFill("mirror")
                              : "#9ec4d8"
                            : leafFace === "poly"
                              ? slidingFaceFill("poly")
                              : isSliding
                                ? slidingFaceFill(leafFace)
                                : fasciaFill;
                          const stroke = isSliding
                            ? frameStroke
                            : "rgba(58, 62, 68, 0.6)";
                          const label = doorPanelLabel(
                            plan,
                            index,
                            mirrored,
                            shaker,
                          );
                          const titleLine = label.split("\n")[0];
                          // Open toward centre — never on outer left/right sides
                          const handleRight = hingedHandleOnRight(
                            index,
                            panels,
                          );

                          return (
                            <Group key={`door-${index}`}>
                              <Rect
                                x={x}
                                y={doorTop}
                                width={doorW}
                                height={doorH}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={isSliding ? 2 : 1}
                                shadowColor="rgba(0,0,0,0.18)"
                                shadowBlur={isSliding ? 6 : 0}
                                shadowOffsetX={isSliding ? 2 : 0}
                                shadowOpacity={0.35}
                              />
                              {/* Light falls from the top-left across the face */}
                              <Rect
                                x={x}
                                y={doorTop}
                                width={doorW}
                                height={doorH}
                                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                                fillLinearGradientEndPoint={{
                                  x: doorW,
                                  y: doorH,
                                }}
                                fillLinearGradientColorStops={[
                                  0,
                                  "rgba(255,255,255,0.22)",
                                  0.55,
                                  "rgba(255,255,255,0)",
                                  1,
                                  "rgba(0,0,0,0.06)",
                                ]}
                                listening={false}
                              />
                              {shaker && !mirrored ? (
                                <ShakerRebateVisual
                                  x={x}
                                  y={doorTop}
                                  width={doorW}
                                  height={doorH}
                                  scale={scale}
                                />
                              ) : (
                                <Rect
                                  x={x + 5}
                                  y={doorTop + 5}
                                  width={Math.max(4, doorW - 10)}
                                  height={Math.max(4, doorH - 10)}
                                  stroke={
                                    mirrored
                                      ? "rgba(40, 70, 95, 0.55)"
                                      : "rgba(23, 26, 31, 0.28)"
                                  }
                                  strokeWidth={1.5}
                                />
                              )}
                              {!isSliding &&
                                drawHandle(
                                  x,
                                  doorTop,
                                  doorW,
                                  doorH,
                                  handleRight,
                                )}
                              <Text
                                x={x + 6}
                                y={doorTop + doorH * 0.42}
                                width={Math.max(40, doorW - 12)}
                                align="center"
                                text={titleLine}
                                fontSize={Math.min(14, Math.max(10, doorW / 14))}
                                fill={
                                  mirrored
                                    ? "rgba(20, 45, 65, 0.95)"
                                    : "rgba(23, 26, 31, 0.9)"
                                }
                                fontStyle="bold"
                              />
                              {mirrored && (
                                <Line
                                  points={[
                                    x + 22,
                                    doorTop + 40,
                                    x + doorW - 22,
                                    doorTop + doorH - 36,
                                  ]}
                                  stroke="rgba(255, 255, 255, 0.65)"
                                  strokeWidth={2.5}
                                />
                              )}
                            </Group>
                          );
                        })}
                      </>
                    );
                  })()}
                </Group>
              )}
            </Group>

            {/* Bay widths — hidden when doors are on so they don’t look like door sizes */}
            {!(
              !isMedia &&
              !pdfExporting &&
              materials.doorSystem !== "none" &&
              materials.doorsVisible
            ) &&
              (() => {
              const splitTv =
                Boolean(tvNiche?.divideAbove) || Boolean(tvNiche?.divideBelow);
              const labels: {
                key: string;
                xMm: number;
                widthMm: number;
                text: string;
              }[] = [];
              let index = 0;
              while (index < sortedBays.length) {
                const bay = sortedBays[index];
                const inTv =
                  nicheGeom &&
                  index >= nicheGeom.start &&
                  index <= nicheGeom.end;
                if (inTv && nicheGeom && !splitTv && index === nicheGeom.start) {
                  labels.push({
                    key: `tv-w-${bay.id}`,
                    xMm: getBayOriginX(sortedBays, index),
                    widthMm: nicheGeom.widthMm,
                    text: `${Math.round(nicheGeom.widthMm)} mm`,
                  });
                  index = nicheGeom.end + 1;
                  continue;
                }
                if (inTv && !splitTv) {
                  index += 1;
                  continue;
                }
                labels.push({
                  key: `bay-w-${bay.id}`,
                  xMm: getBayOriginX(sortedBays, index),
                  widthMm: bay.width,
                  text: `${bay.width} mm`,
                });
                index += 1;
              }
              return labels.map((label) => {
                const bayX = sidePx + label.xMm * scale;
                const bayWidthPx = label.widthMm * scale;
                return (
                  <Group key={label.key} listening={false}>
                    <Line
                      points={[bayX, -12, bayX + bayWidthPx, -12]}
                      stroke={dimColor}
                      strokeWidth={1}
                    />
                    <Line
                      points={[bayX, -17, bayX, -7]}
                      stroke={dimColor}
                      strokeWidth={1}
                    />
                    <Line
                      points={[
                        bayX + bayWidthPx,
                        -17,
                        bayX + bayWidthPx,
                        -7,
                      ]}
                      stroke={dimColor}
                      strokeWidth={1}
                    />
                    <DimBadge
                      x={bayX + bayWidthPx / 2}
                      y={-31}
                      text={label.text}
                      fontSize={13 * labelScale}
                    />
                  </Group>
                );
              });
            })()}

            {/* Bottom — overall width (once) */}
            <Group listening={false}>
              <Line
                points={[0, outerHeight + 28, outerWidth, outerHeight + 28]}
                stroke={dimColor}
                strokeWidth={1}
              />
              <Line
                points={[0, outerHeight + 23, 0, outerHeight + 33]}
                stroke={dimColor}
                strokeWidth={1}
              />
              <Line
                points={[
                  outerWidth,
                  outerHeight + 23,
                  outerWidth,
                  outerHeight + 33,
                ]}
                stroke={dimColor}
                strokeWidth={1}
              />
              <DimBadge
                x={outerWidth / 2}
                y={outerHeight + 50}
                text={`${wardrobe.width} mm`}
                fontSize={14 * labelScale}
              />
            </Group>

            {/* Left — full unit height (carcass + optional kicker) */}
            <Line
              points={[-34, 0, -34, outerHeight]}
              stroke={dimColor}
              strokeWidth={1}
            />
            <Line points={[-39, 0, -29, 0]} stroke={dimColor} strokeWidth={1} />
            <Line
              points={[-39, outerHeight, -29, outerHeight]}
              stroke={dimColor}
              strokeWidth={1}
            />
            <DimBadge
              x={-42}
              y={outerHeight / 2}
              text={`${wardrobe.height + kickerMm} mm`}
              fontSize={13 * labelScale}
              anchor="right"
            />

            {/* Right — wardrobe: top box + carcass; media: carcass + kicker + TV from kicker */}
            {(() => {
              const rightX = outerWidth + 34;
              if (isMedia) {
                const carcassMid = carcassOuterHeight / 2;
                const kickerMid = carcassOuterHeight + kickerPx / 2;
                const fromKicker = tvNiche?.bottomFromKicker ?? 0;
                const tvFromKickerTopY =
                  fromKicker > 0 ? outerHeight - fromKicker * scale : null;
                return (
                  <Group listening={false}>
                    <Line
                      points={[rightX, 0, rightX, outerHeight]}
                      stroke={dimColor}
                      strokeWidth={1}
                    />
                    <Line
                      points={[rightX - 5, 0, rightX + 5, 0]}
                      stroke={dimColor}
                      strokeWidth={1}
                    />
                    <Line
                      points={[
                        rightX - 5,
                        carcassOuterHeight,
                        rightX + 5,
                        carcassOuterHeight,
                      ]}
                      stroke={dimColor}
                      strokeWidth={1.5}
                    />
                    <Line
                      points={[
                        rightX - 5,
                        outerHeight,
                        rightX + 5,
                        outerHeight,
                      ]}
                      stroke={dimColor}
                      strokeWidth={1}
                    />
                    <DimBadge
                      x={rightX + 10}
                      y={Math.max(12, carcassMid)}
                      text={`${wardrobe.height} mm`}
                      fontSize={13 * labelScale}
                      anchor="left"
                    />
                    {kickerMm > 0 && (
                      <DimBadge
                        x={rightX + 10}
                        y={kickerMid}
                        text={`${kickerMm} mm`}
                        fontSize={11 * labelScale}
                        anchor="left"
                      />
                    )}
                    {nicheGeom &&
                      tvFromKickerTopY !== null &&
                      fromKicker >= 40 && (
                        <Group>
                          <Line
                            points={[
                              rightX + 52,
                              tvFromKickerTopY,
                              rightX + 52,
                              outerHeight,
                            ]}
                            stroke="#111827"
                            strokeWidth={1.5}
                          />
                          <Line
                            points={[
                              rightX + 46,
                              tvFromKickerTopY,
                              rightX + 58,
                              tvFromKickerTopY,
                            ]}
                            stroke="#111827"
                            strokeWidth={1.5}
                          />
                          <Line
                            points={[
                              rightX + 46,
                              outerHeight,
                              rightX + 58,
                              outerHeight,
                            ]}
                            stroke="#111827"
                            strokeWidth={1.5}
                          />
                          <Text
                            x={rightX + 62}
                            y={
                              (tvFromKickerTopY + outerHeight) / 2 - 18
                            }
                            width={52}
                            align="left"
                            text={`${Math.round(fromKicker)}`}
                            fontSize={13}
                            fill="#111827"
                            fontStyle="bold"
                          />
                          <Text
                            x={rightX + 62}
                            y={(tvFromKickerTopY + outerHeight) / 2 - 2}
                            width={52}
                            align="left"
                            text="mm"
                            fontSize={11}
                            fill="#6d7380"
                          />
                          <Text
                            x={rightX + 62}
                            y={(tvFromKickerTopY + outerHeight) / 2 + 14}
                            width={52}
                            align="left"
                            text="to TV"
                            fontSize={10}
                            fill="#6d7380"
                          />
                        </Group>
                      )}
                  </Group>
                );
              }

              const topEnd = railPx + constructYpx;
              const topBoxMm = Math.max(
                0,
                wardrobe.height - carcassHeight,
              );
              const topMidY = topEnd / 2;
              const bottomMidY = topEnd + (outerHeight - topEnd) / 2;
              return (
                <Group listening={false}>
                  <Line
                    points={[rightX, 0, rightX, outerHeight]}
                    stroke={dimColor}
                    strokeWidth={1}
                  />
                  <Line
                    points={[rightX - 5, 0, rightX + 5, 0]}
                    stroke={dimColor}
                    strokeWidth={1}
                  />
                  <Line
                    points={[rightX - 5, topEnd, rightX + 5, topEnd]}
                    stroke={dimColor}
                    strokeWidth={1.5}
                  />
                  <Line
                    points={[
                      rightX - 5,
                      outerHeight,
                      rightX + 5,
                      outerHeight,
                    ]}
                    stroke={dimColor}
                    strokeWidth={1}
                  />
                  <DimBadge
                    x={rightX + 10}
                    y={Math.max(12, topMidY)}
                    text={`${topBoxMm} mm`}
                    fontSize={13 * labelScale}
                    anchor="left"
                  />
                  <DimBadge
                    x={rightX + 10}
                    y={bottomMidY}
                    text={`${carcassHeight} mm`}
                    fontSize={13 * labelScale}
                    anchor="left"
                  />
                </Group>
              );
            })()}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
