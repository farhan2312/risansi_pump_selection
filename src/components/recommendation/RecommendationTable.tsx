import "./RecommendationTable.css";
import type { PumpRecommendation } from "../../data/Recommendations";

type Props = {
  recommendations: PumpRecommendation[];
  selectedPump: number | null;
  setSelectedPump: React.Dispatch<React.SetStateAction<number | null>>;
};

const RecommendationTable = ({
  recommendations,
  selectedPump,
  setSelectedPump,
}: Props) => {
  return (
    <table className="recommendation-table">
      <thead>
        <tr>
          <th>Select</th>
          <th>Model</th>
          <th>RPM</th>
          <th>Flow</th>
          <th>Head</th>
          <th>Score</th>
          <th>Availability</th>
          <th>Tested</th>
          <th>Report No.</th>
        </tr>
      </thead>

      <tbody>
        {recommendations.map((pump) => (
          <tr
            key={pump.id}
            className={selectedPump === pump.id ? "selected-row" : ""}
          >
            <td>
              <input
                type="radio"
                name="pump"
                checked={selectedPump === pump.id}
                onChange={() => setSelectedPump(pump.id)}
              />
            </td>

            <td>{pump.model}</td>
            <td>{pump.rpmRange ?? pump.rpm}</td>
            <td>{pump.flow}</td>
            <td>{pump.head}</td>
            <td>{pump.score}</td>

            <td>
              <span
                className={
                  pump.availability === "Available"
                    ? "badge available"
                    : "badge out"
                }
              >
                {pump.availability}
              </span>
            </td>

            <td>
              <span
                className={
                  pump.tested === "Yes"
                    ? "badge tested"
                    : "badge pending"
                }
              >
                {pump.tested === "Yes" ? "Tested" : "Pending"}
              </span>
            </td>

            <td>{pump.reportNo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default RecommendationTable;