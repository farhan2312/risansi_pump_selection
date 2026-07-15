"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./ProjectsPage.css";
import CreateProjectModal from "../../components/projects/CreateProjectModal";
import { getCurrentUser } from "../../services/session";
import {
  createProject,
  listProjects,
  type ProjectRecord,
} from "../../services/projectService";

// Cross-page hand-off replacing react-router's location.state: the selected
// project is stashed in sessionStorage for PumpSelectionPage to read on load.
export const SELECTED_PROJECT_KEY = "selectedProject";

const ProjectsPage = () => {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
      const created = await createProject({
        ...input,
        createdBy: getCurrentUser()?.id ?? null,
      });
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

  // Delete/Edit have no backend endpoint yet — this only affects the list
  // shown in this session, it isn't persisted.
  const handleDelete = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
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
                      onClick={() =>
                        alert(
                          `Edit Project\n\nProject ID: ${project.project_code}\nClient Name: ${
                            project.name || "-"
                          }\nClient Code: ${project.client_code || "-"}`
                        )
                      }
                    >
                      Edit
                    </button>

                    <button className="delete-btn" onClick={() => handleDelete(project.id)}>
                      Delete
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
    </div>
  );
};

export default ProjectsPage;
