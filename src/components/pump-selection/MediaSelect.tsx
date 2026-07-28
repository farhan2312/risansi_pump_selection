"use client";

import { useEffect, useState } from "react";
import { listMocMedia } from "../../services/mocRecommendationService";
import { btnGhostSm, btnPrimarySm, control, hint, hintError } from "./formStyles";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const OTHER = "__other__";

/** Media / Application dropdown backed by the moc_recommendation reference
 * table (curated MOC selection data — Sugar + Non-Sugar industry media). This
 * list is curated reference data, not user-growable, so "Other" just sets a
 * one-off value locally — it isn't saved anywhere for future sessions. */
const MediaSelect = ({ value, onChange }: Props) => {
  const [options, setOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [isOther, setIsOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  useEffect(() => {
    listMocMedia()
      .then(setOptions)
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === OTHER) {
      setOtherValue(value && !options.includes(value) ? value : "");
      setIsOther(true);
      return;
    }
    onChange(e.target.value);
  };

  const handleOtherConfirm = () => {
    const trimmed = otherValue.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setIsOther(false);
  };

  const handleCancel = () => setIsOther(false);

  // Always show the currently-selected value even if it's not in the loaded
  // list (e.g. a one-off "Other" value from an earlier visit to this step).
  const allOptions =
    value && !options.some((o) => o.toLowerCase() === value.toLowerCase())
      ? [...options, value].sort((a, b) => a.localeCompare(b))
      : options;

  if (isOther) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            className={control}
            placeholder="Type the media / application..."
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleOtherConfirm();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
          />
          <button
            type="button"
            className={btnPrimarySm}
            disabled={!otherValue.trim()}
            onClick={handleOtherConfirm}
          >
            Use this
          </button>
          <button type="button" className={btnGhostSm} onClick={handleCancel}>
            Cancel
          </button>
        </div>
        <span className={hint}>
          Not part of the MOC reference list — used for this selection only.
        </span>
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
        <option value={OTHER}>Other (type manually)…</option>
      </select>
      {loadFailed && (
        <span className={hintError}>
          Couldn&apos;t load the media list — check your connection and try again.
        </span>
      )}
    </div>
  );
};

export default MediaSelect;
