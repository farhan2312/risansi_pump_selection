"use client";

import { useEffect, useState } from "react";
import { createMediaType, listMediaTypes } from "../../services/mediaTypeService";
import { btnGhostSm, btnPrimarySm, control, hint, hintError } from "./formStyles";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const ADD_NEW = "__add_new__";

/** Media / Application dropdown backed by the shared media_types table — any
 * media added here (via "+ Add new media") is saved to the database, so it
 * shows up in everyone's dropdown from then on, not just this session. */
const MediaSelect = ({ value, onChange }: Props) => {
  const [options, setOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    listMediaTypes()
      .then((rows) => setOptions(rows.map((r) => r.name)))
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === ADD_NEW) {
      setNewValue("");
      setSaveError(null);
      setIsAdding(true);
      return;
    }
    onChange(e.target.value);
  };

  const addOption = (name: string) => {
    setOptions((prev) =>
      prev.some((o) => o.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, name].sort((a, b) => a.localeCompare(b))
    );
  };

  const handleAdd = async () => {
    const trimmed = newValue.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const created = await createMediaType(trimmed);
      addOption(created.name);
      onChange(created.name);
      setIsAdding(false);
    } catch {
      setSaveError("Couldn't add this media. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setSaveError(null);
  };

  // Always show the currently-selected value even if it hasn't finished
  // loading into `options` yet (e.g. just-added, or set before the list load
  // resolved).
  const allOptions =
    value && !options.some((o) => o.toLowerCase() === value.toLowerCase())
      ? [...options, value].sort((a, b) => a.localeCompare(b))
      : options;

  if (isAdding) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            className={control}
            placeholder="Type the new media / application..."
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
          />
          <button
            type="button"
            className={btnPrimarySm}
            disabled={isSaving || !newValue.trim()}
            onClick={handleAdd}
          >
            {isSaving ? "Adding…" : "Add"}
          </button>
          <button type="button" className={btnGhostSm} disabled={isSaving} onClick={handleCancel}>
            Cancel
          </button>
        </div>
        {saveError && <span className={hintError}>{saveError}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select className={control} value={value} onChange={handleSelectChange} disabled={isLoading}>
        <option value="">{isLoading ? "Loading media list…" : "Select media / application"}</option>
        {allOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add new media…</option>
      </select>
      {loadFailed && (
        <span className={hint}>Couldn&apos;t load the saved list — you can still add a new one.</span>
      )}
    </div>
  );
};

export default MediaSelect;
