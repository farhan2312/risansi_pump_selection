/**
 * Client-side PDF export for the final Selection Summary report — company
 * logo + generated date/by, the confirmed pump's details up top, then one
 * COLORED table per wizard step (mirroring the on-screen report's boxes,
 * each step getting its own distinct hue so sections are easy to tell
 * apart at a glance). The Drive step's selected V-Belt/Gearbox option
 * renders in the app's positive/confirmed green, same as on screen. Every
 * table is measured before it's drawn and, if it wouldn't fully fit in the
 * remaining page space, pushed onto a fresh page as a whole — autoTable's
 * default behavior of splitting a table's rows across a page boundary is
 * deliberately avoided (see ensureTableFits below).
 *
 * Pure client-side (jsPDF + jspdf-autotable, no server round-trip) so it
 * can run from a "use client" step component; the resulting bytes are then
 * uploaded separately (see reportsService.uploadFinalReport) so a copy is
 * saved on the project, not just downloaded to the browser.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type SelectionSummaryPdfField = [string, string | undefined];

export interface SelectionSummaryPdfSection {
  title: string;
  items: SelectionSummaryPdfField[];
  /** Renders in the app's positive/confirmed green instead of its section
   * color — used for the Drive step's selected V-Belt/Gearbox option,
   * matching the on-screen highlight. */
  highlight?: boolean;
}

export interface SelectionSummaryPdfInput {
  projectCode: string;
  projectName?: string;
  customerName?: string;
  pumpFields: SelectionSummaryPdfField[];
  sections: SelectionSummaryPdfSection[];
  generatedBy?: string;
}

export interface SelectionSummaryPdfResult {
  filename: string;
  bytes: ArrayBuffer;
}

async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1, height: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

type RGB = [number, number, number];

// Quotation-style layout: one uniform dark section band for every section
// (no per-section colors), full-width, with the title centered — matching the
// Risansi technical-quotation sheets.
const SECTION_BAND: RGB = [60, 60, 60]; // dark grey band
const BAND_TEXT: RGB = [255, 255, 255]; // white title on the band
const CELL_BORDER: RGB = [150, 150, 150]; // visible grid lines like the sheet

const LABEL_COL_WIDTH = 170;
const FONT_SIZE = 9.5;
const CELL_PADDING = 6;
const LINE_HEIGHT = FONT_SIZE * 1.15;

function filledRows(items: SelectionSummaryPdfField[]): [string, string][] {
  return items.filter((f): f is [string, string] => !!f[1] && f[1].trim() !== "");
}

// Measures exactly what autoTable is about to draw (same font size, same
// column width, same wrapping rule) so the caller can decide whether the
// whole table fits in the remaining page space *before* committing to draw
// it — the only reliable way to stop autoTable from splitting a table
// across a page boundary, since it has no "keep together" option itself.
function estimateTableHeight(doc: jsPDF, rows: [string, string][], contentWidth: number): number {
  const valueColWidth = contentWidth - LABEL_COL_WIDTH - CELL_PADDING * 4;
  doc.setFontSize(FONT_SIZE);
  const headerHeight = LINE_HEIGHT + CELL_PADDING * 2;
  const rowsHeight = rows.reduce((sum, [, value]) => {
    const lines = doc.splitTextToSize(value, valueColWidth) as string[];
    return sum + Math.max(1, lines.length) * LINE_HEIGHT + CELL_PADDING * 2;
  }, 0);
  return headerHeight + rowsHeight;
}

export async function downloadSelectionSummaryPdf(
  input: SelectionSummaryPdfInput,
): Promise<SelectionSummaryPdfResult> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 40;

  // For non-table content only (header text, section captions) — tables use
  // ensureTableFits below instead, since they need the actual table height,
  // not a fixed guess.
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // Forces the *whole* table onto a fresh page if it wouldn't fully fit in
  // what's left of the current one, instead of letting autoTable split its
  // rows across the page boundary.
  const ensureTableFits = (rows: [string, string][], captionHeight: number) => {
    const tableHeight = estimateTableHeight(doc, rows, contentWidth);
    if (y + captionHeight + tableHeight > pageHeight - margin - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // Plain, bordered two-column label/value grid — white cells with visible
  // grid lines and a bold label column, matching the quotation sheet. No
  // per-section coloring and no zebra striping.
  const drawTable = (rows: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: rows,
      theme: "grid",
      styles: {
        fontSize: FONT_SIZE,
        cellPadding: CELL_PADDING,
        textColor: 40,
        lineColor: CELL_BORDER,
        lineWidth: 0.5,
        valign: "top",
        overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: LABEL_COL_WIDTH, textColor: 40 },
        1: { cellWidth: contentWidth - LABEL_COL_WIDTH },
      },
      showHead: false,
    });
    // Butt the section band of the next section directly against this table,
    // like the continuous banded sheet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 14;
  };

  // Full-width dark section band with a centered white title — the section
  // header style used across the Risansi quotation sheets.
  const BAND_HEIGHT = 20;
  const drawSectionBand = (title: string) => {
    doc.setFillColor(SECTION_BAND[0], SECTION_BAND[1], SECTION_BAND[2]);
    doc.rect(margin, y, contentWidth, BAND_HEIGHT, "F");
    doc.setFontSize(10.5);
    doc.setTextColor(BAND_TEXT[0], BAND_TEXT[1], BAND_TEXT[2]);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), pageWidth / 2, y + BAND_HEIGHT / 2 + 3.5, {
      align: "center",
    });
    y += BAND_HEIGHT;
  };

  // --- Header: logo, generated date/by ---
  const logo = await loadImageAsDataUrl("/logo.png");
  if (logo) {
    const targetH = 36;
    const targetW = (logo.width / logo.height) * targetH;
    doc.addImage(logo.dataUrl, margin, y, targetW, targetH);
  }
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, y + 14, { align: "right" });
  if (input.generatedBy) {
    doc.text(`Generated by ${input.generatedBy}`, pageWidth - margin, y + 28, { align: "right" });
  }
  y += 55;

  doc.setFontSize(17);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("Pump Selection Summary Report", margin, y);
  y += 6;
  doc.setDrawColor(210);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.setFont("helvetica", "normal");
  const projectLine = [input.projectCode, input.projectName, input.customerName]
    .filter(Boolean)
    .join("  •  ");
  if (projectLine) {
    doc.text(projectLine, margin, y + 12);
    y += 12;
  }
  y += 16;

  // --- Pump Selection — the report's anchor, always first ---
  const pumpRows = filledRows(input.pumpFields);
  if (pumpRows.length > 0) {
    ensureTableFits(pumpRows, BAND_HEIGHT + 4);
    drawSectionBand("Pump Selection");
    drawTable(pumpRows);
  }

  // --- One banded table per section ---
  for (const section of input.sections) {
    const rows = filledRows(section.items);
    if (rows.length === 0) continue;

    ensureTableFits(rows, BAND_HEIGHT + 4);
    drawSectionBand(section.title);
    drawTable(rows);
  }

  // --- Footer on every page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.setFont("helvetica", "normal");
    doc.text("Pump selection confirmed by the assigned engineer.", margin, pageHeight - 18);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 18, {
      align: "right",
    });
  }

  const safeProject = input.projectCode.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `Selection-Summary-${safeProject || "project"}-${dateSlug}.pdf`;
  doc.save(filename);

  return { filename, bytes: doc.output("arraybuffer") };
}
