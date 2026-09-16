import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { TV_SIZE_DISCLAIMER } from "@/lib/mediaLayout";

export interface QuotePdfUnit {
  imageData: string;
  unitCaption: string;
  dimensions: string;
  measurements: string;
  doorNotes: string[];
  unitMode?: "wardrobe" | "media";
}

interface ExportQuoteOptions {
  units: QuotePdfUnit[];
  clientName: string;
  extraNotes?: string;
  fileName?: string;
}

/** Printed under Description on every page. */
export const DRAWING_SIZE_DISCLAIMER =
  "This drawing is issued for design approval. A final drawing will be presented prior to manufacture. Dimensions shown are indicative and may change slightly to suit site conditions and construction requirements.";

const LOGO_PATH = "/logo.png";
const LOGO_H_MM = 26;
const LOGO_W_MM = 26;
const MARGIN_MM = 14;
const ACCENT = { r: 141, g: 107, b: 69 };
const INK = { r: 23, g: 26, b: 31 };
const MUTED = { r: 90, g: 94, b: 102 };

/** ~150–180 dpi on A4 — sharp enough to read, small enough to email */
const EXPORT_LONG_EDGE_PX = 1800;
const JPEG_QUALITY = 0.82;

async function captureWardrobeCanvas(
  canvasElement: HTMLElement,
): Promise<HTMLCanvasElement | null> {
  if (typeof window === "undefined") return null;
  const Konva = (await import("konva")).default;
  const stage =
    Konva.stages.find((item) => canvasElement.contains(item.container())) ??
    null;
  if (!stage || stage.width() <= 0 || stage.height() <= 0) return null;

  const longEdge = Math.max(stage.width(), stage.height());
  const pixelRatio = Math.min(
    2.5,
    Math.max(1.75, EXPORT_LONG_EDGE_PX / longEdge),
  );

  return trimWhiteCanvas(stage.toCanvas({ pixelRatio }));
}

function trimWhiteCanvas(
  source: HTMLCanvasElement,
  pad = 28,
): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const { width, height } = source;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (pixels[i] < 252 || pixels[i + 1] < 252 || pixels[i + 2] < 252) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return source;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const outCtx = out.getContext("2d");
  if (!outCtx) return source;
  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, w, h);
  outCtx.drawImage(source, minX, minY, w, h, 0, 0, w, h);
  return out;
}

function canvasToJpeg(
  source: HTMLCanvasElement,
  maxPx = EXPORT_LONG_EDGE_PX,
  quality = JPEG_QUALITY,
): string {
  const scale = Math.min(1, maxPx / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return source.toDataURL("image/jpeg", quality);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return out.toDataURL("image/jpeg", quality);
}

async function captureElementJpeg(element: HTMLElement): Promise<string> {
  const shot = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.min(2, Math.max(1.5, window.devicePixelRatio)),
    useCORS: true,
    logging: false,
  });
  return canvasToJpeg(trimWhiteCanvas(shot));
}

/** Knock out the black square and darken champagne ink so it reads on white. */
function preparePrintLogo(img: HTMLImageElement): string {
  const max = 280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < 42) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = Math.round(data[i] * 0.26);
    data[i + 1] = Math.round(data[i + 1] * 0.24);
    data[i + 2] = Math.round(data[i + 2] * 0.18);
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return out.toDataURL("image/png");
}

async function loadLogoPng(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_PATH);
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const prepared = preparePrintLogo(img);
      return prepared || null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

function formatQuoteDate(date = new Date()): string {
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function drawQuoteHeader(
  pdf: jsPDF,
  opts: {
    clientName: string;
    unitCaption: string;
    dimensions: string;
    dateLabel: string;
    logoData: string | null;
  },
): number {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const right = pageWidth - MARGIN_MM;
  const textX = opts.logoData ? MARGIN_MM + LOGO_W_MM + 6 : MARGIN_MM;
  const textWidth = right - textX;
  const title = "Fenix Wardrobes & Joinery";

  if (opts.logoData) {
    pdf.addImage(
      opts.logoData,
      "PNG",
      MARGIN_MM,
      MARGIN_MM,
      LOGO_W_MM,
      LOGO_H_MM,
      undefined,
      "NONE",
    );
  }

  let y = MARGIN_MM + 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  const titleLines = pdf.splitTextToSize(title, textWidth);
  pdf.text(titleLines, textX, y);
  y += titleLines.length * 6 + 1.5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(opts.dateLabel, right, MARGIN_MM + 8, { align: "right" });

  if (opts.clientName.trim()) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    const nameLines = pdf.splitTextToSize(opts.clientName.trim(), textWidth);
    pdf.text(nameLines, textX, y);
    y += nameLines.length * 5.4 + 1;
  }

  if (opts.unitCaption.trim()) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    const capLines = pdf.splitTextToSize(opts.unitCaption.trim(), textWidth);
    pdf.text(capLines, textX, y);
    y += capLines.length * 5 + 1;
  }

  if (opts.dimensions) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text(opts.dimensions, textX, y);
    y += 5;
  }

  const ruleY = Math.max(y + 3, MARGIN_MM + LOGO_H_MM + 4);
  pdf.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  pdf.setLineWidth(0.55);
  pdf.line(MARGIN_MM, ruleY, right, ruleY);

  return ruleY + 5;
}

function wrapPdfLines(pdf: jsPDF, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    lines.push(...pdf.splitTextToSize(trimmed, width));
  }
  return lines;
}

function descriptionLines(
  pdf: jsPDF,
  extra: string,
  doorNotes: string[],
  measurements = "",
): string[] {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN_MM * 2 - 1;
  const lines: string[] = [];
  const measureTrim = measurements.trim();
  if (measureTrim) {
    lines.push(...wrapPdfLines(pdf, measureTrim, width));
  }
  const extraTrim = extra.trim();
  if (extraTrim) {
    if (lines.length > 0) lines.push("");
    const noteBody = extraTrim.replace(/^notes?\s*:\s*/i, "");
    lines.push(...wrapPdfLines(pdf, `Note: ${noteBody}`, width));
  }
  if (doorNotes.length > 0) {
    if (lines.length > 0) lines.push("");
    for (const note of doorNotes) {
      lines.push(...wrapPdfLines(pdf, note, width));
    }
  }
  return lines;
}

function disclaimerLines(
  pdf: jsPDF,
  unitMode?: "wardrobe" | "media",
): string[] {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN_MM * 2 - 1;
  const lines = wrapPdfLines(pdf, DRAWING_SIZE_DISCLAIMER, width);
  if (unitMode === "media") {
    lines.push("");
    lines.push("");
    lines.push(...wrapPdfLines(pdf, TV_SIZE_DISCLAIMER, width));
  }
  return lines;
}

function descriptionBlockHeight(
  bodyCount: number,
  disclaimerCount: number,
): number {
  let height = 0;
  if (bodyCount > 0) height += 10 + bodyCount * 4.6;
  if (disclaimerCount > 0) {
    height += (bodyCount > 0 ? 5 : 10) + 6 + disclaimerCount * 4.2;
  }
  if (height > 0) height += 6;
  return height;
}

function drawDescription(
  pdf: jsPDF,
  bodyLines: string[],
  noteLines: string[],
  startY: number,
  maxY: number,
): number {
  if (bodyLines.length === 0 && noteLines.length === 0) return startY;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const right = pageWidth - MARGIN_MM;
  let y = startY;

  if (bodyLines.length > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text("Description", MARGIN_MM, y);
    y += 5.5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    for (const line of bodyLines) {
      if (y > maxY) break;
      if (line) pdf.text(line, MARGIN_MM + 1, y);
      y += 4.6;
    }
  }

  if (noteLines.length > 0 && y <= maxY) {
    if (bodyLines.length > 0) y += 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text("Disclaimer", MARGIN_MM, y);
    y += 5;
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8.5);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    for (const line of noteLines) {
      if (y > maxY) break;
      if (line) {
        pdf.text(line, MARGIN_MM + 1, y);
        y += 4.2;
      } else {
        y += 3.8;
      }
    }
  }

  pdf.setDrawColor(220, 222, 226);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_MM, y, right, y);
  return y + 5;
}

function drawFooter(pdf: jsPDF, page: number, pageCount: number): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const y = pageHeight - 9;
  pdf.setDrawColor(220, 222, 226);
  pdf.setLineWidth(0.25);
  pdf.line(MARGIN_MM, y - 4, pageWidth - MARGIN_MM, y - 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text("Fenix Wardrobes & Joinery", MARGIN_MM, y);
  pdf.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN_MM, y, {
    align: "right",
  });
}

export async function captureUnitJpeg(
  canvasElement: HTMLElement,
): Promise<string> {
  const wardrobeCanvas = await captureWardrobeCanvas(canvasElement);
  if (wardrobeCanvas) return canvasToJpeg(wardrobeCanvas);
  return captureElementJpeg(canvasElement);
}

export async function exportQuotePdf({
  units,
  clientName,
  extraNotes = "",
  fileName = "fenix-wardrobe.pdf",
}: ExportQuoteOptions): Promise<void> {
  if (units.length === 0) return;

  const logoData = await loadLogoPng();
  const dateLabel = formatQuoteDate();

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_MM * 2;

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (index > 0) pdf.addPage();

    const headerBottom = drawQuoteHeader(pdf, {
      clientName,
      unitCaption: unit.unitCaption,
      dimensions: unit.dimensions,
      dateLabel,
      logoData,
    });

    const extra = index === units.length - 1 ? extraNotes : "";
    const doorNotes = unit.doorNotes.filter((line) => line.trim());
    const bodyLines = descriptionLines(
      pdf,
      extra,
      doorNotes,
      unit.measurements,
    );
    const noteLines = disclaimerLines(pdf, unit.unitMode);
    const notesBlockH = descriptionBlockHeight(
      bodyLines.length,
      noteLines.length,
    );
    const maxH = pageHeight - headerBottom - 14 - notesBlockH;

    const img = await loadImage(unit.imageData);
    const imgAspect = img.height / Math.max(1, img.width);
    let drawW = contentWidth;
    let drawH = drawW * imgAspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH / imgAspect;
    }
    const drawX = MARGIN_MM + (contentWidth - drawW) / 2;
    pdf.addImage(
      unit.imageData,
      "JPEG",
      drawX,
      headerBottom,
      drawW,
      drawH,
      undefined,
      "MEDIUM",
    );

    if (bodyLines.length > 0 || noteLines.length > 0) {
      drawDescription(
        pdf,
        bodyLines,
        noteLines,
        headerBottom + drawH + 6,
        pageHeight - 16,
      );
    }
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    drawFooter(pdf, page, pageCount);
  }

  pdf.save(fileName);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
