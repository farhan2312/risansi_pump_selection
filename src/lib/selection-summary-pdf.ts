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

function drawFooter(doc: jsPDF, L: Layout) {
  const { pageWidth, pageHeight, margin } = L;
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
  doc.save(filename);

  return { filename, bytes: doc.output("arraybuffer") };
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
