/**
 * Client-side PDF export for the final Selection Summary report — company
 * logo + generated date/by, then one section per quotation group, each drawn
 * as a full-width dark header band followed by a plain bordered two-column
 * label/value table (matching the Risansi technical-quotation sheets — a
 * single uniform band color, no per-section hues). Every table is measured
 * before it's drawn and, if it wouldn't fully fit in the remaining page
 * space, pushed onto a fresh page as a whole — autoTable's default behavior
 * of splitting a table's rows across a page boundary is deliberately avoided
 * (see ensureTableFits below).
 *
 * Pure client-side (jsPDF + jspdf-autotable, no server round-trip) so it
 * can run from a "use client" step component; the resulting bytes are then
 * uploaded separately (see reportsService.uploadFinalReport) so a copy is
 * saved on the project, not just downloaded to the browser.
 */
import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

import { fmtRecheckNum, type RecheckTables } from "./recheck-calc";

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

export async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
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

// Shared page layout + drawing helpers, so the single-tag report and the
// multi-tag enquiry document render identically (same banded tables, same
// page-fit logic). `state.y` is the running vertical cursor.
function createLayout(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const BAND_HEIGHT = 20;
  const state = { y: 40 };

  // For non-table content (header text, dividers).
  const ensureSpace = (needed: number) => {
    if (state.y + needed > pageHeight - margin - 20) {
      doc.addPage();
      state.y = margin;
    }
  };

  // Forces the *whole* table onto a fresh page if it wouldn't fully fit in
  // what's left of the current one, instead of letting autoTable split its
  // rows across the page boundary.
  const ensureTableFits = (rows: [string, string][], captionHeight: number) => {
    const tableHeight = estimateTableHeight(doc, rows, contentWidth);
    if (state.y + captionHeight + tableHeight > pageHeight - margin - 20) {
      doc.addPage();
      state.y = margin;
    }
  };

  // Plain, bordered two-column label/value grid — white cells with visible
  // grid lines and a bold label column, matching the quotation sheet.
  const drawTable = (rows: [string, string][]) => {
    autoTable(doc, {
      startY: state.y,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state.y = (doc as any).lastAutoTable.finalY + 14;
  };

  // Full-width dark section band with a centered white title.
  const drawSectionBand = (title: string) => {
    doc.setFillColor(SECTION_BAND[0], SECTION_BAND[1], SECTION_BAND[2]);
    doc.rect(margin, state.y, contentWidth, BAND_HEIGHT, "F");
    doc.setFontSize(10.5);
    doc.setTextColor(BAND_TEXT[0], BAND_TEXT[1], BAND_TEXT[2]);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), pageWidth / 2, state.y + BAND_HEIGHT / 2 + 3.5, {
      align: "center",
    });
    state.y += BAND_HEIGHT;
  };

  // The pump anchor table (if any) followed by one banded table per section.
  const drawSections = (
    pumpFields: SelectionSummaryPdfField[],
    sections: SelectionSummaryPdfSection[],
  ) => {
    const pumpRows = filledRows(pumpFields);
    if (pumpRows.length > 0) {
      ensureTableFits(pumpRows, BAND_HEIGHT + 4);
      drawSectionBand("Pump Selection");
      drawTable(pumpRows);
    }
    for (const section of sections) {
      const rows = filledRows(section.items);
      if (rows.length === 0) continue;
      ensureTableFits(rows, BAND_HEIGHT + 4);
      drawSectionBand(section.title);
      drawTable(rows);
    }
  };

  return {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    BAND_HEIGHT,
    state,
    ensureSpace,
    drawTable,
    drawSectionBand,
    drawSections,
  };
}

type Layout = ReturnType<typeof createLayout>;

// Logo + generated date/by + title + project line. Advances the cursor to the
// start of the body.
async function drawReportHeader(
  doc: jsPDF,
  L: Layout,
  opts: { title: string; projectLine: string; generatedBy?: string },
) {
  const { margin, pageWidth } = L;
  const logo = await loadImageAsDataUrl("/logo.png");
  if (logo) {
    const targetH = 36;
    const targetW = (logo.width / logo.height) * targetH;
    doc.addImage(logo.dataUrl, margin, L.state.y, targetW, targetH);
  }
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, L.state.y + 14, { align: "right" });
  if (opts.generatedBy) {
    doc.text(`Generated by ${opts.generatedBy}`, pageWidth - margin, L.state.y + 28, {
      align: "right",
    });
  }
  L.state.y += 55;

  doc.setFontSize(17);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, margin, L.state.y);
  L.state.y += 6;
  doc.setDrawColor(210);
  doc.line(margin, L.state.y, pageWidth - margin, L.state.y);
  L.state.y += 10;

  if (opts.projectLine) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.text(opts.projectLine, margin, L.state.y + 12);
    L.state.y += 12;
  }
  L.state.y += 16;
}

function drawFooter(
  doc: jsPDF,
  L: Layout,
  note = "Pump selection confirmed by the assigned engineer.",
) {
  const { pageWidth, pageHeight, margin } = L;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.setFont("helvetica", "normal");
    doc.text(note, margin, pageHeight - 18);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 18, {
      align: "right",
    });
  }
}

function projectLineOf(
  input: { projectCode: string; projectName?: string; customerName?: string },
): string {
  return [input.projectCode, input.projectName, input.customerName].filter(Boolean).join("  •  ");
}

function safeSlug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

export async function downloadSelectionSummaryPdf(
  input: SelectionSummaryPdfInput,
  /** Set save:false to build the bytes WITHOUT triggering a browser
   *  download — used by Confirm Pump Selection, which always stores a PDF
   *  server-side but may hand the user an Excel file instead. */
  opts: { save?: boolean } = {},
): Promise<SelectionSummaryPdfResult> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = createLayout(doc);

  await drawReportHeader(doc, L, {
    title: "Pump Selection Summary Report",
    projectLine: projectLineOf(input),
    generatedBy: input.generatedBy,
  });

  L.drawSections(input.pumpFields, input.sections);
  drawFooter(doc, L);

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `Selection-Summary-${safeSlug(input.projectCode) || "project"}-${dateSlug}.pdf`;
  if (opts.save !== false) doc.save(filename);

  return { filename, bytes: doc.output("arraybuffer") };
}

// --- Recheck at final selected RPM ------------------------------------------

export interface RecheckPdfInput {
  projectCode: string;
  projectName?: string;
  customerName?: string;
  generatedBy?: string;
  /** Same rows the Drive step's Recheck popup shows (lib/recheck-calc). */
  tables: RecheckTables;
  /** The selected pump card from Live Recommendation, drawn above the inputs. */
  pumpCard?: RecheckPumpCard;
  /** Motor Rating step figures, drawn after the pump card. */
  motorRating?: RecheckMotorRating;
}

export interface RecheckMotorRating {
  /** Brake kW at the duty point, already formatted. */
  bkw: string;
  /** BKW × 1.2 */
  motorKw: string;
  recommendedKw: string;
  selectedKw: string;
  mechEff?: string;
  /** Why the selected rating differs from the recommended one. */
  remarks?: string;
}

// Motor Rating figures in the same card style: BKW → Motor KW → Recommended,
// with the Selected rating emphasised (amber when it differs).
function drawMotorRatingCard(doc: jsPDF, L: Layout, m: RecheckMotorRating): void {
  const cells: [string, string][] = [
    ["BKW", m.bkw],
    ["Motor KW (BKW × 1.2)", m.motorKw],
    ["Recommended KW", m.recommendedKw],
    ["Selected KW", m.selectedKw],
  ];
  const differs = m.selectedKw !== "—" && m.recommendedKw !== "—" && parseFloat(m.selectedKw) !== parseFloat(m.recommendedKw);
  const padX = 14;
  const gridH = 44;
  const noteLines: string[] = [];
  if (m.mechEff) noteLines.push(`Mechanical efficiency ${m.mechEff} · BKW = Capacity × Head ÷ 367 ÷ (ME ÷ 100), at the duty head.`);
  if (differs && m.remarks) noteLines.push(`Why ${m.selectedKw} instead of ${m.recommendedKw}: ${m.remarks}`);
  doc.setFontSize(9);
  const wrapped = noteLines.flatMap((t) => doc.splitTextToSize(t, L.contentWidth - padX * 2) as string[]);
  const noteH = wrapped.length ? wrapped.length * 12 + 8 : 0;
  const height = gridH + noteH + 12;

  L.ensureSpace(L.BAND_HEIGHT + height + 16);
  L.drawSectionBand("Motor Rating");
  const x = L.margin;
  const y = L.state.y + 8;
  const w = L.contentWidth;

  doc.setFillColor(247, 250, 252);
  doc.setDrawColor(CELL_BORDER[0], CELL_BORDER[1], CELL_BORDER[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, height, 6, 6, "FD");

  const cellW = (w - padX * 2) / cells.length;
  cells.forEach(([label, value], i) => {
    const cx = x + padX + i * cellW;
    const last = i === cells.length - 1;
    if (last) {
      // Highlight the final selection.
      if (differs) doc.setFillColor(254, 243, 199);
      else doc.setFillColor(POS_SOFT[0], POS_SOFT[1], POS_SOFT[2]);
      doc.roundedRect(cx - 6, y + 6, cellW - 2, gridH - 6, 5, 5, "F");
    }
    // Arrow between the calculation steps.
    // (Drawn, not a "→" glyph: the built-in PDF fonts have no arrow.)
    if (i > 0) {
      doc.setDrawColor(170, 180, 195);
      doc.setLineWidth(1.2);
      doc.line(cx - 16, y + 23, cx - 12, y + 27);
      doc.line(cx - 12, y + 27, cx - 16, y + 31);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(label.toUpperCase(), cx, y + 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    if (last && differs) doc.setTextColor(146, 64, 14);
    else if (last) doc.setTextColor(POS_STRONG[0], POS_STRONG[1], POS_STRONG[2]);
    else doc.setTextColor(30);
    doc.text(value || "—", cx, y + 35);
  });

  if (wrapped.length) {
    doc.setDrawColor(CELL_BORDER[0], CELL_BORDER[1], CELL_BORDER[2]);
    doc.line(x + padX, y + gridH + 4, x + w - padX, y + gridH + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    wrapped.forEach((line, i) => doc.text(line, x + padX, y + gridH + 18 + i * 12));
  }

  L.state.y = y + height + 14;
}

export interface RecheckPumpCard {
  model: string;
  /** e.g. "Confirmed", "Not Tested" */
  badges: string[];
  /** Label/value cells, in card order (Stage, Head, Qth, RPM, …). */
  fields: [string, string][];
  /** "Horizontal Standard · BK · MS" — pump type · AG/BK · seal. */
  typeLine?: string;
}

// A card like the Live Recommendation one: model + badges, then the figures
// in a 4-column grid of small label over bold value.
function drawPumpCard(doc: jsPDF, L: Layout, card: RecheckPumpCard): void {
  const cols = 4;
  const rows = Math.ceil(card.fields.length / cols);
  const cellH = 34;
  const padX = 14;
  const headerH = 34;
  const typeH = card.typeLine ? 20 : 0;
  const height = headerH + rows * cellH + typeH + 10;
  L.ensureSpace(L.BAND_HEIGHT + height + 16);
  L.drawSectionBand("Selected Pump");

  const x = L.margin;
  const y = L.state.y + 8;
  const w = L.contentWidth;

  // Card body with a green accent edge (the confirmed pick).
  doc.setFillColor(247, 250, 252);
  doc.setDrawColor(CELL_BORDER[0], CELL_BORDER[1], CELL_BORDER[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, height, 6, 6, "FD");
  doc.setFillColor(POS_STRONG[0], POS_STRONG[1], POS_STRONG[2]);
  doc.rect(x, y + 6, 3, height - 12, "F");

  // Model + badges
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 40, 80);
  doc.text(card.model, x + padX, y + 23);
  let bx = x + w - padX;
  doc.setFontSize(8);
  for (const badge of [...card.badges].reverse()) {
    const tw = doc.getTextWidth(badge) + 12;
    bx -= tw;
    const warn = /not tested/i.test(badge);
    if (warn) doc.setFillColor(254, 243, 199);
    else doc.setFillColor(POS_SOFT[0], POS_SOFT[1], POS_SOFT[2]);
    doc.roundedRect(bx, y + 11, tw, 15, 7, 7, "F");
    if (warn) doc.setTextColor(146, 64, 14);
    else doc.setTextColor(POS_STRONG[0], POS_STRONG[1], POS_STRONG[2]);
    doc.text(badge, bx + 6, y + 21.5);
    bx -= 6;
  }

  // Divider
  doc.setDrawColor(CELL_BORDER[0], CELL_BORDER[1], CELL_BORDER[2]);
  doc.line(x + padX, y + headerH, x + w - padX, y + headerH);

  // Figures grid
  const cellW = (w - padX * 2) / cols;
  card.fields.forEach(([label, value], i) => {
    const cx = x + padX + (i % cols) * cellW;
    const cy = y + headerH + Math.floor(i / cols) * cellH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(label.toUpperCase(), cx, cy + 13);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    doc.text(value || "—", cx, cy + 27);
  });

  if (card.typeLine) {
    const ty = y + headerH + rows * cellH + 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(card.typeLine, x + padX, ty);
  }

  L.state.y = y + height + 14;
}

// The app's positive green, as on the popup's highlighted capacity row.
const POS_SOFT: RGB = [223, 243, 231];
const POS_STRONG: RGB = [22, 101, 52];

/** The Drive step's Recheck popup as a PDF, downloaded from the Selection
 * Summary: the inputs it used, then capacity and BKW at the drive-achieved
 * pump RPM at both VE limits. Download only — not stored on the tag. */
/** Builds the Recheck PDF. Saves it unless `save: false`; always returns the
 *  file so the caller can preview it first. */
export async function downloadRecheckPdf(
  input: RecheckPdfInput,
  opts: { save?: boolean } = {},
): Promise<{ filename: string; blob: Blob }> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = createLayout(doc);
  const { tables } = input;

  await drawReportHeader(doc, L, {
    title: "Recheck at Final Selected RPM",
    projectLine: projectLineOf(input),
    generatedBy: input.generatedBy,
  });

  doc.setFontSize(9.5);
  doc.setTextColor(90);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Delivered capacity & BKW recomputed at the drive-achieved pump RPM.",
    L.margin,
    L.state.y,
  );
  L.state.y += 14;

  if (input.pumpCard) drawPumpCard(doc, L, input.pumpCard);
  if (input.motorRating) drawMotorRatingCard(doc, L, input.motorRating);

  // Inputs: the two-column label/value grid every other section uses. A note
  // ("at selected head 26 MWC") rides along in brackets, as in the popup.
  L.drawSectionBand("Inputs");
  L.drawTable(
    tables.inputs.map((r): [string, string] => [r.label, r.note ? `${r.value}  (${r.note})` : r.value]),
  );

  // Results: one row per figure, a column per VE limit.
  L.ensureSpace(L.BAND_HEIGHT + 110);
  L.drawSectionBand("Results at Final RPM");
  const fmt = (n: number, unit?: string) => `${fmtRecheckNum(n)}${unit ? ` ${unit}` : ""}`;
  autoTable(doc, {
    startY: L.state.y,
    margin: { left: L.margin, right: L.margin },
    head: [["At VE", tables.hiHeading, tables.loHeading]],
    body: tables.outputs.map((r) => [r.label, fmt(r.hi, r.unit), fmt(r.lo, r.unit)]),
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
    headStyles: { fillColor: [235, 238, 243], textColor: 60, fontStyle: "bold" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: L.contentWidth - 2 * 120 },
      1: { halign: "right", cellWidth: 120 },
      2: { halign: "right", cellWidth: 120 },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
      if (data.section === "body" && tables.outputs[data.row.index]?.highlight) {
        data.cell.styles.fillColor = POS_SOFT;
        data.cell.styles.textColor = POS_STRONG;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L.state.y = (doc as any).lastAutoTable.finalY + 14;

  // On a VFD the pump runs across a speed range, so the same figures are
  // reported at both ends of it.
  if (tables.vfd) {
    L.ensureSpace(L.BAND_HEIGHT + 110);
    L.drawSectionBand("On VFD — Hz Range");
    autoTable(doc, {
      startY: L.state.y,
      margin: { left: L.margin, right: L.margin },
      head: [["At frequency", tables.vfd.minHeading, tables.vfd.maxHeading]],
      body: tables.vfd.rows.map((r) => [r.label, r.min, r.max]),
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
      headStyles: { fillColor: [235, 238, 243], textColor: 60, fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: L.contentWidth - 2 * 120 },
        1: { halign: "right", cellWidth: 120 },
        2: { halign: "right", cellWidth: 120 },
      },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
        // The speed line is what the two capacities follow from.
        if (data.section === "body" && tables.vfd?.rows[data.row.index]?.label === "Pump RPM") {
          data.cell.styles.fillColor = POS_SOFT;
          data.cell.styles.textColor = POS_STRONG;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L.state.y = (doc as any).lastAutoTable.finalY + 14;
  }

  drawFooter(doc, L, "Recheck of the confirmed pump at the drive-achieved RPM.");

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `Recheck-${safeSlug(input.projectCode) || "project"}-${dateSlug}.pdf`;
  if (opts.save !== false) doc.save(filename);
  return { filename, blob: doc.output("blob") };
}

// --- Combined enquiry document (all tags / liquids in one sheet) ------------

export interface EnquiryDocumentTag {
  tagName: string;
  /** Shown on the tag divider bar, when known (from the tag's Liquid
   * Parameters). */
  liquid?: string;
  pumpType?: string;
  pumpFields: SelectionSummaryPdfField[];
  sections: SelectionSummaryPdfSection[];
}

export interface EnquiryDocumentPdfInput {
  projectCode: string;
  projectName?: string;
  customerName?: string;
  generatedBy?: string;
  tags: EnquiryDocumentTag[];
}

// --- Columnar matrix (one column per tag / liquid) --------------------------

export interface EnquiryMatrixRow {
  label: string;
  /** One value per tag, in tag order; "" when that tag has no value. */
  values: string[];
}
export interface EnquiryMatrixSection {
  title: string;
  rows: EnquiryMatrixRow[];
}
export interface EnquiryMatrix {
  tags: { name: string; liquid?: string; pumpType?: string }[];
  sections: EnquiryMatrixSection[];
}

/** Pivots the per-tag reports into the Risansi quotation matrix: parameters
 * (grouped into their sections) as rows, one column per tag. Section order and
 * row order follow first-seen across the tags, so a parameter present on any
 * tag gets a row (blank for tags that don't have it). Used by both the PDF and
 * the on-screen document so they stay identical. */
export function buildEnquiryMatrix(tags: EnquiryDocumentTag[]): EnquiryMatrix {
  // Each tag as an ordered list of { section title, [label,value] items }. A
  // non-empty pumpFields becomes a leading "Pump Selection" section.
  const perTag = tags.map((t) => {
    const secs: { title: string; items: SelectionSummaryPdfField[] }[] = [];
    if (filledRows(t.pumpFields).length > 0) {
      secs.push({ title: "Pump Selection", items: t.pumpFields });
    }
    for (const s of t.sections) secs.push({ title: s.title, items: s.items });
    return secs;
  });

  // Section titles in first-seen order across all tags.
  const sectionOrder: string[] = [];
  for (const secs of perTag) {
    for (const s of secs) if (!sectionOrder.includes(s.title)) sectionOrder.push(s.title);
  }

  const sections: EnquiryMatrixSection[] = [];
  for (const title of sectionOrder) {
    const labelOrder: string[] = [];
    // Per-tag label -> value map for this section (only non-empty values kept).
    const maps: Map<string, string>[] = perTag.map((secs) => {
      const map = new Map<string, string>();
      for (const s of secs) {
        if (s.title !== title) continue;
        for (const [label, value] of s.items) {
          if (!labelOrder.includes(label)) labelOrder.push(label);
          const v = value == null ? "" : String(value).trim();
          if (v !== "") map.set(label, v);
        }
      }
      return map;
    });
    const rows: EnquiryMatrixRow[] = [];
    for (const label of labelOrder) {
      const values = maps.map((m) => m.get(label) ?? "");
      if (values.some((v) => v !== "")) rows.push({ label, values });
    }
    if (rows.length > 0) sections.push({ title, rows });
  }

  // Identify each tag column with a "Tag" row at the very top of the first
  // section (like the quotation's "Tag No." row), rather than a column header -
  // the liquid and pump type already have their own rows below.
  if (sections.length > 0) {
    sections[0].rows.unshift({ label: "Tag", values: tags.map((t) => t.tagName) });
  }

  return {
    tags: tags.map((t) => ({ name: t.tagName, liquid: t.liquid, pumpType: t.pumpType })),
    sections,
  };
}

/** One document covering every confirmed tag in an enquiry, laid out as the
 * Risansi technical-quotation matrix: parameters down the side, one column per
 * tag (liquid), section header bands spanning all columns. Landscape once there
 * are more than two tags, so the columns have room. */
export async function downloadEnquiryDocumentPdf(
  input: EnquiryDocumentPdfInput,
): Promise<SelectionSummaryPdfResult> {
  const matrix = buildEnquiryMatrix(input.tags);
  const nTags = matrix.tags.length;
  const landscape = nTags > 2;
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: landscape ? "landscape" : "portrait",
  });
  const L = createLayout(doc);

  await drawReportHeader(doc, L, {
    title: "Enquiry Technical Quotation",
    projectLine: projectLineOf(input),
    generatedBy: input.generatedBy,
  });

  const colCount = 1 + nTags;
  const labelW = Math.min(150, L.contentWidth / colCount + 40);
  const tagW = (L.contentWidth - labelW) / Math.max(nTags, 1);

  const bandCell = (content: string, colSpan: number) => ({
    content,
    colSpan,
    styles: {
      fillColor: SECTION_BAND,
      textColor: BAND_TEXT,
      fontStyle: "bold" as const,
      halign: "center" as const,
    },
  });

  // Body: a full-width section band row, then that section's parameter rows.
  // The first row of the first section is the "Tag" identity row (see
  // buildEnquiryMatrix), so no column header is needed.
  const body: RowInput[] = [];
  for (const section of matrix.sections) {
    body.push([bandCell(section.title.toUpperCase(), colCount)]);
    for (const row of section.rows) {
      body.push([
        { content: row.label, styles: { fontStyle: "bold" } },
        ...row.values.map((v) => ({ content: v, styles: { halign: "center" as const } })),
      ]);
    }
  }

  autoTable(doc, {
    startY: L.state.y,
    margin: { left: L.margin, right: L.margin },
    body,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: CELL_BORDER,
      lineWidth: 0.5,
      valign: "top",
      overflow: "linebreak",
      textColor: 40,
    },
    columnStyles: {
      0: { cellWidth: labelW, fontStyle: "bold" },
      ...Object.fromEntries(matrix.tags.map((_, i) => [i + 1, { cellWidth: tagW }])),
    },
  });

  drawFooter(doc, L);

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `Enquiry-Quotation-${safeSlug(input.projectCode) || "enquiry"}-${dateSlug}.pdf`;
  doc.save(filename);

  return { filename, bytes: doc.output("arraybuffer") };
}
