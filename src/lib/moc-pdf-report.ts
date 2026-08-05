/**
 * Client-side PDF export for the MOC AI Recommendation report — company
 * logo + generated date, process data, the AI's summary/sealing/alternatives
 * narrative, and a component-by-component table (AI pick vs. the engineer's
 * manual selection + remarks). Pure client-side (jsPDF + jspdf-autotable, no
 * server round-trip) so it can run from a "use client" step component.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MocComponentSuggestions } from "../services/mocRecommendationService";

export interface MocPdfComponentRow {
  label: string;
  aiPick: string;
  manualPick: string;
  remarks: string;
}

export interface MocPdfInput {
  media: string;
  ph?: string;
  temperatureC?: string;
  viscosityCp?: string;
  sg?: string;
  capacity?: string;
  capacityUnit?: string;
  solidPct?: string;
  solidSize?: string;
  solidType?: string;
  suggestion: MocComponentSuggestions;
  components: MocPdfComponentRow[];
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

const POS_GREEN: [number, number, number] = [5, 150, 105];

export async function downloadMocReportPdf(input: MocPdfInput): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = 40;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // --- Header: logo, company name, generated date ---
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
  y += 55;

  doc.setFontSize(17);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("MOC & Sealing Recommendation Report", margin, y);
  y += 6;
  doc.setDrawColor(210);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // --- Process data ---
  const allProcRows: [string, string][] = [
    ["Media / Application", input.media],
    ["pH", input.ph ?? ""],
    ["Temperature", input.temperatureC ? `${input.temperatureC} °C` : ""],
    ["Viscosity", input.viscosityCp ? `${input.viscosityCp} cP` : ""],
    ["Specific Gravity", input.sg ?? ""],
    [
      "Flow Rate",
      input.capacity ? `${input.capacity} ${input.capacityUnit ?? ""}`.trim() : "",
    ],
    ["Solids", input.solidPct ? `${input.solidPct}%` : ""],
    [
      "Particle Size",
      input.solidSize
        ? `${input.solidSize} mm${input.solidType ? ` (${input.solidType})` : ""}`
        : "",
    ],
  ];
  const procRows = allProcRows.filter(([, v]) => v !== "");

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: procRows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: 40 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 140 } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 20;

  // --- Summary ---
  const section = (title: string, body: string) => {
    ensureSpace(50);
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 15;
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.setFont("helvetica", "normal");
    const lines: string[] = doc.splitTextToSize(body || "—", pageWidth - margin * 2);
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
    }
    y += 10;
  };

  section("Summary", input.suggestion.summary);

  ensureSpace(30);
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("Recommended Sealing", margin, y);
  y += 15;
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...POS_GREEN);
  doc.text(input.suggestion.sealRecommendation || "—", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  const sealLines: string[] = doc.splitTextToSize(
    input.suggestion.sealRationale || "",
    pageWidth - margin * 2,
  );
  for (const line of sealLines) {
    ensureSpace(14);
    doc.text(line, margin, y);
    y += 13;
  }
  y += 10;

  section("Alternatives Considered", input.suggestion.alternatives);

  // --- Component table ---
  ensureSpace(60);
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.text("Material of Construction — Component Detail", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Component", "AI Recommendation", "Manual Selection", "Remarks"]],
    body: input.components.map((c) => [
      c.label,
      c.aiPick || "—",
      c.manualPick || "—",
      c.remarks || "—",
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: POS_GREEN, textColor: 255 },
    alternateRowStyles: { fillColor: [245, 250, 248] },
  });

  // --- Footer on every page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.setFont("helvetica", "normal");
    doc.text(
      "AI-generated estimate, not a verified specification — review before use.",
      margin,
      pageHeight - 18,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 18, {
      align: "right",
    });
  }

  const safeMedia = input.media.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`MOC-Report-${safeMedia || "media"}-${dateSlug}.pdf`);
}
