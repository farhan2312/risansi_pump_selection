"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./ProjectsPage.css";
import CreateProjectModal from "../../components/projects/CreateProjectModal";
import EditProjectModal from "../../components/projects/EditProjectModal";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { SkeletonRows } from "../../components/ui/Skeleton";
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
  const [confirmingDelete, setConfirmingDelete] = useState<ProjectRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = () => {
    setIsLoading(true);
    setError(null);
    listProjects()
      .then(setProjects)
      .catch(() => setError("Couldn't load enquiries."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (input: {
    projectCode: string;
    name: string;
    clientCode: string;
    industry: string;
  }): Promise<string | null> => {
    setIsCreating(true);
    try {
      // createdBy is derived server-side from the session cookie, not sent
      // by the client.
      const created = await createProject(input);
      setProjects((prev) => [created, ...prev]);
      setIsModalOpen(false);
      return null;
    } catch (err) {
      // Surface the API's specific message (e.g. duplicate Enquiry no.) so the
      // modal can show it inline instead of a generic failure.
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Couldn't create the project. Please try again.";
      return msg;
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

  const handleDelete = async () => {
    if (!confirmingDelete) return;
    const target = confirmingDelete;
    setDeletingId(target.id);
    setError(null);
    try {
      await deleteProject(target.id);
      setProjects((prev) => prev.filter((p) => p.id !== target.id));
      setConfirmingDelete(null);
    } catch {
      setError("Couldn't delete the project. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <div className="projects-header-text">
          <h1>Enquiries</h1>
          <p>Create, open, and manage your PCP pump-selection enquiries.</p>
        </div>
        <button className="projects-new-btn" onClick={() => setIsModalOpen(true)}>
          <PlusIcon /> New Enquiry
        </button>
      </div>

      {error && (
        <div className="projects-error" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="projects-panel">
          <div className="projects-loading">
            <SkeletonRows rows={5} cols={5} />
          </div>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <EmptyState
          icon="folder"
          title="No enquiries yet"
          description="Create your first enquiry to start scoping a PCP pump selection — capacity, head, media, and drive details all get saved per enquiry."
          action={
            <button className="projects-new-btn" onClick={() => setIsModalOpen(true)}>
              <PlusIcon /> Create your first enquiry
            </button>
          }
        />
      )}

      {!isLoading && !error && projects.length > 0 && (
        <div className="projects-panel">
          <table className="projects-table">
            <thead>
              <tr>
                <th>Enquiry no.</th>
                <th>Client Name</th>
                <th>Client Code</th>
                <th>Created By</th>
                <th className="projects-actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="project-code">{project.project_code}</td>
                  <td className="project-name">{project.name || "—"}</td>
                  <td>{project.client_code || "—"}</td>
                  <td>{project.created_by_name || "—"}</td>

                  <td className="projects-actions-col">
                    <div className="projects-actions">
                      <button
                        className="project-btn project-btn-primary"
                        onClick={() => openProject(project)}
                      >
                        <OpenIcon /> Open
                      </button>

                      <button
                        className="project-btn"
                        onClick={() => setEditing(project)}
                        aria-label={`Edit enquiry ${project.project_code}`}
                      >
                        <EditIcon /> Edit
                      </button>

                      <button
                        className="project-btn project-btn-danger"
                        disabled={deletingId === project.id}
                        onClick={() => setConfirmingDelete(project)}
                        aria-label={`Delete enquiry ${project.project_code}`}
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      <ConfirmModal
        open={confirmingDelete !== null}
        title="Delete this enquiry?"
        description={
          confirmingDelete ? (
            <>
              <strong>
                {confirmingDelete.name || confirmingDelete.project_code}
              </strong>{" "}
              and its saved pump-selection inputs will be permanently removed. This
              can&apos;t be undone.
            </>
          ) : null
        }
        confirmLabel={deletingId ? "Deleting…" : "Delete project"}
        cancelLabel="Cancel"
        tone="danger"
        busy={deletingId !== null}
        onConfirm={handleDelete}
        onClose={() => !deletingId && setConfirmingDelete(null)}
      />
    </div>
  );
};

// --- Inline icons (self-contained, no external asset dependency) -----------
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const OpenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M9 6h10v10M19 6 6 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M4 20h4L20 8l-4-4L4 16v4Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="m14 6 4 4" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path
      d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

export default ProjectsPage;
