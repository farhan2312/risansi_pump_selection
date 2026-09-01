"use client";

import { useEffect, useRef, useState } from "react";
import "./CreateProjectModal.css";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { searchClients, type ClientLookupRow } from "../../services/clientsService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to an error message to show inline, or null on success. */
  onCreate: (project: {
    projectCode: string;
    name: string;
    clientCode: string;
    industry: string;
  }) => Promise<string | null>;
};

// House prefix for enquiry numbers: RIL/EN/<indian-fiscal-year>/<suffix>.
// Indian fiscal year runs April to March, so Aug 2026 sits in FY 26-27, and
// Jan/Feb/Mar 2027 still sits there too (only Apr 2027 rolls to 27-28).
export function enquiryPrefix(now: Date = new Date()): string {
  const start = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `RIL/EN/${yy(start)}-${yy(start + 1)}/`;
}

// Shorter than the typical typing cadence, long enough that a full client name
// costs one request rather than one per keystroke.
const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

const CreateProjectModal = ({ isOpen, onClose, onCreate }: Props) => {
  const [enquiryNo, setEnquiryNo] = useState<string>(() => enquiryPrefix());
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Client lookup (Market Intell client master, read-only) ---
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<ClientLookupRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  // Set once a row is picked, so the picked row's summary replaces the result
  // list instead of the list reappearing under the (now filled) fields.
  const [picked, setPicked] = useState<ClientLookupRow | null>(null);
  const reqId = useRef(0);

  // Refresh the prefix each time the modal opens - covers the rare Apr-1
  // rollover mid-session, and resets the field after a cancelled attempt.
  // If the user is mid-edit with a value that extends the prefix, keep it.
  useEffect(() => {
    if (!isOpen) return;
    const fresh = enquiryPrefix();
    setEnquiryNo((v) => (v && v.startsWith(fresh) ? v : fresh));
    setError("");
  }, [isOpen]);

  // Fire one search per typing pause. `reqId` drops out-of-order responses so
  // a slow earlier request cannot overwrite the newest results.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!isOpen || picked || q.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    const id = ++reqId.current;
    setSearching(true);
    setSearchError("");
    searchClients(q)
      .then((rows) => {
        if (id !== reqId.current) return;
        setResults(rows);
        setSearching(false);
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setResults([]);
        setSearching(false);
        setSearchError("Client lookup is unavailable right now.");
      });
  }, [debouncedQuery, isOpen, picked]);

  if (!isOpen) return null;

  const currentPrefix = enquiryPrefix();

  const handleSelect = (row: ClientLookupRow) => {
    setClientCode(row.code);
    setClientName(row.legal_name);
    setIndustry(row.industry ?? "");
    setPicked(row);
    setResults([]);
    setQuery("");
    setError("");
  };

  // Clearing the pick leaves the fields as they are (still editable) and lets
  // the search box work again.
  const handleClearPick = () => {
    setPicked(null);
    setQuery("");
  };

  const handleCreate = async () => {
    if (saving) return;
    const trimmed = enquiryNo.trim();
    if (!trimmed) {
      setError("Enquiry no. is required.");
      return;
    }
    // Reject just-the-prefix - the suffix identifies the actual enquiry.
    if (trimmed === currentPrefix.trim() || trimmed === currentPrefix.slice(0, -1)) {
      setError("Add an enquiry suffix after the prefix.");
      return;
    }
    setError("");
    setSaving(true);
    const msg = await onCreate({
      projectCode: trimmed,
      name: clientName,
      clientCode,
      industry,
    });
    setSaving(false);
    // A message means it failed (e.g. duplicate Enquiry no.); keep the modal
    // open so the user can fix it. null means success - the parent closes it.
    if (msg) setError(msg);
  };

  const showNoMatch =
    !searching &&
    !searchError &&
    !picked &&
    debouncedQuery.trim().length >= MIN_QUERY &&
    results.length === 0;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Create New Enquiry</h2>

        <div className="modal-form">
          <div className="form-group">
            <label>Enquiry no. *</label>
            <input
              value={enquiryNo}
              autoFocus
              placeholder={`${currentPrefix}001`}
              onFocus={(e) => {
                // Drop the caret at the end so the user types the suffix
                // without having to click past the prefix themselves.
                const el = e.currentTarget;
                requestAnimationFrame(() => {
                  try {
                    el.setSelectionRange(el.value.length, el.value.length);
                  } catch {
                    // setSelectionRange is unsupported on some input types;
                    // the field still accepts input, so ignore silently.
                  }
                });
              }}
              onChange={(e) => setEnquiryNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <p className="modal-hint">
              Prefilled with the current fiscal-year prefix. Type the suffix
              after the trailing slash - the full string is what gets saved.
            </p>
          </div>

          <div className="form-group">
            <label>Find client</label>
            {picked ? (
              <div className="client-picked">
                <div className="client-picked-main">
                  <span className="client-picked-code">{picked.code}</span>
                  <span className="client-picked-name">{picked.legal_name}</span>
                  <span className="client-picked-industry">
                    {picked.industry || "-"}
                  </span>
                </div>
                <button
                  type="button"
                  className="client-change-btn"
                  onClick={handleClearPick}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={query}
                  placeholder="Type client code or client name..."
                  onChange={(e) => setQuery(e.target.value)}
                />
                <p className="modal-hint">
                  Searches the client master. Pick a result to prefill the
                  fields below, or just fill them in manually.
                </p>
              </>
            )}

            {!picked &&
              (searching || searchError || showNoMatch || results.length > 0) && (
                <div className="client-results">
                  {searching && <div className="client-results-msg">Searching...</div>}
                  {searchError && (
                    <div className="client-results-msg client-results-error">
                      {searchError}
                    </div>
                  )}
                  {showNoMatch && (
                    <div className="client-results-msg">
                      No client matches that code or name.
                    </div>
                  )}
                  {!searching &&
                    results.map((row) => (
                      <div className="client-result" key={row.code}>
                        <div className="client-result-main">
                          <span className="client-result-code">{row.code}</span>
                          <span className="client-result-name">{row.legal_name}</span>
                          <span className="client-result-industry">
                            {row.industry || "-"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="client-select-btn"
                          onClick={() => handleSelect(row)}
                        >
                          Select
                        </button>
                      </div>
                    ))}
                </div>
              )}
          </div>

          <div className="form-group">
            <label>Client Name</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Client code</label>
            <input
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Industry</label>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>

          <button className="create-btn" onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;
