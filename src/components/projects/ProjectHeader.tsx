import "./ProjectHeader.css";

type Props = {
  project?: {
    id: string;
    code?: string;
    name?: string;
    customer?: string;
    status?: string;
  };
};

// Minimal — just the project id, nothing else. Renders nothing when there's
// no project in context (e.g. starting a selection outside a project).
const ProjectHeader = ({ project }: Props) => {
  if (!project?.id) return null;

  return (
    <p className="project-id-line">
      Project ID: <span>{project.code ?? project.id}</span>
    </p>
  );
};

export default ProjectHeader;
