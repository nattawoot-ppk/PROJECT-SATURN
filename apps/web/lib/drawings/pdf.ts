import { jsPDF } from "jspdf";
import type { Sheet } from "./svg";
import { SHEET } from "./svg";

/** Rasterise each SVG sheet at 2× and compose an A3 landscape PDF. */
export async function sheetsToPdf(sheets: Sheet[]): Promise<Blob> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  for (let i = 0; i < sheets.length; i++) {
    const png = await svgToPng(sheets[i]!.svg, SHEET.w * 4, SHEET.h * 4);
    if (i > 0) pdf.addPage();
    pdf.addImage(png, "JPEG", 0, 0, SHEET.w, SHEET.h, undefined, "FAST");
  }
  return pdf.output("blob");
}

function svgToPng(svg: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG raster failed")); };
    img.src = url;
  });
}
