import "./ProjectHeader.css";

type Props = {
  project?: {
    id: string;
    name?: string;
    customer?: string;
    status?: string;
  };
};

const ProjectHeader = ({ project }: Props) => {
  return (
    <div className="project-header">
      <div>
        <h2>{project?.name || "New Pump Selection"}</h2>
        <p>{project?.id || "Project ID: -"}</p>
      </div>

      <div className="project-info">
        <div>
          <span>Customer</span>
          <strong>{project?.customer || "-"}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>{project?.status || "Draft"}</strong>
        </div>
      </div>
    </div>
  );
};

export default ProjectHeader;