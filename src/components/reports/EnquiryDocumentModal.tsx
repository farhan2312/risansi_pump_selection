"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// Global stylesheet carrying the summary-modal-* classes this modal's frame
// renders with. Imported here rather than by each page so the styles travel
// with the component — it's used from both Reports and Enquiries.
import "../../screens/selection-summary/SelectionSummaryPage.css";
import EmptyState from "../ui/EmptyState";
import Spinner from "../ui/Spinner";
import {
  EMPTY_TECH_DOC_CONFIG,
  TECH_DOC_SECTIONS,
  buildTechDocHtml,
  techDocGroupLabel,
  techDocExtrasFor,
  techDocGroups,
  techDocSheet,
  type TechDocConfig,
  type TechDocData,
  type TechDocGroup,
} from "../../lib/tech-doc";
import TechDocEditor from "./TechDocEditor";
import { downloadTechDocExcel } from "../../lib/tech-doc-excel";
import { printHtml } from "../../lib/enquiry-print";
import { getEnquiryDocument, saveEnquiryDocumentConfig } from "../../services/enquiryDocumentService";

export interface EnquiryDocumentSource {
  projectId: string;
  projectCode: string;
  projectName?: string | null;
}

/**
 * The enquiry's Technical Data Sheet — the Risansi quotation format, one column
 * per confirmed tag (lib/tech-doc.ts). Per enquiry, rows can be added from the
 * optional list ("Add parameters"), removed, renamed, have values edited, or be
 * typed in by hand ("Edit rows") — saved in projects.tech_doc_config, never
 * touching the wizard data. The preview is the exact HTML that prints.
 *
 * Shown from both the Reports page and the Enquiries page.
 */
const EnquiryDocumentModal = ({ source, onClose }: { source: EnquiryDocumentSource; onClose: () => void }) => {
  const [data, setData] = useState<TechDocData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One sheet per drive group, each with its own edits.
  const [configs, setConfigs] = useState<Record<string, TechDocConfig>>({});
  const [activeGroup, setActiveGroup] = useState<TechDocGroup | null>(null);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [showPicker, setShowPicker] = useState(false);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const [printing, setPrinting] = useState(false);
  // Pending save per group, so switching tabs never drops another group's edit.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;
    getEnquiryDocument(source.projectId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setConfigs(d.configs);
      })
      .catch(() => !cancelled && setError("Couldn't load the enquiry document."));
    return () => {
      cancelled = true;
    };
  }, [source.projectId]);

  useEffect(() => () => Object.values(saveTimers.current).forEach(clearTimeout), []);

  const groups = data ? techDocGroups(data) : [];
  const group: TechDocGroup | null = activeGroup && groups.includes(activeGroup) ? activeGroup : (groups[0] ?? null);
  const config = (group && configs[group]) || EMPTY_TECH_DOC_CONFIG;

  // Every change applies to the sheet at once and is saved shortly after
  // (typing in the editor doesn't fire a request per keystroke).
  const updateConfig = (next: TechDocConfig) => {
    if (!group) return;
    const g = group;
    setConfigs((m) => ({ ...m, [g]: next }));
    setSaveState("saving");
    clearTimeout(saveTimers.current[g]);
    saveTimers.current[g] = setTimeout(() => {
      saveEnquiryDocumentConfig(source.projectId, g, next)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
  };
  const toggleExtra = (key: string) => {
    const on = config.extras.includes(key);
    updateConfig({
      ...config,
      extras: on ? config.extras.filter((k) => k !== key) : [...config.extras, key],
      // Adding an optional row back also un-removes it.
      hidden: on ? config.hidden : config.hidden.filter((k) => k !== key),
    });
  };
  const customised =
    config.hidden.length + Object.keys(config.labels).length + Object.keys(config.values).length + config.custom.length > 0;
  const resetAll = () => updateConfig({ ...EMPTY_TECH_DOC_CONFIG, extras: config.extras });

  const doc = useMemo(
    () => (data && group ? techDocSheet({ ...data, configs }, group) : null),
    [data, configs, group],
  );
  const html = useMemo(
    () => (doc ? buildTechDocHtml(doc, typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png") : ""),
    [doc],
  );
  const isLoading = data === null && error === null;
  const hasTags = (doc?.tags.length ?? 0) > 0;

  const handlePrint = async () => {
    if (!html) return;
    setPrinting(true);
    try {
      await printHtml(html);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div className="summary-modal summary-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="summary-modal-header">
          <div>
            <h3>
              {source.projectCode} <span className="summary-modal-tag">· Technical Data Sheet</span>
            </h3>
            <p>
              {source.projectName || "—"}
              {data ? ` · ${data.tags.length} confirmed tag${data.tags.length === 1 ? "" : "s"}` : ""}
              {groups.length > 1 ? ` · ${groups.length} drive groups, one sheet each` : ""}
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
          {!isLoading && !error && !hasTags && (
            <EmptyState
              compact
              icon="alert"
              title="No document available yet"
              description="No tag on this enquiry has a confirmed selection yet. Confirm a pump on the last wizard step to build the data sheet."
            />
          )}

          {!isLoading && !error && hasTags && (
            <div className="flex flex-col gap-3">
              {groups.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Drive system">
                  {groups.map((g) => {
                    const n = data ? techDocSheet(data, g).tags.length : 0;
                    return (
                      <button
                        key={g}
                        type="button"
                        role="tab"
                        aria-selected={g === group}
                        onClick={() => setActiveGroup(g)}
                        className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${
                          g === group ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper text-fg-2 hover:border-accent"
                        }`}
                      >
                        {techDocGroupLabel(g)}
                        {g !== "NONE" && data?.mixed && <span className="ml-1 font-mono text-[11px] opacity-75">/{g}</span>}
                        <span className="ml-1.5 font-normal opacity-75">· {n} tag{n === 1 ? "" : "s"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-line bg-sunk p-0.5" role="tablist">
                  {(["preview", "edit"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={mode === m}
                      onClick={() => setMode(m)}
                      className={`rounded-md px-3 py-1 text-[12.5px] font-semibold ${
                        mode === m ? "bg-paper text-fg shadow-sm" : "text-fg-3 hover:text-fg"
                      }`}
                    >
                      {m === "preview" ? "Preview" : "Edit rows"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-fg-2 hover:border-accent hover:text-accent"
                  aria-expanded={showPicker}
                >
                  {showPicker ? "Hide parameters" : "Add parameters"}
                  {config.extras.length > 0 && (
                    <span className="rounded-full bg-accent-soft px-1.5 text-[11px] text-accent">{config.extras.length}</span>
                  )}
                </button>
                {customised && (
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-neg hover:bg-[var(--neg-soft)]"
                    title="Undo every removal, rename, edited value and manual row"
                  >
                    Reset edits
                  </button>
                )}
                <span className="text-[12px] text-fg-3">
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved for this enquiry"
                      : saveState === "error"
                        ? "Couldn't save — the changes still apply for now"
                        : mode === "edit"
                          ? "Rename, edit, remove or add rows — saved for this enquiry."
                          : "Add optional rows, or switch to Edit rows to change the sheet."}
                </span>
              </div>

              {showPicker && (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-sunk p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TECH_DOC_SECTIONS.map((section) => {
                    const fields = techDocExtrasFor(doc?.tags ?? []).filter((f) => f.section === section);
                    if (fields.length === 0) return null;
                    return (
                      <fieldset key={section} className="min-w-0">
                        <legend className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
                          {section}
                        </legend>
                        <div className="flex flex-col gap-1">
                          {fields.map((f) => (
                            <label key={f.key} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-fg">
                              <input
                                type="checkbox"
                                checked={config.extras.includes(f.key)}
                                onChange={() => toggleExtra(f.key)}
                                className="h-3.5 w-3.5 accent-[var(--brand-blue)]"
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
              )}

              {mode === "edit" && doc ? (
                <div className="max-h-[68vh] overflow-y-auto pr-1">
                  <TechDocEditor tags={doc?.tags ?? []} config={config} onChange={updateConfig} />
                </div>
              ) : (
                /* The printable sheet itself, so what you see is what prints. */
                <iframe
                  title="Technical Data Sheet"
                  srcDoc={html}
                  className="h-[68vh] w-full rounded-lg border border-line bg-white"
                />
              )}
            </div>
          )}
        </div>

        <div className="summary-modal-footer">
          {/* Native print dialog - the user picks paper size, orientation,
              page range and "Save as PDF". */}
          <button className="summary-download-btn" onClick={handlePrint} disabled={printing || !hasTags}>
            {printing ? "Preparing…" : "Print / Save as PDF"}
          </button>
          <button className="summary-modal-close-btn" onClick={() => doc && downloadTechDocExcel(doc)} disabled={!hasTags}>
            Download Excel
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
