"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./ProjectsPage.css";
import CreateProjectModal from "../../components/projects/CreateProjectModal";
import EditProjectModal from "../../components/projects/EditProjectModal";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type ProjectRecord,
} from "../../services/projectService";

// Cross-page hand-off replacing react-router's location.state: the selected
// project is stashed in sessionStorage for PumpSelectionPage to read on load.
export const SELECTED_PROJECT_KEY = "selectedProject";

const ProjectsPage = () => {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [editing, setEditing] = useState<ProjectRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = () => {
    setIsLoading(true);
    setError(null);
    listProjects()
      .then(setProjects)
      .catch(() => setError("Couldn't load projects."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (input: {
    name: string;
    clientCode: string;
    industry: string;
  }) => {
    setIsCreating(true);
    try {
      // createdBy is derived server-side from the session cookie, not sent
      // by the client.
      const created = await createProject(input);
      setProjects((prev) => [created, ...prev]);
      setIsModalOpen(false);
    } catch {
      setError("Couldn't create the project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const openProject = (project: ProjectRecord) => {
    sessionStorage.setItem(
      SELECTED_PROJECT_KEY,
      JSON.stringify({
        id: project.id,
        code: project.project_code,
        name: project.name,
        customer: project.customer_name,
        status: project.status,
      })
    );
    router.push("/pump-selection");
  };

  const handleEditSave = async (input: {
    name: string;
    clientCode: string;
    industry: string;
    status: string;
  }) => {
    if (!editing) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateProject(editing.id, input);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing(null);
    } catch {
      setError("Couldn't save the project changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (project: ProjectRecord) => {
    const label = project.name || project.project_code;
    if (
      !window.confirm(
        `Delete project "${label}"? This also removes its saved pump-selection inputs and can't be undone.`
      )
    ) {
      return;
    }
    setDeletingId(project.id);
    setError(null);
    try {
      await deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      setError("Couldn't delete the project. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <h1>Projects</h1>

        <button onClick={() => setIsModalOpen(true)}>+ New Project</button>
      </div>

      {isLoading && <p>Loading projects...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && projects.length === 0 && (
        <p className="empty-state">No projects yet.</p>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <table className="projects-table">
          <thead>
            <tr>
              <th>Project ID</th>
              <th>Client Name</th>
              <th>Client Code</th>
              <th>Created By</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.project_code}</td>
                <td>{project.name || "—"}</td>
                <td>{project.client_code || "—"}</td>
                <td>{project.created_by_name || "—"}</td>

                <td>
                  <div className="action-buttons">
                    <button className="open-btn" onClick={() => openProject(project)}>
                      Open
                    </button>

                    <button
                      className="edit-btn"
                      onClick={() => setEditing(project)}
                    >
                      Edit
                    </button>

                    <button
                      className="delete-btn"
                      disabled={deletingId === project.id}
                      onClick={() => handleDelete(project)}
                    >
                      {deletingId === project.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => !isCreating && setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <EditProjectModal
        isOpen={editing !== null}
        project={editing}
        isSaving={isSaving}
        onClose={() => !isSaving && setEditing(null)}
        onSave={handleEditSave}
      />
    </div>
  );
};

export default ProjectsPage;
