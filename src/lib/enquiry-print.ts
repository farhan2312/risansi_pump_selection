/**
 * Opens the browser's own print dialog for the enquiry Technical Quotation.
 *
 * Why a hidden iframe rather than window.open: popup blockers routinely kill
 * `window.open` prints, and printing the live page would drag in the app's
 * chrome and modal styling. An iframe on the same origin is never blocked and
 * gives us a clean document we fully control.
 *
 * Deliberately does NOT set `@page { size: … }`. Fixing the size there locks
 * the paper choice in Chrome, and the whole point of using the native dialog
 * is that the user picks page size, orientation, page range and "Save as PDF"
 * themselves.
 */
import type { EnquiryMatrix } from "./selection-summary-pdf";

export interface EnquiryPrintMeta {
  projectCode: string;
  projectName?: string | null;
  clientCode?: string | null;
  generatedBy?: string | null;
}

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The printable document, as a standalone HTML string. Exported so the
 * layout can be rendered and checked without driving the print dialog. */
export function buildEnquiryPrintHtml(meta: EnquiryPrintMeta, matrix: EnquiryMatrix): string {
  const cols = matrix.tags.length + 1;
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const body = matrix.sections
    .map((section) => {
      const band = `<tr class="band"><td colspan="${cols}">${esc(
        section.title.toUpperCase(),
      )}</td></tr>`;
      const rows = section.rows
        .map(
          (r) =>
            `<tr><th scope="row">${esc(r.label)}</th>${r.values
              .map((v) => `<td>${esc(v || "-")}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      return band + rows;
    })
    .join("");

  const subtitle = [meta.projectName, meta.clientCode].filter(Boolean).map(esc).join(" &middot; ");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(meta.projectCode)} - Technical Quotation</title>
<style>
  /* Margins only - paper size and orientation stay the user's choice in the
     print dialog. */
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  /* Force a light document: the quotation is always printed on white, and
     without this an OS/browser in dark mode renders dark text on a dark
     canvas (and would carry that into the PDF, since colours are honoured). */
  html { color-scheme: light; }
  body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 10px; }
  .head h1 { margin: 0; font-size: 15pt; }
  .head p { margin: 3px 0 0; font-size: 9pt; color: #444; }
  .head .meta { text-align: right; font-size: 8.5pt; color: #555; white-space: nowrap; }
  .logo { height: 34px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; background: #fff; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: center; vertical-align: top; word-wrap: break-word; background: #fff; color: #1a1a1a; }
  th[scope="row"] { text-align: left; font-weight: bold; background: #f3f4f6; width: 165px; }
  tr.band td { background: #3c3c3c; color: #fff; font-weight: bold; letter-spacing: .05em; text-align: center; }
  /* Keep a row intact across a page break; the header band repeats. */
  tr { page-break-inside: avoid; break-inside: avoid; }
  .foot { margin-top: 8px; font-size: 7.5pt; color: #666; }
</style></head>
<body>
  <div class="head">
    <div>
      <img class="logo" src="/logo.png" alt="" onerror="this.style.display='none'">
      <h1>${esc(meta.projectCode)} &mdash; Technical Quotation</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </div>
    <div class="meta">
      Generated: ${esc(dateStr)}${meta.generatedBy ? `<br>by ${esc(meta.generatedBy)}` : ""}
    </div>
  </div>
  <table><tbody>${body}</tbody></table>
  <div class="foot">Pump selection confirmed by the assigned engineer.</div>
</body></html>`;
}

/** Renders the quotation into an off-screen iframe and opens the print
 * dialog. Resolves once the dialog has been dismissed (or immediately on
 * browsers that don't block on print). */
export function printEnquiryDocument(
  meta: EnquiryPrintMeta,
  matrix: EnquiryMatrix,
): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    // Off-screen rather than display:none - a hidden frame prints blank in
    // some browsers.
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;";
    document.body.appendChild(frame);

    const cleanup = () => {
      // Give the print job time to spool before tearing the frame down.
      setTimeout(() => {
        frame.remove();
        resolve();
      }, 500);
    };

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      // Let the logo (and layout) settle before the dialog opens.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          // Printing unavailable (e.g. blocked) - fall through to cleanup so
          // the frame never leaks.
        }
        cleanup();
      }, 250);
    };

    const doc = frame.contentDocument;
    if (!doc) {
      cleanup();
      return;
    }
    doc.open();
    doc.write(buildEnquiryPrintHtml(meta, matrix));
    doc.close();
  });
}
