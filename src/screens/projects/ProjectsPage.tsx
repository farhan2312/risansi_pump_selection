"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./ProjectsPage.css";
import CreateProjectModal from "../../components/projects/CreateProjectModal";

type Project = {
  id: string;
  clientCode: string;
  status: string;
  createdBy: string;
};

// Cross-page hand-off replacing react-router's location.state: the selected
// project is stashed in sessionStorage for PumpSelectionPage to read on load.
export const SELECTED_PROJECT_KEY = "selectedProject";

const ProjectsPage = () => {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([
    {
      id: "PRJ-001",
      clientCode: "Pending",
      status: "In Progress",
      createdBy: "Shambhavi",
    },
  ]);

  const [, setSelectedProject] = useState<Project | null>(null);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: `PRJ-${String(projects.length + 1).padStart(3, "0")}`,
      clientCode: "Pending",
      status: "In Progress",
      createdBy: "Shambhavi",
    };

    setProjects((prev) => [...prev, newProject]);
    setIsModalOpen(false);
  };

  const openProject = (project: Project) => {
    sessionStorage.setItem(SELECTED_PROJECT_KEY, JSON.stringify(project));
    router.push("/pump-selection");
  };

  return (
    <div className="projects-page">
      <div className="projects-header">
        <h1>Projects</h1>

        <button onClick={() => setIsModalOpen(true)}>+ New Project</button>
      </div>

      <table className="projects-table">
        <thead>
          <tr>
            <th>Project ID</th>
            <th>Client Code</th>
            <th>Status</th>
            <th>Created By</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>{project.id}</td>
              <td>{project.clientCode}</td>
              <td>{project.status}</td>
              <td>{project.createdBy}</td>

              <td>
                <div className="action-buttons">
                  <button onClick={() => openProject(project)}>Open</button>

                  <button
                    className="edit-btn"
                    onClick={() => {
                      setSelectedProject(project);
                      alert(
                        `Edit Project\n\nProject ID: ${project.id}\nClient Code: ${project.clientCode}`
                      );
                    }}
                  >
                    Edit
                  </button>

                  <button
                    className="delete-btn"
                    onClick={() =>
                      setProjects(projects.filter((p) => p.id !== project.id))
                    }
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
};

export default ProjectsPage;
