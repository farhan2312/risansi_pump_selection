"use client";

import { useState } from "react";
import "./CreateProjectModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: {
    name: string;
    customer: string;
    industry: string;
    remarks: string;
  }) => void;
};

const CreateProjectModal = ({ isOpen, onClose, onCreate }: Props) => {
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [industry, setIndustry] = useState("");
  const [remarks] = useState("");

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Create New Project</h2>

        <div className="modal-form">
          <div className="form-group">
            <label>Project Name</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Client code</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
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
                name: projectName,
                customer: customerName,
                industry,
                remarks,
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
