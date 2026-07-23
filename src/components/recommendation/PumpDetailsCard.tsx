import "./PumpDetailsCard.css";
import { sealingShort } from "../../lib/sealing";

type Props = {
  pump: any;
  /** Step-5 Suction & Discharge Size (from viscosity range), or null if not set. */
  size?: number | null;
  /** Pump Type chosen on the Specifications step. */
  pumpType?: string;
  /** AG / BK feed option chosen for very thick media (>10 000 cP). */
  agBk?: string;
  /** Sealing type chosen on the Sealing Details step (shown short: MS / GP). */
  sealingType?: string;
};

const PumpDetailsCard = ({
  pump,
  size = null,
  pumpType = "",
  agBk = "",
  sealingType = "",
}: Props) => {
  if (!pump) return null;

  const seal = sealingShort(sealingType);

  return (
    <div className="pump-card">

      <h3>Recommended Pump Details</h3>

      <div className="pump-grid">

        <div>
          <span>Pump Model</span>
          <strong>{pump.model}</strong>
        </div>

        <div>
          <span>Pump Type</span>
          <strong>{pumpType || "—"}</strong>
        </div>

        {agBk && (
          <div>
            <span>AG / BK</span>
            <strong>{agBk}</strong>
          </div>
        )}

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
          <span>Suction &amp; Discharge Size</span>
          <strong>{size !== null ? size : "—"}</strong>
        </div>

        <div>
          <span>Sealing Type</span>
          <strong>{seal || "—"}</strong>
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
