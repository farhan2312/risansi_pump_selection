import "./TestReportModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  pump: any;
};

const TestReportModal = ({ isOpen, onClose, pump }: Props) => {
  if (!isOpen || !pump) return null;

  return (
    <div className="report-overlay">
      <div className="report-modal">

        <h2>Pump Test Report</h2>

        <div className="report-grid">

          <p><strong>Model:</strong> {pump.model}</p>

          <p><strong>Flow:</strong> {pump.flow}</p>

          <p><strong>Head:</strong> {pump.head}</p>

          <p><strong>Match Score:</strong> {pump.score}</p>

          <p><strong>Availability:</strong> {pump.availability}</p>

          <p><strong>Testing Status:</strong> {pump.tested}</p>

          <p><strong>Result:</strong> PASS</p>

        </div>

        <button onClick={onClose}>
          Close
        </button>

      </div>
    </div>
  );
};

export default TestReportModal;