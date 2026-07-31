"use client";

import { useEffect, useState } from "react";
import "./CreateProjectModal.css";
import type { ProjectRecord } from "../../services/projectService";

type Props = {
  isOpen: boolean;
  project: ProjectRecord | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    clientCode: string;
    industry: string;
    status: string;
  }) => void;
};

const STATUS_OPTIONS = ["In Progress", "Completed", "Pending"];

const EditProjectModal = ({ isOpen, project, isSaving, onClose, onSave }: Props) => {
  const [name, setName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState("In Progress");

  // Re-seed the fields whenever a different project is opened for editing.
  useEffect(() => {
    if (!project) return;
    setName(project.name ?? "");
    setClientCode(project.client_code ?? "");
    setIndustry(project.industry ?? "");
    setStatus(project.status ?? "In Progress");
  }, [project]);

  if (!isOpen || !project) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Project</h2>

        <div className="modal-form">
          <div className="form-group">
            <label>Client Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
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

          <div className="form-group">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>

          <button
            className="create-btn"
            disabled={isSaving || !name.trim()}
            onClick={() => onSave({ name, clientCode, industry, status })}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProjectModal;
