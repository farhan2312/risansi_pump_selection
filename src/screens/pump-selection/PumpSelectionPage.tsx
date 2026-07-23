"use client";

import { useEffect, useState } from "react";

import GeneralInformationStep from "../../components/pump-selection/GeneralInformationStep";
import FluidPropertiesStep from "../../components/pump-selection/FluidPropertiesStep";
import OperatingConditionsStep from "../../components/pump-selection/OperatingConditionsStep";
import DriveDetailsStep from "../../components/pump-selection/DriveDetailsStep";
import SealingDetailsStep from "../../components/pump-selection/SealingDetailsStep";
import RecommendationStep from "../../components/pump-selection/RecommendationStep";
import ProjectHeader from "../../components/projects/ProjectHeader";
import LivePumpRecommendation from "../../components/pump-selection/LivePumpRecommendation";
import { SELECTED_PROJECT_KEY } from "../projects/ProjectsPage";

type SelectedProject = {
  id: string;
  code?: string;
  name?: string;
  customer?: string;
  status?: string;
};

const PumpSelectionPage = () => {
  // Replaces react-router's location.state.project — read the project stashed
  // by ProjectsPage before navigating here.
  const [project, setProject] = useState<SelectedProject | undefined>(undefined);

  useEffect(() => {
    const raw = sessionStorage.getItem(SELECTED_PROJECT_KEY);
    if (raw) {
      try {
        setProject(JSON.parse(raw));
      } catch {
        setProject(undefined);
      }
    }
  }, []);

  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    projectName: "",
    customerName: "",

    // Step 1
    capacity: "",
    capacityUnit: "",
    head: "",
    headUnit: "",
    media: "",
    temperature: "",
    sg: "", // Specific Gravity
    ph: "",
    rpmRange: "", // manual RPM band filter (low/medium/high/vhigh)
    selectedModel: "", // pump pinned in the live panel; persists across steps

    // Step 2
    viscosity: "",
    viscosityUnit: "",
    viscosityRange: "",
    solidPercentage: "",
    solidSize: "",

    // Step 3
    pumpType: "",
    agBk: "", // AG / BK feed option — only shown when viscosity > 10000 cP
    bearingHousing: "",
    suctionHousing: "",
    jointType: "",

    // Step 5
    driveSystem: "",
    motorMake: "",
    gearboxMake: "",
    motorRPM: "",
    gearBoxType: "", // HISO / SISO — Geared Motor Drive only
    gearBoxMounting: "", // Foot Mount B3 / Flange Mount B5 / Foot cum Flange B35 — Geared Motor Drive only
    asfRange: "", // Application Service Factor band — Geared Motor Drive only

    // Step 4
    sealingType: "",
    sealingSubType: "", // MSA / SCG / DCG — Mechanical Seal only
  });

  const [selectedPump, setSelectedPump] = useState<number | null>(null);

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <GeneralInformationStep
            onNext={() => setStep(2)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={setStep}
          />
        );

      case 2:
        return (
          <FluidPropertiesStep
            onPrevious={() => setStep(1)}
            onNext={() => setStep(3)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={setStep}
          />
        );

      case 3:
        return (
          <OperatingConditionsStep
            onPrevious={() => setStep(2)}
            onNext={() => setStep(4)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={setStep}
          />
        );

      case 4:
        return (
          <SealingDetailsStep
            onPrevious={() => setStep(3)}
            onNext={() => setStep(5)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={setStep}
          />
        );

      case 5:
        return (
          <DriveDetailsStep
            onPrevious={() => setStep(4)}
            onNext={() => setStep(6)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={setStep}
          />
        );

      case 6:
        return (
          <RecommendationStep
            onPrevious={() => setStep(5)}
            formData={formData}
            selectedPump={selectedPump}
            setSelectedPump={setSelectedPump}
            onStepClick={setStep}
          />
        );

      default:
        return (
          <GeneralInformationStep
            onNext={() => setStep(2)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={setStep}
          />
        );
    }
  };

  return (
    <>
      <ProjectHeader project={project} />
      {renderStep()}
      {/* Live recommendation that refines as the user fills each step. Sits at
          the bottom of the page; hidden on step 6, which shows the full list. */}
      {step < 6 && (
        <LivePumpRecommendation formData={formData} setFormData={setFormData} />
      )}
    </>
  );
};

export default PumpSelectionPage;
