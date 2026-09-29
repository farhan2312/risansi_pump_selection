/**
 * The enquiry's Technical Data Sheet as Excel — the same layout as the printed
 * sheet (lib/tech-doc.ts): letterhead lines, title band, client / enquiry /
 * quotation rows, then the section bands and rows, one column per tag.
 */
import { downloadXlsx, type XlsxCell } from "./xlsx";
import { LETTERHEAD, buildTechDoc, techDocFileStem, type TechDocSheet } from "./tech-doc";

const BAND: Partial<XlsxCell> = { fill: "2B2B2B", color: "FFFFFF", bold: true, align: "center" };

export function downloadTechDocExcel(data: TechDocSheet): string {
  const n = Math.max(data.tags.length, 1);
  const width = n + 1;
  const leftSpan = 1 + Math.floor(n / 2);
  const L = LETTERHEAD;

  const rows: XlsxCell[][] = [
    [{ value: `${L.company.toUpperCase()}`, bold: true, colSpan: width }],
    [{ value: `GST: ${L.gst}  |  CIN: ${L.cin}`, colSpan: width }],
    [{ value: `${L.email}  |  ${L.website}  |  ${L.phone}  |  ${L.address}`, colSpan: width }],
    [{ value: `${L.company} - Technical Data Sheet`, colSpan: width, ...BAND }],
    [{ value: `Client Name: ${data.header.clientName}`, colSpan: width, wrap: true }],
    [
      { value: `Enquiry No. & Date: ${data.header.enquiry}`, colSpan: leftSpan, wrap: true },
      { value: `Quotation No. & Date: ${data.header.quotation || "-"}`, colSpan: width - leftSpan, wrap: true },
    ],
  ];

  for (const block of buildTechDoc(data.tags, data.config)) {
    if (block.rows.length === 0) continue;
    rows.push([{ value: block.title, colSpan: width, ...BAND }]);
    for (const r of block.rows) {
      rows.push([
        { value: r.label, bold: true },
        ...r.values.map((v) => ({ value: v || "-", align: "center", wrap: true }) as XlsxCell),
      ]);
    }
  }

  const filename = `${techDocFileStem(data)}.xlsx`;
  downloadXlsx(filename, [
    { name: "Technical Data Sheet", columnWidths: [30, ...Array.from({ length: n }, () => 28)], rows },
  ]);
  return filename;
}
