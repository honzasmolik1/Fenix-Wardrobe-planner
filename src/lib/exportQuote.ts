import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface ExportQuoteOptions {
  canvasElement: HTMLElement;
  bomElement?: HTMLElement | null;
  fileName?: string;
}

function captureWardrobeImage(canvasElement: HTMLElement): string {
  // Prefer the Konva stage canvas — it's sized to the wardrobe only
  const konvaCanvas = canvasElement.querySelector("canvas");
  if (konvaCanvas && konvaCanvas.width > 0 && konvaCanvas.height > 0) {
    return konvaCanvas.toDataURL("image/png");
  }
  return "";
}

export async function exportQuotePdf({
  canvasElement,
  bomElement,
  fileName = "fenix-wardrobe.pdf",
}: ExportQuoteOptions): Promise<void> {
  let wardrobeData = captureWardrobeImage(canvasElement);

  if (!wardrobeData) {
    const fallback = await html2canvas(canvasElement, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    wardrobeData = fallback.toDataURL("image/png");
  }

  const bomShot = bomElement
    ? await html2canvas(bomElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      })
    : null;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // —— Page 1: wardrobe drawing (fills the page) ——
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Fenix Wardrobe", margin, 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text(`Layout · ${new Date().toLocaleString()}`, margin, 20);
  pdf.setTextColor(0);

  // Measure wardrobe image
  const img = await loadImage(wardrobeData);
  const imgAspect = img.height / img.width;
  const maxH = pageHeight - 28;
  let drawW = contentWidth;
  let drawH = drawW * imgAspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH / imgAspect;
  }
  const drawX = margin + (contentWidth - drawW) / 2;
  pdf.addImage(wardrobeData, "PNG", drawX, 24, drawW, drawH);

  // —— Page 2: pricing quote ——
  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(0);
  pdf.text("Fenix Pricing Quote", margin, 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text(`Quote · ${new Date().toLocaleString()}`, margin, 20);
  pdf.setTextColor(0);

  if (bomShot) {
    const bomAspect = bomShot.height / bomShot.width;
    let bomHeightMm = contentWidth * bomAspect;
    const maxBomHeight = pageHeight - 30;
    if (bomHeightMm > maxBomHeight) bomHeightMm = maxBomHeight;

    pdf.addImage(
      bomShot.toDataURL("image/png"),
      "PNG",
      margin,
      26,
      contentWidth,
      bomHeightMm,
    );
  } else {
    pdf.setFontSize(12);
    pdf.text("Pricing details unavailable.", margin, 36);
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
