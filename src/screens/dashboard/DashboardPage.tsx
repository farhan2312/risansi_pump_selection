import WelcomeCard from "../../components/dashboard/WelcomeCard";
import StatsCard from "../../components/dashboard/StatsCard";
import "./DashboardPage.css";

const DashboardPage = () => {
  return (
    <div className="dashboard-page">
      <WelcomeCard />

      <div className="stats-grid">
        <StatsCard title="Total Projects" value={12} />

        <StatsCard title="In Progress" value={5} />

        <StatsCard title="Completed" value={24} />

        <StatsCard title="Pumps Tested" value={48} />
      </div>

      <div className="dashboard-card">
        <h3>Recent Projects</h3>

        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Cooling Water Pump</td>
              <td>In Progress</td>
            </tr>

            <tr>
              <td>Molasses Transfer</td>
              <td>Completed</td>
            </tr>

            <tr>
              <td>Syrup Feeding</td>
              <td>Pending</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DashboardPage;
