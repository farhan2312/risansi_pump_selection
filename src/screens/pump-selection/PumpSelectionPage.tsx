"use client";

import { useEffect, useRef, useState } from "react";

import GeneralInformationStep from "../../components/pump-selection/GeneralInformationStep";
import FluidPropertiesStep from "../../components/pump-selection/FluidPropertiesStep";
import OperatingConditionsStep from "../../components/pump-selection/OperatingConditionsStep";
import DriveDetailsStep from "../../components/pump-selection/DriveDetailsStep";
import SealingDetailsStep from "../../components/pump-selection/SealingDetailsStep";
import MocDetailsStep from "../../components/pump-selection/MocDetailsStep";
import MotorRatingStep from "../../components/pump-selection/MotorRatingStep";
import RecommendationStep from "../../components/pump-selection/RecommendationStep";
import ProjectHeader from "../../components/projects/ProjectHeader";
import LivePumpRecommendation from "../../components/pump-selection/LivePumpRecommendation";
import { SELECTED_PROJECT_KEY } from "../projects/ProjectsPage";
import {
  getPumpSelectionInput,
  savePumpSelectionInput,
} from "../../services/pumpSelectionInputService";

type SelectedProject = {
  id: string;
  code?: string;
  name?: string;
  customer?: string;
  status?: string;
};

// Steps 1-4 fields autosaved to pump_selection_input, keyed by project. Kept
// in sync with the FIELDS whitelist in api/pump-selection-input/route.ts.
const AUTOSAVE_FIELDS = [
  "capacity", "capacityUnit", "head", "headUnit", "media",
  "temperature", "temperatureRaw", "temperatureUnit", "sg", "ph",
  "rpmRange", "selectedModel", "modelConfirmed",
  "viscosity", "viscosityUnit", "viscosityRange", "viscosityCp",
  "solidPercentage", "solidSize", "solidType",
  "pumpType", "agBk", "bearingHousing", "suctionHousing", "jointType",
  "sealingType", "sealingSubType",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickAutosaveFields = (data: any): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of AUTOSAVE_FIELDS) out[key] = data[key];
  return out;
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
    gearedConfigType: "", // "Geared Motor" | "Gear Box + Motor" — cascades mounting + coupling below
    gbConstructionType: "", // IN LINE HELICAL / PLANTERY — Geared Motor Drive only
    gearBoxMounting: "", // Foot Mount B3 / Flange Mount B5 / Foot cum Flange B35 — cascades on gearedConfigType
    driveCoupling: "", // derived from gearedConfigType
    asfRange: "", // Application Service Factor band — Geared Motor Drive only
    gearboxSource: "", // "PBL" | "PTL" | "Top Gear" — manual gearbox pick
    gearboxModel: "",
    gearboxOutputRpm: "",
    gearboxServiceFactor: "",
    gearboxRatePerNos: "",

    // Step 4
    sealingType: "",
    sealingSubType: "", // MSA / SCG / DCG — Mechanical Seal only

    // Step 5 — system-computed from moc_recommendation (media/pH/temp lookup)
    mocRecommendedMoc: "",
    mocMinAcceptableMoc: "",
    mocElastomer: "",
    mocCode: "",
    mocRubberCode: "",
    mocFinalCode: "",
    mocAiBearingHousing: "",
    mocAiBearingHousingRemarks: "",
    mocAiBearingPlate: "",
    mocAiBearingPlateRemarks: "",
    mocAiTieRod: "",
    mocAiTieRodRemarks: "",
    mocAiNutBolt: "",
    mocAiNutBoltRemarks: "",
    mocAiPumpHousing: "",
    mocAiPumpHousingRemarks: "",
    mocAiRotor: "",
    mocAiRotorRemarks: "",
    mocAiShaft: "",
    mocAiShaftRemarks: "",
    mocAiStatorRubber: "",
    mocAiStatorRubberRemarks: "",

    // Step 6 — Motor Rating (KW) — final drive motor rating (manual pick from
    // the pulley-table KW list, defaulted to the recommendation)
    driveMotorKw: "",

    // Step 7 — V-Belt drive recommendation (only when Drive System = V-Belt)
    driveVbeltGroove: "",
    drivePumpPulley: "",
    driveMotorPulley: "",
    driveVbeltRpm: "",
    driveCenterDistance: "",
    driveVbeltNo: "",

    // Step 7 — Drive System inputs (shown when Drive System = V-Belt Drive)
    driveMotorSpeed: "",
    driveMotorMake: "",
    driveMotorMounting: "",
    driveMotorType: "",
    driveStarterType: "",
    drivePowerSupply: "",
    driveStdNonStd: "",
  });

  // Whether the autosaved draft has been loaded (or confirmed absent) for the
  // current project — gates the autosave effect so it can't fire on the
  // pre-load default formData and stomp a real saved draft with blanks.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    getPumpSelectionInput(project.id)
      .then((row) => {
        if (cancelled || !row) return;
        setFormData((f: typeof formData) => ({
          ...f,
          ...Object.fromEntries(
            AUTOSAVE_FIELDS.map((key) => [
              key,
              row[key as keyof typeof row] ?? (key === "modelConfirmed" ? false : ""),
            ])
          ),
        }));
      })
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Debounced autosave: whenever the persisted (step 1-4) fields change, push
  // them to pump_selection_input so a refresh restores the form.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!project?.id || !restored) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePumpSelectionInput(project.id, pickAutosaveFields(formData)).catch(() => {
        // Best-effort — the wizard still works from in-memory state if a save fails.
      });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, restored, ...AUTOSAVE_FIELDS.map((key) => (formData as Record<string, unknown>)[key])]);

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
          <MotorRatingStep
            onPrevious={() => goToStep(5)}
            onNext={() => goToStep(7)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 7:
        return (
          <DriveDetailsStep
            onPrevious={() => goToStep(6)}
            onNext={() => goToStep(8)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 8:
        return (
          <RecommendationStep
            onPrevious={() => goToStep(7)}
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
      {step < 8 && (
        <LivePumpRecommendation formData={formData} setFormData={setFormData} />
      )}
    </>
  );
};

export default PumpSelectionPage;
