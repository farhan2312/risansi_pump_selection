"use client";

import { useEffect, useMemo, useState } from "react";
import "./PumpModelMasterPage.css";
import {
  createPumpModelRow,
  deletePumpModelRow,
  listPumpModelRows,
  updatePumpModelRow,
  type PumpModelInsert,
  type PumpModelPatch,
  type PumpModelRow,
} from "../../services/pumpModelMasterService";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonRows } from "../../components/ui/Skeleton";
import Spinner from "../../components/ui/Spinner";
import Pagination, { usePagination } from "../../components/ui/Pagination";
import {
  PlusIcon,
  SearchIcon,
  DetailsIcon,
  EditIcon,
  TrashIcon,
  AlertIcon,
} from "../../components/ui/adminIcons";

type FieldDef = { key: keyof PumpModelRow; label: string; numeric: boolean };

// Editable columns, in form/details order. `id` is never editable.
const FIELDS: FieldDef[] = [
  { key: "model", label: "Model", numeric: false },
  { key: "stage", label: "Stage", numeric: true },
  { key: "headMwc", label: "Head (MWC)", numeric: true },
  { key: "voleMin", label: "VOLE Min", numeric: true },
  { key: "voleMax", label: "VOLE Max", numeric: true },
  { key: "mechEff", label: "Mech Eff", numeric: true },
  { key: "qth", label: "QTH", numeric: true },
  { key: "minKwExisting", label: "Min kW Existing", numeric: true },
  { key: "minStartingKwAt1Kg", label: "Min Starting kW @ 1kg", numeric: true },
  { key: "minKwTested", label: "Min kW Tested", numeric: true },
  { key: "minKwToBeTested", label: "Min kW To Be Tested", numeric: true },
  { key: "testingRemarks", label: "Testing Remarks", numeric: false },
  { key: "hardSolidMm", label: "Hard Solid (mm)", numeric: true },
  { key: "softSolidMm", label: "Soft Solid (mm)", numeric: true },
  { key: "sizeVisc0To1000In", label: "Size 0-1000 cP (in)", numeric: true },
  { key: "sizeVisc1000To3000In", label: "Size 1000-3000 cP (in)", numeric: true },
  { key: "sizeVisc3000To5000In", label: "Size 3000-5000 cP (in)", numeric: true },
  { key: "sizeVisc5000To10000In", label: "Size 5000-10000 cP (in)", numeric: true },
  { key: "sizeViscGt10000In", label: "Size >10000 cP (in)", numeric: true },
];

const val = (v: string | number | null) => (v === null || v === "" ? "—" : v);

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
  fallback;

const PumpModelMasterPage = () => {
  const [rows, setRows] = useState<PumpModelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [detailsRow, setDetailsRow] = useState<PumpModelRow | null>(null);
  const [editRow, setEditRow] = useState<PumpModelRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<PumpModelRow | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    listPumpModelRows()
      .then(setRows)
      .catch(() => setError("Couldn't load pump model master data."))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.model.toLowerCase().includes(q) ||
        String(r.headMwc).toLowerCase().includes(q)
    );
  }, [rows, search]);

  // 50 rows/page. Resets to page 1 whenever the search query changes so
  // filtering doesn't strand the user on an empty page beyond the new end.
  const { page, setPage, from, to, pageSize } = usePagination(
    filtered.length,
    search,
    50
  );
  const paged = useMemo(() => filtered.slice(from, to), [filtered, from, to]);

  const handleCreated = (created: PumpModelRow) => {
    setRows((prev) =>
      [...prev, created].sort((a, b) =>
        a.model === b.model
          ? Number(a.headMwc) - Number(b.headMwc)
          : a.model.localeCompare(b.model)
      )
    );
    setCreating(false);
  };

  const handleSaved = (updated: PumpModelRow) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditRow(null);
  };

  const handleDeleted = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDeleteRow(null);
  };

  return (
    <div className="pmm-page">
      <div className="pmm-header">
        <div>
          <h1>Pump Model Master</h1>
          <p>
            Every (model, head-point) row from the pump model master. Edit or delete a
            row, or view its full details.
          </p>
        </div>
        <div className="pmm-header-actions">
          <div className="pmm-search-wrap">
            <span className="pmm-search-icon"><SearchIcon /></span>
            <input
              type="search"
              className="pmm-search"
              placeholder="Search by model or head…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <PlusIcon /> Add Model
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="pmm-panel">
          <div style={{ padding: 16 }}>
            <SkeletonRows rows={8} cols={6} />
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="pmm-form-error"><AlertIcon /><span>{error}</span></div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <EmptyState
          icon="table"
          title="No pump model rows yet"
          description="Add the first row to start populating the pump model master. The recommendation engine reads directly from this table."
          action={
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <PlusIcon /> Add first row
            </button>
          }
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="pmm-panel">
          <div className="pmm-table-wrap">
            <table className="pmm-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Stage</th>
                  <th>Head (MWC)</th>
                  <th>VOLE Min</th>
                  <th>VOLE Max</th>
                  <th>Mech Eff</th>
                  <th>QTH</th>
                  <th>Min kW Tested</th>
                  <th>Remarks</th>
                  <th className="pmm-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id}>
                    <td className="pmm-model">{r.model}</td>
                    <td className="mono">{val(r.stage)}</td>
                    <td className="mono">{val(r.headMwc)}</td>
                    <td className="mono">{val(r.voleMin)}</td>
                    <td className="mono">{val(r.voleMax)}</td>
                    <td className="mono">{val(r.mechEff)}</td>
                    <td className="mono">{val(r.qth)}</td>
                    <td className="mono">{val(r.minKwTested)}</td>
                    <td className="pmm-remarks">{val(r.testingRemarks)}</td>
                    <td>
                      <div className="pmm-row-actions">
                        <button className="pmm-btn" onClick={() => setDetailsRow(r)}>
                          <DetailsIcon /> Details
                        </button>
                        <button className="pmm-btn" onClick={() => setEditRow(r)}>
                          <EditIcon /> Edit
                        </button>
                        <button
                          className="pmm-btn pmm-btn-danger"
                          onClick={() => setDeleteRow(r)}
                        >
                          <TrashIcon /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="pmm-empty-cell">
                      <EmptyState
                        compact
                        icon="search"
                        title={`No rows match “${search}”`}
                        description="Try a different keyword — model name or head value."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {detailsRow && (
        <DetailsModal row={detailsRow} onClose={() => setDetailsRow(null)} />
      )}
      {editRow && (
        <EditModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={handleSaved}
        />
      )}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
      {deleteRow && (
        <DeleteModal
          row={deleteRow}
          onClose={() => setDeleteRow(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
};

// --- Details modal ---------------------------------------------------------

const DetailsModal = ({ row, onClose }: { row: PumpModelRow; onClose: () => void }) => (
  <div className="pmm-modal-overlay" onClick={onClose}>
    <div className="pmm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div className="pmm-modal-header">
        <h3>
          {row.model} · {val(row.headMwc)} MWC
        </h3>
        <button className="pmm-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="pmm-details-grid">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <span>{f.label}</span>
            <strong className={f.numeric ? "mono" : undefined}>{val(row[f.key])}</strong>
          </div>
        ))}
      </div>
      <div className="pmm-modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  </div>
);

// --- Create modal ----------------------------------------------------------

const CreateModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (created: PumpModelRow) => void;
}) => {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, ""]))
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.model.trim()) {
      setFormError("Model can't be empty.");
      return;
    }
    if (form.headMwc.trim() === "" || Number.isNaN(Number(form.headMwc))) {
      setFormError("Head (MWC) is required and must be a number.");
      return;
    }
    setSaving(true);
    setFormError("");
    // Send every field as a raw string — the API's numOrNull/intOrNull handle
    // parsing and null-on-blank server-side, matching the PATCH flow.
    const values: Record<string, string> = { ...form, model: form.model.trim() };
    try {
      const created = await createPumpModelRow(values as unknown as PumpModelInsert);
      onCreated(created);
    } catch (err) {
      setFormError(errorMessage(err, "Couldn't add model."));
      setSaving(false);
    }
  };

  return (
    <div className="pmm-modal-overlay" onClick={onClose}>
      <div
        className="pmm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="pmm-modal-header">
          <h3>Add pump model row</h3>
          <button className="pmm-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleCreate}>
          {formError && (
            <div className="pmm-form-error">
              <AlertIcon /><span>{formError}</span>
            </div>
          )}
          <div className="pmm-form-grid">
            {FIELDS.map((f) => (
              <div key={f.key} className="pmm-field">
                <label>
                  {f.label}
                  {(f.key === "model" || f.key === "headMwc") ? " *" : ""}
                </label>
                <input
                  type={f.numeric ? "number" : "text"}
                  step={f.numeric ? "any" : undefined}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="pmm-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner size="sm" inline />}
              {saving ? "Adding…" : "Add model"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Edit modal ------------------------------------------------------------

const EditModal = ({
  row,
  onClose,
  onSaved,
}: {
  row: PumpModelRow;
  onClose: () => void;
  onSaved: (updated: PumpModelRow) => void;
}) => {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of FIELDS) initial[f.key] = String(row[f.key] ?? "");
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.model.trim()) {
      setFormError("Model can't be empty.");
      return;
    }
    if (form.headMwc.trim() === "" || Number.isNaN(Number(form.headMwc))) {
      setFormError("Head (MWC) is required and must be a number.");
      return;
    }
    setSaving(true);
    setFormError("");
    // Send every editable field (empty numeric/text becomes null server-side).
    const patch: PumpModelPatch = {};
    for (const f of FIELDS) {
      (patch as Record<string, string>)[f.key] = form[f.key];
    }
    try {
      const updated = await updatePumpModelRow(row.id, patch);
      onSaved(updated);
    } catch (err) {
      setFormError(errorMessage(err, "Couldn't save changes."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pmm-modal-overlay" onClick={onClose}>
      <div className="pmm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pmm-modal-header">
          <h3>Edit {row.model}</h3>
          <button className="pmm-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSave}>
          {formError && (
            <div className="pmm-form-error">
              <AlertIcon /><span>{formError}</span>
            </div>
          )}
          <div className="pmm-form-grid">
            {FIELDS.map((f) => (
              <div key={f.key} className="pmm-field">
                <label>{f.label}</label>
                <input
                  type={f.numeric ? "number" : "text"}
                  step={f.numeric ? "any" : undefined}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="pmm-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Spinner size="sm" inline />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Delete confirm modal --------------------------------------------------

const DeleteModal = ({
  row,
  onClose,
  onDeleted,
}: {
  row: PumpModelRow;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) => {
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setFormError("");
    try {
      await deletePumpModelRow(row.id);
      onDeleted(row.id);
    } catch (err) {
      setFormError(errorMessage(err, "Couldn't delete this row."));
      setDeleting(false);
    }
  };

  return (
    <div className="pmm-modal-overlay" onClick={onClose}>
      <div className="pmm-modal pmm-modal-sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pmm-modal-header">
          <h3>Delete row?</h3>
          <button className="pmm-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="pmm-delete-text">
          Delete <strong>{row.model}</strong> at <strong>{val(row.headMwc)} MWC</strong>?
          This permanently removes the row and affects the recommendation engine. This
          can&apos;t be undone.
        </p>
        {formError && <div className="pmm-form-error">{formError}</div>}
        <div className="pmm-modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting && <Spinner size="sm" inline />}
            {deleting ? "Deleting…" : "Delete row"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PumpModelMasterPage;
