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

const PUMP_HEAD: RGB = [10, 61, 143]; // navy — the report's anchor section
const POS_GREEN: RGB = [5, 150, 105]; // confirmed/selected — matches --pos

// One distinct hue per wizard step so the sections are easy to tell apart
// at a glance, in wizard order. Falls back to a neutral slate for any title
// not listed here (keeps this forward-compatible with a renamed/new step
// rather than erroring).
const SECTION_COLORS: Record<string, RGB> = {
  // Quotation-format section titles (single-liquid layout).
  "Liquid Parameters": [37, 99, 235], // blue
  "Material of Construction": [217, 119, 6], // amber
  "Sealing Type": [79, 70, 229], // indigo
  "Pump Details": [8, 145, 178], // cyan
  "Drive Systems": [10, 61, 143], // navy
  // Legacy titles (older saved reports may still carry these).
  "General Information": [37, 99, 235],
  "Fluid Properties": [8, 145, 178],
  "Operating Conditions": [124, 58, 237],
  "MOC & Elastomer": [217, 119, 6],
  "Sealing Details": [79, 70, 229],
  "Motor Rating": [71, 85, 105],
  "Drive Details": [10, 61, 143],
};
const DEFAULT_SECTION_COLOR: RGB = [71, 85, 105];

function sectionColor(section: SelectionSummaryPdfSection): RGB {
  if (section.highlight) return POS_GREEN;
  return SECTION_COLORS[section.title] ?? DEFAULT_SECTION_COLOR;
}

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

  const drawTable = (rows: [string, string][], headColor: RGB) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: rows,
      theme: "grid",
      styles: {
        fontSize: FONT_SIZE,
        cellPadding: CELL_PADDING,
        textColor: 40,
        lineColor: [225, 228, 232],
        lineWidth: 0.5,
        valign: "top",
        overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: LABEL_COL_WIDTH, textColor: 70 },
        1: { cellWidth: contentWidth - LABEL_COL_WIDTH },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      // A colored, empty header row reads as a section-color accent bar —
      // simpler and more compact than a separate title line + table.
      showHead: false,
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          data.cell.styles.textColor = [
            Math.round(headColor[0] * 0.75),
            Math.round(headColor[1] * 0.75),
            Math.round(headColor[2] * 0.75),
          ];
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 18;
  };

  const drawSectionCaption = (title: string, color: RGB) => {
    doc.setFontSize(11.5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont("helvetica", "bold");
    // Small accent square ahead of the title — the color cue the row-level
    // label coloring alone wouldn't give you at a glance.
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(margin, y - 8, 8, 8, "F");
    doc.text(title, margin + 14, y);
    y += 12;
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
    ensureTableFits(pumpRows, 22);
    drawSectionCaption("Pump Selection", PUMP_HEAD);
    drawTable(pumpRows, PUMP_HEAD);
  }

  // --- One colored table per wizard step ---
  for (const section of input.sections) {
    const rows = filledRows(section.items);
    if (rows.length === 0) continue;

    const color = sectionColor(section);
    ensureTableFits(rows, 22);
    drawSectionCaption(section.title, color);
    drawTable(rows, color);
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
