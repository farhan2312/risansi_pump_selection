"use client";

import { useRouter } from "next/navigation";
import "./QuickActions.css";

const QuickActions = () => {
  const router = useRouter();

  return (
    <div className="quick-actions">
      <div className="action-card blue" onClick={() => router.push("/projects")}>
        <div className="icon icon-blue">P</div>

        <div>
          <h3>Projects</h3>
          <p>View all projects</p>
        </div>

        <span>›</span>
      </div>

      <div className="action-card purple" onClick={() => router.push("/projects")}>
        <div className="icon icon-purple">+</div>

        <div>
          <h3>New Project</h3>
          <p>Create new project</p>
        </div>

        <span>›</span>
      </div>

      <div
        className="action-card green"
        onClick={() => router.push("/pump-selection")}
      >
        <div className="icon icon-green">PS</div>

        <div>
          <h3>Pump Selection</h3>
          <p>Start pump selection</p>
        </div>

        <span>›</span>
      </div>

      <div className="action-card orange disabled">
        <div className="icon icon-orange">T</div>

        <div>
          <h3>Testing Reports</h3>
          <p>Coming Soon</p>
        </div>

        <span>›</span>
      </div>
    </div>
  );
};

export default QuickActions;
