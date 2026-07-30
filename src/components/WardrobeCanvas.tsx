"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import {
  CARCASS_SNAP_MM,
  CONSTRUCTION_SHELF_HEIGHT_MM,
  DRAWER_BAY_WIDTH_MM,
  MIN_CARCASS_HEIGHT_MM,
  MIN_TOP_BOX_MM,
  constructionShelfY,
  mainZoneTop,
} from "@/lib/constants";
import { calculateGapsInZone } from "@/lib/gaps";
import { resolveModuleY } from "@/lib/placement";
import { resizeBaysPreservingLocks } from "@/lib/standardLayout";
import {
  type Module,
  type ModuleType,
  useWardrobeStore,
} from "@/store/store";

/** Space around the carcass for dimension labels (must fit full height/width text) */
const DIM_LEFT = 92;
const DIM_RIGHT = 88;
const DIM_TOP = 42;
const DIM_BOTTOM = 68;
/** Extra margin so the drawing sits a bit off the screen/PDF edges */
const EDGE_GAP = 10;
/** Slightly shrink so outer dims never clip on laptop screens */
const FIT_SHRINK = 0.92;
/** Minimum finger hit height for thin shelves (px) */
const SHELF_HIT_PX = 36;
/** Visual carcass board thickness in mm (drawn outside the interior) */
const BOARD_THICKNESS_MM = 22;
const DIVIDER_STROKE = 5;
const FRAME_COLOR = "#0a0a0a";
const BEVEL_LIGHT = "rgba(255, 255, 255, 0.22)";
const BEVEL_DARK = "rgba(0, 0, 0, 0.35)";

const MODULE_FILL: Record<ModuleType, string> = {
  shelf: "#3f6f64",
  "drawer-pack": "#8d6b45",
  "hanging-rail": "#5b6472",
};

const MODULE_STROKE: Record<ModuleType, string> = {
  shelf: "#2f564d",
  "drawer-pack": "#6f5234",
  "hanging-rail": "#3f4654",
};

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
}

function ModuleShape({
  mod,
  bayWidthPx,
  scale,
  wardrobeHeight,
  selected,
  onSelect,
  onDragEnd,
}: ModuleShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const draggingRef = useRef(false);
  const inset = Math.max(8, 10 * scale);
  const heightPx = Math.max(mod.height * scale, 3);
  const widthPx = Math.max(bayWidthPx - inset * 2, 4);
  const drawerCount = mod.drawerCount ?? 3;
  const hitHeight =
    mod.type === "shelf"
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

  return (
    <Group
      ref={groupRef}
      x={inset}
      y={mod.y * scale}
      draggable={mod.type !== "hanging-rail"}
      dragBoundFunc={(pos) => {
        const maxY = Math.max(0, wardrobeHeight * scale - heightPx);
        let nextY = Math.min(Math.max(0, pos.y), maxY);

        // Shelves click onto a 10 mm gap grid while dragging
        if (mod.type === "shelf") {
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
          );
          nextY = Math.min(maxY, Math.max(0, snappedMm * scale));
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
        />
      ) : mod.type === "hanging-rail" ? (
        <HangingRailVisual
          widthPx={widthPx}
          heightPx={heightPx}
          selected={selected}
        />
      ) : (
        <Rect
          width={widthPx}
          height={Math.max(heightPx, 4)}
          fill={MODULE_FILL.shelf}
          cornerRadius={2}
          stroke={selected ? "#0b6f6b" : MODULE_STROKE.shelf}
          strokeWidth={selected ? 2 : 1}
          shadowColor="rgba(16, 35, 58, 0.2)"
          shadowBlur={selected ? 6 : 3}
          shadowOffsetY={1}
          listening={false}
        />
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
}: {
  widthPx: number;
  heightPx: number;
  drawerCount: number;
  selected: boolean;
}) {
  const gap = Math.max(2, 3 * (heightPx / Math.max(heightPx, 1)));
  const slotHeight = (heightPx - gap * (drawerCount + 1)) / drawerCount;

  return (
    <Group>
      <Rect
        width={widthPx}
        height={heightPx}
        fill="#efe2d2"
        cornerRadius={2}
        stroke={selected ? "#6f5234" : "#a88862"}
        strokeWidth={selected ? 2 : 1}
      />
      {Array.from({ length: drawerCount }, (_, index) => {
        const y = gap + index * (slotHeight + gap);
        const handleW = Math.min(widthPx * 0.34, 48);
        const handleH = Math.max(2, Math.min(4, slotHeight * 0.12));
        return (
          <Group key={index}>
            <Rect
              x={gap}
              y={y}
              width={widthPx - gap * 2}
              height={Math.max(4, slotHeight)}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 0, y: slotHeight }}
              fillLinearGradientColorStops={[0, "#c4a27a", 1, "#9a754c"]}
              cornerRadius={3}
              stroke="#7a5a38"
              strokeWidth={1}
            />
            <Rect
              x={(widthPx - handleW) / 2}
              y={y + slotHeight / 2 - handleH / 2}
              width={handleW}
              height={handleH}
              fill="#d9c3a3"
              cornerRadius={handleH}
              stroke="#8d6b45"
              strokeWidth={0.75}
            />
          </Group>
        );
      })}
      {heightPx >= 28 && (
        <Text
          text={`${drawerCount} drawer${drawerCount === 1 ? "" : "s"}`}
          width={widthPx}
          y={6}
          align="center"
          fontSize={Math.min(12, Math.max(9, heightPx * 0.08))}
          fill="#fffaf3"
          fontStyle="bold"
          listening={false}
        />
      )}
    </Group>
  );
}

function GapDimLine({
  startY,
  endY,
  scale,
  color,
  lineX = 6,
}: {
  startY: number;
  endY: number;
  scale: number;
  color: string;
  lineX?: number;
}) {
  const height = endY - startY;
  if (height < 40) return null;
  const y1 = startY * scale;
  const y2 = endY * scale;
  const midY = (y1 + y2) / 2;
  return (
    <Group listening={false}>
      <Line
        points={[lineX, y1, lineX, y2]}
        stroke={color}
        strokeWidth={1}
        opacity={0.65}
        dash={[4, 4]}
      />
      <Line
        points={[lineX - 3, y1, lineX + 3, y1]}
        stroke={color}
        strokeWidth={1}
        opacity={0.75}
      />
      <Line
        points={[lineX - 3, y2, lineX + 3, y2]}
        stroke={color}
        strokeWidth={1}
        opacity={0.75}
      />
      <Text
        x={lineX + 6}
        y={midY - 6}
        text={`${Math.round(height)} mm`}
        fontSize={height >= 120 ? 11 : 10}
        fill={color}
        fontStyle="bold"
        opacity={0.95}
      />
    </Group>
  );
}

function BayMeasurements({
  modules,
  zoneTopMm,
  wardrobeHeight,
  scale,
  accent,
}: {
  modules: Module[];
  zoneTopMm: number;
  wardrobeHeight: number;
  bayWidthPx: number;
  scale: number;
  accent: boolean;
}) {
  const gaps = calculateGapsInZone(modules, zoneTopMm, wardrobeHeight);
  const color = accent ? "#6f5234" : "#8d6b45";
  const inset = Math.max(8, 10 * scale);
  const lineX = Math.max(6, inset - 4);

  return (
    <Group listening={false}>
      {gaps.map((gap) => (
        <GapDimLine
          key={`gap-${gap.startY}-${gap.endY}`}
          startY={gap.startY}
          endY={gap.endY}
          scale={scale}
          color={color}
          lineX={lineX}
        />
      ))}
    </Group>
  );
}

export function WardrobeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const wardrobe = useWardrobeStore((state) => state.wardrobe);
  const bays = useWardrobeStore((state) => state.bays);
  const modules = useWardrobeStore((state) => state.modules);
  const selectedBayId = useWardrobeStore((state) => state.selectedBayId);
  const selectedModuleId = useWardrobeStore((state) => state.selectedModuleId);
  const canvasHighlight = useWardrobeStore((state) => state.canvasHighlight);
  const materials = useWardrobeStore((state) => state.materials);
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

  // Keep drawer bay locked at the current fixed width (500 mm)
  useEffect(() => {
    const { wardrobe, bays } = useWardrobeStore.getState();
    const needsFix = bays.some(
      (bay) =>
        Boolean(bay.lockedWidth) &&
        (bay.lockedWidth !== DRAWER_BAY_WIDTH_MM ||
          bay.width !== DRAWER_BAY_WIDTH_MM),
    );
    if (!needsFix) return;
    useWardrobeStore.setState({
      bays: resizeBaysPreservingLocks(bays, wardrobe.width),
    });
  }, []);

  // Prevent page scroll from stealing tablet finger drags on the canvas
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();
    container.style.touchAction = "none";
    container.style.userSelect = "none";
    container.style.setProperty("-webkit-user-select", "none");
  }, [size.width, size.height]);

  const scale = useMemo(() => {
    const contentWmm = wardrobe.width + BOARD_THICKNESS_MM * 2;
    const contentHmm = wardrobe.height + BOARD_THICKNESS_MM * 2;
    // Dim label gutters are fixed px — subtract them from the fit box
    const availableWidth = Math.max(
      120,
      size.width - EDGE_GAP * 2 - DIM_LEFT - DIM_RIGHT,
    );
    const availableHeight = Math.max(
      120,
      size.height - EDGE_GAP * 2 - DIM_TOP - DIM_BOTTOM,
    );
    return (
      Math.min(availableWidth / contentWmm, availableHeight / contentHmm) *
      FIT_SHRINK
    );
  }, [size.height, size.width, wardrobe.height, wardrobe.width]);

  const boardPx = BOARD_THICKNESS_MM * scale;
  const innerWidth = wardrobe.width * scale;
  const innerHeight = wardrobe.height * scale;
  const outerWidth = innerWidth + boardPx * 2;
  const outerHeight = innerHeight + boardPx * 2;
  // Stage tightly wraps wardrobe + dimension labels (no huge empty background)
  const stageWidth = Math.ceil(outerWidth + DIM_LEFT + DIM_RIGHT);
  const stageHeight = Math.ceil(outerHeight + DIM_TOP + DIM_BOTTOM);
  const originX = DIM_LEFT;
  const originY = DIM_TOP;

  const interiorFill =
    materials.boardMaterial === "woodgrain" ? "#d8b896" : "#f7f5f1";
  const carcassHeight = wardrobe.carcassHeight;
  const constructYmm = constructionShelfY(wardrobe.height, carcassHeight);
  const constructYpx = constructYmm * scale;
  const constructHpx = CONSTRUCTION_SHELF_HEIGHT_MM * scale;
  const mainTopPx = constructYpx + constructHpx;
  const zoneTopMm = mainZoneTop(wardrobe.height, carcassHeight);
  const dimColor = "#8d6b45";
  const sortedBays = useMemo(
    () => [...bays].sort((a, b) => a.index - b.index),
    [bays],
  );

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center bg-white"
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
        <Layer>
          {/* White page — tap outside the carcass to hide selection tint */}
          <Rect
            x={0}
            y={0}
            width={stageWidth}
            height={stageHeight}
            fill="#ffffff"
            onMouseDown={() => clearCanvasHighlight()}
            onTap={() => clearCanvasHighlight()}
          />

          <Group x={originX} y={originY}>
            {/* Solid black carcass */}
            <Rect
              x={0}
              y={0}
              width={outerWidth}
              height={outerHeight}
              fill={FRAME_COLOR}
            />
            {/* Small bevels on the outer frame */}
            <Line
              points={[1.5, 1.5, outerWidth - 1.5, 1.5]}
              stroke={BEVEL_LIGHT}
              strokeWidth={2}
              listening={false}
            />
            <Line
              points={[1.5, 1.5, 1.5, outerHeight - 1.5]}
              stroke={BEVEL_LIGHT}
              strokeWidth={2}
              listening={false}
            />
            <Line
              points={[
                1.5,
                outerHeight - 1.5,
                outerWidth - 1.5,
                outerHeight - 1.5,
              ]}
              stroke={BEVEL_DARK}
              strokeWidth={2}
              listening={false}
            />
            <Line
              points={[
                outerWidth - 1.5,
                1.5,
                outerWidth - 1.5,
                outerHeight - 1.5,
              ]}
              stroke={BEVEL_DARK}
              strokeWidth={2}
              listening={false}
            />

            {/* Interior (modules live here — drawers sit flush above the bottom board) */}
            <Group x={boardPx} y={boardPx}>
              <Rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill={interiorFill}
              />

              {sortedBays.map((bay, index) => {
                const bayX = getBayOriginX(sortedBays, index) * scale;
                const bayWidthPx = bay.width * scale;
                const isSelected =
                  canvasHighlight && bay.id === selectedBayId;
                const bayModules = modules.filter(
                  (mod) => mod.bayId === bay.id,
                );

                return (
                  <Group
                    key={bay.id}
                    x={bayX}
                    y={0}
                    clipX={0}
                    clipY={0}
                    clipWidth={bayWidthPx}
                    clipHeight={innerHeight}
                  >
                    <Rect
                      x={0}
                      y={0}
                      width={bayWidthPx}
                      height={innerHeight}
                      fill={
                        isSelected ? "rgba(141, 107, 69, 0.1)" : "transparent"
                      }
                      onClick={() => selectBay(bay.id)}
                      onTap={() => selectBay(bay.id)}
                    />

                    {/* Dividers only in the main carcass — not through the top box */}
                    {index > 0 && (
                      <Line
                        points={[0, mainTopPx, 0, innerHeight]}
                        stroke={FRAME_COLOR}
                        strokeWidth={DIVIDER_STROKE}
                        listening={false}
                      />
                    )}

                    {/* Bay label — a few mm below the top inner line */}
                    <Text
                      x={0}
                      y={Math.max(3, 5 * scale)}
                      width={bayWidthPx}
                      align="center"
                      text={`Bay ${index + 1}`}
                      fontSize={12}
                      fill={isSelected ? "#6f5234" : "#6d7380"}
                      fontStyle="bold"
                      listening={false}
                    />

                    {bayModules.map((mod) => (
                      <ModuleShape
                        key={mod.id}
                        mod={mod}
                        bayWidthPx={bayWidthPx}
                        scale={scale}
                        wardrobeHeight={wardrobe.height}
                        selected={
                          canvasHighlight && mod.id === selectedModuleId
                        }
                        onSelect={selectModule}
                        onDragEnd={updateModuleY}
                      />
                    ))}

                    {/* Gaps: top of main zone → fittings → floor */}
                    <BayMeasurements
                      modules={bayModules}
                      zoneTopMm={zoneTopMm}
                      wardrobeHeight={wardrobe.height}
                      bayWidthPx={bayWidthPx}
                      scale={scale}
                      accent={isSelected}
                    />
                  </Group>
                );
              })}

              {/* Top wide-bay height (e.g. 400 mm when carcass is 2000) */}
              <GapDimLine
                startY={0}
                endY={constructYmm}
                scale={scale}
                color={dimColor}
                lineX={Math.max(6, 10 * scale - 4)}
              />
              {/* Construction / top-bay shelf — snaps in 50 mm steps from 2000 mm */}
              <Rect
                id="construct-board"
                x={0}
                y={constructYpx}
                width={innerWidth}
                height={Math.max(constructHpx, 2)}
                fill={FRAME_COLOR}
                draggable
                hitStrokeWidth={28}
                dragBoundFunc={(pos) => {
                  const absX = originX + boardPx;
                  const absOriginY = originY + boardPx;
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
                    constructionShelfY(wardrobe.height, clampedCarcass) * scale;
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
                  event.target.x(0);
                }}
                onDragMove={(event) => {
                  event.evt.preventDefault();
                  event.target.x(0);
                }}
                onDragEnd={(event) => {
                  const node = event.target;
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
              />

              {materials.slidingDoors && (
                <Group listening={false}>
                  {(() => {
                    const doorH = Math.max(4, innerHeight - mainTopPx - 4);
                    const leftX = 2;
                    const rightX = innerWidth / 2 + 2;
                    const doorW = innerWidth / 2 - 4;
                    const mirrorLeft = materials.mirrorSide === "left";
                    const mirrorRight = materials.mirrorSide === "right";
                    const glass = "rgba(160, 195, 220, 0.28)";
                    const plain = "rgba(255, 255, 255, 0.12)";
                    return (
                      <>
                        <Line
                          points={[
                            innerWidth / 2,
                            mainTopPx,
                            innerWidth / 2,
                            innerHeight,
                          ]}
                          stroke="rgba(23, 26, 31, 0.35)"
                          strokeWidth={2}
                        />
                        <Rect
                          x={leftX}
                          y={mainTopPx + 2}
                          width={doorW}
                          height={doorH}
                          fill={mirrorLeft ? glass : plain}
                          stroke="rgba(23, 26, 31, 0.18)"
                          strokeWidth={1}
                        />
                        <Rect
                          x={rightX}
                          y={mainTopPx + 2}
                          width={doorW}
                          height={doorH}
                          fill={mirrorRight ? glass : plain}
                          stroke="rgba(23, 26, 31, 0.18)"
                          strokeWidth={1}
                        />
                        {mirrorLeft && (
                          <>
                            <Line
                              points={[
                                leftX + 16,
                                mainTopPx + 24,
                                leftX + doorW - 16,
                                innerHeight - 24,
                              ]}
                              stroke="rgba(255, 255, 255, 0.45)"
                              strokeWidth={2}
                            />
                            <Text
                              x={leftX}
                              y={mainTopPx + 14}
                              width={doorW}
                              align="center"
                              text="Mirror"
                              fontSize={11}
                              fill="rgba(40, 70, 95, 0.75)"
                              fontStyle="bold"
                            />
                          </>
                        )}
                        {mirrorRight && (
                          <>
                            <Line
                              points={[
                                rightX + 16,
                                mainTopPx + 24,
                                rightX + doorW - 16,
                                innerHeight - 24,
                              ]}
                              stroke="rgba(255, 255, 255, 0.45)"
                              strokeWidth={2}
                            />
                            <Text
                              x={rightX}
                              y={mainTopPx + 14}
                              width={doorW}
                              align="center"
                              text="Mirror"
                              fontSize={11}
                              fill="rgba(40, 70, 95, 0.75)"
                              fontStyle="bold"
                            />
                          </>
                        )}
                      </>
                    );
                  })()}
                </Group>
              )}
            </Group>

            {/* Bay widths — outside, above the wardrobe (adapts to bay count / sizes) */}
            {sortedBays.map((bay, index) => {
              const bayX = boardPx + getBayOriginX(sortedBays, index) * scale;
              const bayWidthPx = bay.width * scale;
              return (
                <Group key={`bay-w-${bay.id}`} listening={false}>
                  <Line
                    points={[
                      bayX,
                      -8,
                      bayX + bayWidthPx,
                      -8,
                    ]}
                    stroke={dimColor}
                    strokeWidth={1}
                  />
                  <Line
                    points={[bayX, -12, bayX, -4]}
                    stroke={dimColor}
                    strokeWidth={1}
                  />
                  <Line
                    points={[
                      bayX + bayWidthPx,
                      -12,
                      bayX + bayWidthPx,
                      -4,
                    ]}
                    stroke={dimColor}
                    strokeWidth={1}
                  />
                  <Text
                    x={bayX}
                    y={-28}
                    width={bayWidthPx}
                    align="center"
                    text={`${bay.width} mm`}
                    fontSize={11}
                    fill={FRAME_COLOR}
                    fontStyle="bold"
                  />
                </Group>
              );
            })}

            <Line
              points={[
                0,
                outerHeight + 28,
                outerWidth,
                outerHeight + 28,
              ]}
              stroke={dimColor}
              strokeWidth={1.5}
            />
            <Line
              points={[0, outerHeight + 22, 0, outerHeight + 34]}
              stroke={dimColor}
              strokeWidth={1.5}
            />
            <Line
              points={[
                outerWidth,
                outerHeight + 22,
                outerWidth,
                outerHeight + 34,
              ]}
              stroke={dimColor}
              strokeWidth={1.5}
            />
            <Text
              x={0}
              y={outerHeight + 40}
              width={outerWidth}
              align="center"
              text={`${wardrobe.width} mm`}
              fontSize={15}
              fill={FRAME_COLOR}
              fontStyle="bold"
              listening={false}
            />

            {/* Left — full wardrobe height (e.g. 2400 mm) */}
            <Line
              points={[-34, 0, -34, outerHeight]}
              stroke={dimColor}
              strokeWidth={1.5}
            />
            <Line points={[-40, 0, -28, 0]} stroke={dimColor} strokeWidth={1.5} />
            <Line
              points={[-40, outerHeight, -28, outerHeight]}
              stroke={dimColor}
              strokeWidth={1.5}
            />
            <Text
              x={-88}
              y={outerHeight / 2 - 12}
              width={48}
              align="center"
              text={`${wardrobe.height}`}
              fontSize={14}
              fill={FRAME_COLOR}
              fontStyle="bold"
              listening={false}
            />
            <Text
              x={-88}
              y={outerHeight / 2 + 6}
              width={48}
              align="center"
              text="mm"
              fontSize={12}
              fill="#6d7380"
              listening={false}
            />

            {/* Right — top long bay + main carcass below */}
            {(() => {
              const rightX = outerWidth + 34;
              const topEnd = boardPx + constructYpx;
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
                    strokeWidth={1.5}
                  />
                  <Line
                    points={[rightX - 6, 0, rightX + 6, 0]}
                    stroke={dimColor}
                    strokeWidth={1.5}
                  />
                  <Line
                    points={[rightX - 6, topEnd, rightX + 6, topEnd]}
                    stroke={FRAME_COLOR}
                    strokeWidth={2}
                  />
                  <Line
                    points={[
                      rightX - 6,
                      outerHeight,
                      rightX + 6,
                      outerHeight,
                    ]}
                    stroke={dimColor}
                    strokeWidth={1.5}
                  />
                  <Text
                    x={rightX + 10}
                    y={Math.max(2, topMidY - 12)}
                    width={56}
                    align="left"
                    text={`${topBoxMm}`}
                    fontSize={13}
                    fill={FRAME_COLOR}
                    fontStyle="bold"
                  />
                  <Text
                    x={rightX + 10}
                    y={Math.max(16, topMidY + 4)}
                    width={56}
                    align="left"
                    text="mm"
                    fontSize={11}
                    fill="#6d7380"
                  />
                  <Text
                    x={rightX + 10}
                    y={bottomMidY - 12}
                    width={56}
                    align="left"
                    text={`${carcassHeight}`}
                    fontSize={13}
                    fill={FRAME_COLOR}
                    fontStyle="bold"
                  />
                  <Text
                    x={rightX + 10}
                    y={bottomMidY + 4}
                    width={56}
                    align="left"
                    text="mm"
                    fontSize={11}
                    fill="#6d7380"
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
