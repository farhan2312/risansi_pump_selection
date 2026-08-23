"use client";

import { useState } from "react";
import "./CreateProjectModal.css";

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

const CreateProjectModal = ({ isOpen, onClose, onCreate }: Props) => {
  const [enquiryNo, setEnquiryNo] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (saving) return;
    if (!enquiryNo.trim()) {
      setError("Enquiry no. is required.");
      return;
    }
    setError("");
    setSaving(true);
    const msg = await onCreate({
      projectCode: enquiryNo.trim(),
      name: clientName,
      clientCode,
      industry,
    });
    setSaving(false);
    // A message means it failed (e.g. duplicate Enquiry no.); keep the modal
    // open so the user can fix it. null means success — the parent closes it.
    if (msg) setError(msg);
  };

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
              placeholder="e.g. ENQ-2026-001"
              onChange={(e) => setEnquiryNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
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
