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
          <span>Pump RPM</span>
          <strong>{pump.rpm}</strong>
        </div>

        <div>
          <span>Flow</span>
          <strong>{pump.flow}</strong>
        </div>

        <div>
          <span>Head</span>
          <strong>{pump.head}</strong>
        </div>

        <div>
          <span>Bearing Housing</span>
          <strong>{pump.bearingHousing}</strong>
        </div>

        <div>
          <span>Suction Housing</span>
          <strong>{pump.suctionHousing}</strong>
        </div>

        <div>
          <span>Joint Type</span>
          <strong>{pump.jointType}</strong>
        </div>

        <div>
          <span>Sealing Type</span>
          <strong>{pump.sealingType}</strong>
        </div>

        <div>
          <span>MOC</span>
          <strong>{pump.moc}</strong>
        </div>

        <div>
          <span>Suction Size</span>
          <strong>{pump.suctionSize}</strong>
        </div>

        <div>
          <span>Delivery Size</span>
          <strong>{pump.deliverySize}</strong>
        </div>

        <div>
          <span>Motor Recommendation</span>
          <strong>{pump.motor}</strong>
        </div>

        <div>
          <span>Drive System</span>
          <strong>{pump.driveSystem}</strong>
        </div>

        <div>
          <span>Match Score</span>
          <strong>{pump.score}</strong>
        </div>

        <div>
          <span>Availability</span>
          <strong>{pump.availability}</strong>
        </div>

        <div>
          <span>Testing Status</span>
          <strong>{pump.tested}</strong>
        </div>

        <div>
          <span>Test Report</span>
          <strong>{pump.reportNo}</strong>
        </div>

      </div>

    </div>
  );
};

export default PumpDetailsCard;