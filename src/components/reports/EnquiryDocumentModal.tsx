"use client";

import React, { useEffect, useMemo, useState } from "react";
// Global stylesheet carrying the summary-modal-* / summary-doc-* classes this
// modal renders with. Imported here rather than by each page so the styles
// travel with the component — it's used from both Reports and Enquiries.
import "../../screens/selection-summary/SelectionSummaryPage.css";
import EmptyState from "../ui/EmptyState";
import Spinner from "../ui/Spinner";
import { getReportSummary, type ReportSummary } from "../../services/reportsService";
import {
  buildEnquiryMatrix,
  downloadEnquiryDocumentPdf,
  type EnquiryDocumentTag,
  type SelectionSummaryPdfSection,
} from "../../lib/selection-summary-pdf";
import { printEnquiryDocument } from "../../lib/enquiry-print";

/** The minimum a caller has to supply per tag. Deliberately not ReportRecord
 * or TagRecord — the Reports and Enquiries pages hold different shapes, and
 * only these two fields are actually needed. */
export interface DocumentTagRef {
  tagId: string;
  tagName: string;
}

export interface EnquiryDocumentSource {
  projectCode: string;
  projectName?: string | null;
  clientCode?: string | null;
  generatedBy?: string | null;
  tags: DocumentTagRef[];
}

// A saved summary can still carry the retired "Selected Motor" section and the
// Testing rows; drop them so the document matches the current report spec.
function normalizeSections(summary: ReportSummary): SelectionSummaryPdfSection[] {
  return summary.sections
    .filter((s) => s.title !== "Selected Motor")
    .map((s) => ({
      ...s,
      items: s.items.filter(([label]) => !/^testing\b/i.test(label)),
    }));
}

/** Value of the first summary item whose label matches, across all sections —
 * used to pull the liquid / pump type for a tag's column. */
function pickItem(summary: ReportSummary, labelRe: RegExp): string | undefined {
  for (const s of summary.sections) {
    for (const [label, value] of s.items) {
      if (labelRe.test(label) && value && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return undefined;
}

type LoadedTag = { tag: DocumentTagRef; summary: ReportSummary | null };

function loadedToTags(loaded: LoadedTag[]): EnquiryDocumentTag[] {
  return loaded
    .filter((x): x is { tag: DocumentTagRef; summary: ReportSummary } => x.summary != null)
    .map(({ tag, summary }) => ({
      tagName: tag.tagName,
      liquid: pickItem(summary, /^(media|liquid)/i),
      pumpType: pickItem(summary, /pump type/i),
      pumpFields: summary.pumpFields,
      sections: normalizeSections(summary),
    }));
}

/**
 * The enquiry's Technical Quotation: every confirmed tag side by side, one
 * column each, with Print (native dialog — page size / range / Save as PDF)
 * and a fixed-layout PDF download.
 *
 * Shown from both the Reports page and the Enquiries page, so it takes a
 * neutral source shape rather than either page's record type.
 */
const EnquiryDocumentModal = ({
  source,
  onClose,
}: {
  source: EnquiryDocumentSource;
  onClose: () => void;
}) => {
  const [loaded, setLoaded] = useState<LoadedTag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Callers pass `source` as an inline object literal, so its identity changes
  // on every render — keying the fetch on it would re-run forever. The tag ids
  // are what the fetch actually depends on, so key on those instead.
  const tagsKey = source.tags.map((t) => t.tagId).join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      source.tags.map(async (tag) => ({
        tag,
        summary: await getReportSummary(tag.tagId).catch(() => null),
      })),
    )
      .then((rows) => {
        if (!cancelled) setLoaded(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the enquiry document.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsKey]);

  const isLoading = loaded === null && error === null;
  const anySummary = (loaded ?? []).some((x) => x.summary != null);
  const matrix = useMemo(
    () => (loaded ? buildEnquiryMatrix(loadedToTags(loaded)) : null),
    [loaded],
  );

  const handleDownload = async () => {
    if (!loaded) return;
    const tags = loadedToTags(loaded);
    if (tags.length === 0) return;
    setDownloading(true);
    try {
      await downloadEnquiryDocumentPdf({
        projectCode: source.projectCode,
        projectName: source.projectName ?? undefined,
        generatedBy: source.generatedBy ?? undefined,
        tags,
      });
    } finally {
      setDownloading(false);
    }
  };

  // Opens the browser's own print dialog, so page size, orientation, page
  // range and "Save as PDF" are all the user's choice.
  const handlePrint = async () => {
    if (!matrix) return;
    setPrinting(true);
    try {
      await printEnquiryDocument(
        {
          projectCode: source.projectCode,
          projectName: source.projectName,
          clientCode: source.clientCode,
          generatedBy: source.generatedBy,
        },
        matrix,
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div
        className="summary-modal summary-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="summary-modal-header">
          <div>
            <h3>
              {source.projectCode}{" "}
              <span className="summary-modal-tag">· Technical Quotation</span>
            </h3>
            <p>
              {source.projectName || "—"} · {source.tags.length} tag
              {source.tags.length === 1 ? "" : "s"}
            </p>
          </div>
          <button className="summary-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="summary-modal-body">
          {isLoading && (
            <div style={{ padding: "24px 0", textAlign: "center" }}>
              <Spinner caption="Loading document…" />
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          {!isLoading && !error && !anySummary && (
            <EmptyState
              compact
              icon="alert"
              title="No document available yet"
              description="No tag on this enquiry has a confirmed selection yet. Confirm a pump on the last wizard step to build the quotation."
            />
          )}

          {!isLoading && !error && anySummary && matrix && (
            <div className="summary-doc-scroll">
              <table className="summary-doc-matrix">
                <tbody>
                  {matrix.sections.map((section) => (
                    <React.Fragment key={section.title}>
                      <tr>
                        <td
                          className="summary-doc-band"
                          colSpan={matrix.tags.length + 1}
                        >
                          {section.title.toUpperCase()}
                        </td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr key={section.title + row.label}>
                          <th scope="row" className="summary-doc-label">
                            {row.label}
                          </th>
                          {row.values.map((v, i) => (
                            <td key={i}>{v || "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="summary-modal-footer">
          {/* Native print dialog - lets the user pick paper size, orientation,
              page range and "Save as PDF" rather than taking a fixed layout. */}
          <button
            className="summary-download-btn"
            onClick={handlePrint}
            disabled={printing || isLoading || !anySummary}
          >
            {printing ? "Preparing…" : "Print / Save as PDF"}
          </button>
          <button
            className="summary-modal-close-btn"
            onClick={handleDownload}
            disabled={downloading || isLoading || !anySummary}
          >
            {downloading ? "Generating…" : "Download PDF"}
          </button>
          <button className="summary-modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnquiryDocumentModal;
