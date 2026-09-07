/**
 * Excel (.xlsx) exports, mirroring the PDF ones so a report reads the same
 * either way:
 *   - downloadSelectionSummaryExcel  : one tag's Selection Summary
 *   - downloadEnquiryDocumentExcel   : the enquiry's Technical Quotation,
 *                                      one column per tag
 *
 * Both reuse the same inputs and the same matrix builder as the PDF side, so
 * the two formats can't drift apart in content — only in presentation.
 */
import { downloadXlsx, type XlsxCell, type XlsxSheet } from "./xlsx";
import {
  buildEnquiryMatrix,
  type EnquiryDocumentPdfInput,
  type SelectionSummaryPdfInput,
} from "./selection-summary-pdf";

/** Dark section band, matching the PDF's full-width band. */
const BAND: Partial<XlsxCell> = {
  fill: "3C3C3C",
  color: "FFFFFF",
  bold: true,
  align: "center",
};
const LABEL: Partial<XlsxCell> = { bold: true };
const VALUE: Partial<XlsxCell> = { align: "center", wrap: true };

const dateStr = () =>
  new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const safeSlug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
const dateSlug = () => new Date().toISOString().slice(0, 10);

/** Header block shared by both exports: title, project line, generated stamp. */
function headerRows(
  title: string,
  projectLine: string,
  generatedBy: string | undefined,
  width: number,
): XlsxCell[][] {
  const rows: XlsxCell[][] = [
    [{ value: title, bold: true, colSpan: width }],
  ];
  if (projectLine) rows.push([{ value: projectLine, colSpan: width }]);
  rows.push([
    {
      value: `Generated: ${dateStr()}${generatedBy ? ` by ${generatedBy}` : ""}`,
      colSpan: width,
    },
  ]);
  rows.push([]); // spacer
  return rows;
}

function projectLineOf(input: {
  projectCode: string;
  projectName?: string;
  customerName?: string;
}): string {
  return [input.projectCode, input.projectName, input.customerName].filter(Boolean).join("  •  ");
}

/** One tag's Selection Summary — label/value down the page, section by
 * section, the same order the PDF uses. */
export function downloadSelectionSummaryExcel(input: SelectionSummaryPdfInput): string {
  const rows: XlsxCell[][] = headerRows(
    "Pump Selection Summary Report",
    projectLineOf(input),
    input.generatedBy,
    2,
  );

  const filled = (items: SelectionSummaryPdfInput["pumpFields"]) =>
    items.filter(([, v]) => v != null && String(v).trim() !== "");

  const pump = filled(input.pumpFields);
  if (pump.length > 0) {
    rows.push([{ value: "PUMP SELECTION", colSpan: 2, ...BAND }]);
    for (const [label, value] of pump) {
      rows.push([{ value: label, ...LABEL }, { value: String(value), wrap: true }]);
    }
  }

  for (const section of input.sections) {
    const items = filled(section.items);
    if (items.length === 0) continue;
    rows.push([{ value: section.title.toUpperCase(), colSpan: 2, ...BAND }]);
    for (const [label, value] of items) {
      rows.push([{ value: label, ...LABEL }, { value: String(value), wrap: true }]);
    }
  }

  const sheets: XlsxSheet[] = [
    { name: "Selection Summary", columnWidths: [34, 52], rows },
  ];
  const filename = `Selection-Summary-${safeSlug(input.projectCode) || "project"}-${dateSlug()}.xlsx`;
  downloadXlsx(filename, sheets);
  return filename;
}

/** The enquiry's Technical Quotation: parameters down the side, one column per
 * tag — the same matrix the PDF and the on-screen document render. */
export function downloadEnquiryDocumentExcel(input: EnquiryDocumentPdfInput): string {
  const matrix = buildEnquiryMatrix(input.tags);
  const width = matrix.tags.length + 1;

  const rows: XlsxCell[][] = headerRows(
    "Enquiry Technical Quotation",
    projectLineOf(input),
    input.generatedBy,
    width,
  );

  for (const section of matrix.sections) {
    rows.push([{ value: section.title.toUpperCase(), colSpan: width, ...BAND }]);
    for (const row of section.rows) {
      rows.push([
        { value: row.label, ...LABEL },
        ...row.values.map((v) => ({ value: v || "-", ...VALUE }) as XlsxCell),
      ]);
    }
  }

  const sheets: XlsxSheet[] = [
    {
      name: "Technical Quotation",
      columnWidths: [30, ...matrix.tags.map(() => 26)],
      rows,
    },
  ];
  const filename = `Enquiry-Quotation-${safeSlug(input.projectCode) || "enquiry"}-${dateSlug()}.xlsx`;
  downloadXlsx(filename, sheets);
  return filename;
}
