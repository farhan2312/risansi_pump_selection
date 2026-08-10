"use client";

import { useEffect, useState } from "react";
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
  getWizardInput,
  saveWizardInput,
  type WizardInputTable,
} from "../../services/wizardInputService";

type SelectedProject = {
  id: string;
  code?: string;
  name?: string;
  customer?: string;
  status?: string;
};

// Every wizard field autosaved to the DB, one table per step (two merges:
// MOC+Sealing share a table, Motor Rating + Drive-common fields share a
// table) plus one table per drive system for the Drive step's type-specific
// fields. Field-based, not step-number-based, so this doesn't need to change
// if the step order does. Kept in sync with the FIELDS whitelist in
// api/wizard-input/[table]/route.ts.
const TABLE_FIELDS: Record<WizardInputTable, readonly string[]> = {
  "general-info": [
    "capacity", "capacityUnit", "head", "headUnit", "media",
    "temperature", "temperatureRaw", "temperatureUnit", "sg", "ph",
    "rpmRange", "selectedModel", "modelConfirmed",
  ],
  "fluid-properties": [
    "viscosity", "viscosityUnit", "viscosityRange", "viscosityCp",
    "solidPercentage", "solidSize", "solidType",
  ],
  "operating-conditions": [
    "pumpType", "agBk", "bearingHousing", "suctionHousing", "jointType",
  ],
  "moc-sealing": [
    "sealingType", "sealingSubType",
    "mocAiBearingHousing", "mocAiBearingHousingRemarks",
    "mocAiBearingPlate", "mocAiBearingPlateRemarks",
    "mocAiTieRod", "mocAiTieRodRemarks",
    "mocAiNutBolt", "mocAiNutBoltRemarks",
    "mocAiPumpHousing", "mocAiPumpHousingRemarks",
    "mocAiRotor", "mocAiRotorRemarks",
    "mocAiShaft", "mocAiShaftRemarks",
    "mocAiStatorRubber", "mocAiStatorRubberRemarks",
    "mocAiProvider",
    "mocAiSuggestedBearingHousing", "mocAiSuggestedBearingPlate",
    "mocAiSuggestedTieRod", "mocAiSuggestedNutBolt", "mocAiSuggestedPumpHousing",
    "mocAiSuggestedRotor", "mocAiSuggestedShaft", "mocAiSuggestedStatorRubber",
    "mocAiGeneratedAt",
  ],
  "motor-drive": ["driveMotorKw", "driveSystem", "motorRPM"],
  "drive-direct": [],
  "drive-vbelt": [
    "driveVbeltGroove", "drivePumpPulley", "driveMotorPulley", "driveVbeltRpm",
    "driveCenterDistance", "driveVbeltNo", "driveMotorSpeed", "driveMotorMake",
    "driveMotorMounting", "driveMotorEfficiency", "driveMotorProtection",
    "driveMotorFrequency", "driveMotorVoltage", "driveStarterType",
    "drivePowerSupply", "driveStdNonStd",
  ],
  "drive-geared": [
    "gearBoxType", "gearedConfigType", "gbConstructionType", "gearBoxMounting",
    "driveCoupling", "asfRange", "gearboxSource", "gearboxModel",
    "gearboxOutputRpm", "gearboxServiceFactor", "gearboxRatePerNos",
  ],
};

// Which table(s) each wizard step writes when the user leaves it — so a Next
// (or stepper jump, or Previous) saves ONLY the step being left, not every
// table. Steps 4+5 both write moc-sealing (MOC and Sealing share one table);
// step 7's drive-system-specific table is appended conditionally at save time
// (see stepTablesToSave). Step 8 (read-only Recommendation) writes nothing.
const STEP_TABLES: Record<number, WizardInputTable[]> = {
  1: ["general-info"],
  2: ["fluid-properties"],
  3: ["operating-conditions"],
  4: ["moc-sealing"],
  5: ["moc-sealing"],
  6: ["motor-drive"],
  7: ["motor-drive"],
  8: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pickTableFields = (table: WizardInputTable, data: any): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of TABLE_FIELDS[table]) out[key] = data[key];
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

    // The AI's own per-component recommendation (persisted to
    // moc_sealing_input so it survives a reload) — distinct from the manual
    // picks above. No summary/alternatives/seal-recommendation/rationale
    // here by design — those stay session-only (see MocDetailsStep).
    mocAiProvider: "",
    mocAiSuggestedBearingHousing: "",
    mocAiSuggestedBearingPlate: "",
    mocAiSuggestedTieRod: "",
    mocAiSuggestedNutBolt: "",
    mocAiSuggestedPumpHousing: "",
    mocAiSuggestedRotor: "",
    mocAiSuggestedShaft: "",
    mocAiSuggestedStatorRubber: "",
    mocAiGeneratedAt: "",

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

  // Every table with fields to restore (drive-direct has none, so it's
  // skipped — nothing to fetch).
  const RESTORABLE_TABLES = (Object.keys(TABLE_FIELDS) as WizardInputTable[]).filter(
    (t) => TABLE_FIELDS[t].length > 0,
  );

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    Promise.all(RESTORABLE_TABLES.map((table) => getWizardInput(table, project.id)))
      .then((rows) => {
        if (cancelled) return;
        const merged: Record<string, unknown> = {};
        rows.forEach((row, i) => {
          if (!row) return;
          const tableKey = RESTORABLE_TABLES[i];
          for (const key of TABLE_FIELDS[tableKey]) {
            merged[key] = row[key] ?? (key === "modelConfirmed" ? false : "");
          }
        });
        setFormData((f: typeof formData) => ({ ...f, ...merged }));
      })
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Tables to save when leaving `fromStep` — STEP_TABLES plus, for the Drive
  // step, the one drive-system-specific table matching the current choice
  // (so switching drive types never leaves stale data in the other).
  const stepTablesToSave = (fromStep: number): WizardInputTable[] => {
    const tables = [...(STEP_TABLES[fromStep] ?? [])];
    if (fromStep === 7) {
      if (formData.driveSystem === "V-Belt Drive") tables.push("drive-vbelt");
      if (formData.driveSystem === "Geared Motor Drive/Gear Box + Motor") tables.push("drive-geared");
    }
    return tables;
  };

  // Persists ONLY the step being left — one PUT per its table(s), not all of
  // them. Called on every navigation (Next / Previous / stepper jump).
  const saveStep = (fromStep: number) => {
    if (!project?.id || !restored) return;
    for (const table of stepTablesToSave(fromStep)) {
      saveWizardInput(table, project.id, pickTableFields(table, formData)).catch(() => {
        // Best-effort — the wizard still works from in-memory state if a save fails.
      });
    }
  };

  const [selectedPump, setSelectedPump] = useState<number | null>(null);

  // Flow gate: a pump model must be picked AND confirmed (in the live panel,
  // after the General + Fluid forms) before advancing past the Fluid step.
  // Applies to Next buttons and to jumping via the stepper — backward nav and
  // staying within steps 1–2 are always allowed. Saves the step being left
  // before navigating, so its inputs land in that step's own table.
  const goToStep = (target: number) => {
    if (target > 2 && !formData.modelConfirmed) return;
    saveStep(step);
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
            projectId={project?.id}
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
            projectId={project?.id}
            projectCode={project?.code}
            projectName={project?.name}
            customerName={project?.customer}
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
