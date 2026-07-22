import "./PumpDetailsCard.css";

type Props = {
  pump: any;
};

const PumpDetailsCard = ({ pump }: Props) => {
  if (!pump) return null;

  return (
    <div className="pump-card">

      <h3>Recommended Pump Details</h3>

      <div className="pump-grid">

        <div>
          <span>Pump Model</span>
          <strong>{pump.model}</strong>
        </div>

        <div>
          <span>Pump RPM (VOLE max–min)</span>
          <strong>{pump.rpmRange}</strong>
        </div>

        <div>
          <span>Nearest Charted Head</span>
          <strong>{pump.headMwc} MWC</strong>
        </div>

        <div>
          <span>VOLE Min–Max</span>
          <strong>
            {pump.voleMin}–{pump.voleMax}%
          </strong>
        </div>

        <div>
          <span>Mechanical Efficiency</span>
          <strong>{pump.mechEff}%</strong>
        </div>

        <div>
          <span>Testing Status</span>
          <strong>{pump.isTested ? "Tested" : "Not Tested"}</strong>
        </div>

        {pump.testingRemarks && (
          <div>
            <span>Testing Remarks</span>
            <strong>{pump.testingRemarks}</strong>
          </div>
        )}

      </div>

    </div>
  );
};

export default PumpDetailsCard;
