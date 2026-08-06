"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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
import { getProject } from "../../services/projectService";
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

// General/Fluid/Operating Conditions/Sealing fields autosaved to
// pump_selection_input, keyed by project (MOC and everything after it is
// re-derived live, not persisted here) — field-based, not step-number-based,
// so this list doesn't need to change if the step order does. Kept in sync
// with the FIELDS whitelist in api/pump-selection-input/route.ts.
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
  // by ProjectsPage before navigating here. `projectChecked` gates the "no
  // project selected" screen so it can't flash before this client-only read
  // (sessionStorage) has actually run. sessionStorage is just a snapshot from
  // whenever "Open" was last clicked — it doesn't know if the project has
  // since been deleted, so it's re-validated against the DB below; `wasDeleted`
  // distinguishes that case from "never picked one" for the empty-state copy.
  const [project, setProject] = useState<SelectedProject | undefined>(undefined);
  const [projectChecked, setProjectChecked] = useState(false);
  const [wasDeleted, setWasDeleted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(SELECTED_PROJECT_KEY);
    if (!raw) {
      setProjectChecked(true);
      return;
    }
    let stashed: SelectedProject | undefined;
    try {
      stashed = JSON.parse(raw);
    } catch {
      stashed = undefined;
    }
    if (!stashed?.id) {
      setProjectChecked(true);
      return;
    }
    let cancelled = false;
    getProject(stashed.id)
      .then((live) => {
        if (cancelled) return;
        if (live) {
          setProject(stashed);
        } else {
          // Deleted since it was picked — drop the stale cache so a future
          // visit doesn't keep showing it either.
          sessionStorage.removeItem(SELECTED_PROJECT_KEY);
          setWasDeleted(true);
        }
      })
      .catch(() => {
        // Network/auth error — fail closed to the stashed copy rather than
        // silently dropping a still-valid project the user picked.
        if (!cancelled) setProject(stashed);
      })
      .finally(() => {
        if (!cancelled) setProjectChecked(true);
      });
    return () => {
      cancelled = true;
    };
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
    driveMotorEfficiency: "",
    driveMotorProtection: "",
    driveMotorFrequency: "",
    driveMotorVoltage: "",
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
          <MocDetailsStep
            onPrevious={() => goToStep(3)}
            onNext={() => goToStep(5)}
            formData={formData}
            setFormData={setFormData}
            onStepClick={goToStep}
          />
        );

      case 5:
        return (
          <SealingDetailsStep
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

  // Wait for the client-only sessionStorage check before deciding whether to
  // show the wizard or the "no project" screen — avoids a flash.
  if (projectChecked && !project) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-elev text-2xl">
          📁
        </div>
        <h2 className="text-[18px] font-semibold text-fg">
          {wasDeleted ? "This project was deleted" : "No project selected"}
        </h2>
        <p className="text-[13px] text-fg-3">
          {wasDeleted
            ? "The project you had open has since been deleted. Open or create another one from the Projects page."
            : "Pump selection is tied to a project. Open or create one from the Projects page, then click “Open” to start configuring a pump for it."}
        </p>
        <Link
          href="/projects"
          className="mt-2 rounded-lg bg-title px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go to Projects
        </Link>
      </div>
    );
  }

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
