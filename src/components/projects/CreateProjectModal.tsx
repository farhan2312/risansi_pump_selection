"use client";

import { useState } from "react";
import "./CreateProjectModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: {
    name: string;
    clientCode: string;
    industry: string;
  }) => void;
};

const CreateProjectModal = ({ isOpen, onClose, onCreate }: Props) => {
  const [clientName, setClientName] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [industry, setIndustry] = useState("");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Create New Project</h2>

        <div className="modal-form">
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

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>

          <button
            className="create-btn"
            onClick={() =>
              onCreate({
                name: clientName,
                clientCode,
                industry,
              })
            }
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;
