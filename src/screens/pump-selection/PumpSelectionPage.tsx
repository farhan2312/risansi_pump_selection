"use client";

import { useEffect, useState } from "react";

import GeneralInformationStep from "../../components/pump-selection/GeneralInformationStep";
import FluidPropertiesStep from "../../components/pump-selection/FluidPropertiesStep";
import OperatingConditionsStep from "../../components/pump-selection/OperatingConditionsStep";
import DriveDetailsStep from "../../components/pump-selection/DriveDetailsStep";
import SealingDetailsStep from "../../components/pump-selection/SealingDetailsStep";
import MocDetailsStep from "../../components/pump-selection/MocDetailsStep";
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
    temperature: "", // canonical °C value (converted from temperatureRaw + temperatureUnit)
    temperatureRaw: "", // as-entered value in the currently-selected unit
    temperatureUnit: "C", // display-only unit for the input: C / F / K
    sg: "", // Specific Gravity
    ph: "",
    rpmRange: "", // manual RPM band filter (low/medium/high/vhigh)
    selectedModel: "", // pump picked in the live panel; persists across steps
    modelConfirmed: false, // gate: a model must be picked + confirmed after the Fluid step before continuing

    // Step 2
    viscosity: "",
    viscosityUnit: "",
    viscosityRange: "",
    viscosityCp: "", // canonical cP value (cP = cSt × SG when entered in cSt)
    solidPercentage: "",
    solidSize: "",
    solidType: "", // "Hard Solid" / "Soft Solid" — only meaningful when solidPercentage > 0

    // Step 3
    pumpType: "",
    agBk: "", // AG / BK feed option — only shown when viscosity > 10000 cP
    bearingHousing: "",
    suctionHousing: "",
    jointType: "",

    // Step 6
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

    // Step 5 — system-computed from moc_recommendation (media/pH/temp lookup)
    mocRecommendedMoc: "",
    mocMinAcceptableMoc: "",
    mocElastomer: "",
  });

  const [selectedPump, setSelectedPump] = useState<number | null>(null);

  // Flow gate: a pump model must be picked AND confirmed (in the live panel,
  // after the General + Fluid forms) before advancing past the Fluid step.
  // Applies to Next buttons and to jumping via the stepper — backward nav and
  // staying within steps 1–2 are always allowed.
  const goToStep = (target: number) => {
    if (target > 2 && !formData.modelConfirmed) return;
    setStep(target);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <GeneralInformationStep
            onNext={() => goToStep(2)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 2:
        return (
          <FluidPropertiesStep
            onPrevious={() => goToStep(1)}
            onNext={() => goToStep(3)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 3:
        return (
          <OperatingConditionsStep
            onPrevious={() => goToStep(2)}
            onNext={() => goToStep(4)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 4:
        return (
          <SealingDetailsStep
            onPrevious={() => goToStep(3)}
            onNext={() => goToStep(5)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 5:
        return (
          <MocDetailsStep
            onPrevious={() => goToStep(4)}
            onNext={() => goToStep(6)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 6:
        return (
          <DriveDetailsStep
            onPrevious={() => goToStep(5)}
            onNext={() => goToStep(7)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 7:
        return (
          <RecommendationStep
            onPrevious={() => goToStep(6)}
            formData={formData}
            selectedPump={selectedPump}
            setSelectedPump={setSelectedPump}
            onStepClick={goToStep}
          />
        );

      default:
        return (
          <GeneralInformationStep
            onNext={() => goToStep(2)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );
    }
  };

  return (
    <>
      <ProjectHeader project={project} />
      {renderStep()}
      {/* Live recommendation that refines as the user fills each step. Sits at
          the bottom of the page; hidden on the final (read-only summary) step. */}
      {step < 7 && (
        <LivePumpRecommendation formData={formData} setFormData={setFormData} />
      )}
    </>
  );
};

export default PumpSelectionPage;
