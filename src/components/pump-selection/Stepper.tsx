import "./Stepper.css";
type StepperProps = {
  currentStep: number;
  onStepClick?: (step: number) => void;
};

const steps = [
  "General",
  "Fluid",
  "Specifications",
  "Drive",
  "Sealing",
  "Recommendation",
];

const Stepper = ({ currentStep, onStepClick }: StepperProps) => {
  return (
    <div className="stepper">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        return (
          <button
            type="button"
            key={step}
            className={`step ${currentStep === stepNumber ? "active" : ""} ${
              onStepClick ? "clickable" : ""
            }`}
            onClick={() => onStepClick?.(stepNumber)}
            disabled={!onStepClick}
          >
            <div className="step-circle">{stepNumber}</div>
            <span>{step}</span>
          </button>
        );
      })}
    </div>
  );
};

export default Stepper;