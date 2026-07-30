"use client";

import { BillOfMaterials } from "@/components/BillOfMaterials";
import { SelectionDock } from "@/components/SelectionDock";
import { TopBar } from "@/components/TopBar";
import { WardrobeCanvasLoader } from "@/components/WardrobeCanvasLoader";

export default function HomePage() {
  return (
    <main className="app-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <TopBar />

      <div
        id="wardrobe-canvas-capture"
        className="relative min-h-0 flex-1 overflow-hidden bg-white touch-none"
      >
        <WardrobeCanvasLoader />
      </div>

      <SelectionDock />

      {/* Off-screen BOM used by Create PDF page 2 */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 left-[-10000px] w-[560px]"
      >
        <BillOfMaterials />
      </div>
    </main>
  );
}
