"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import PumpDetailsCard from "../../components/recommendation/PumpDetailsCard";
import { useEffect, useState } from "react";
import { getRecommendations } from "../../services/recommendationService";
import { SIZE_COLUMN_BY_RANGE, sizeForViscosityRange } from "../../lib/suction-discharge-size";
import { sealingShort } from "../../lib/sealing";
import {
  downloadSelectionSummaryPdf,
  type SelectionSummaryPdfSection,
} from "../../lib/selection-summary-pdf";
import { saveReportSummary, uploadFinalReport } from "../../services/reportsService";
import { useCurrentUser } from "../../contexts/CurrentUserContext";
import type {
  PumpRecommendation,
  PumpSelectionFormData,
} from "../../data/Recommendations";

type Props = {
  onPrevious: () => void;
  formData: PumpSelectionFormData;
  selectedPump: number | null;
  setSelectedPump: React.Dispatch<React.SetStateAction<number | null>>;
  onStepClick?: (step: number) => void;
  /** Open project's id + display info — needed to upload the generated
   * report so it's saved on the project (see handleConfirmSelection). */
  projectId?: string;
  projectCode?: string;
  projectName?: string;
  customerName?: string;
};

// Combines a manual material selection with its open-remarks note into one
// summary line, e.g. "SS304 (verify with client spec)".
const withRemarks = (value?: string, remarks?: string): string | undefined => {
  if (!value) return undefined;
  return remarks ? `${value} (${remarks})` : value;
};

const RPM_RANGE_LABELS: Record<string, string> = {
  low: "Low (< 200)",
  medium: "Medium (200–320)",
  high: "High (320–400)",
  vhigh: "Very High (> 400)",
};

type FieldItem = [string, string | undefined];

// One labeled value pair, filtered to only the ones with a real value —
// used inside every report section box below.
const FieldGrid = ({ items, tone = "default" }: { items: FieldItem[]; tone?: "default" | "pos" }) => {
  const filled = items.filter(([, v]) => v && String(v).trim() !== "");
  if (filled.length === 0) return null;
  const labelClass = tone === "pos" ? "text-[var(--pos-strong)]/75" : "text-fg-3";
  const valueClass = tone === "pos" ? "text-[var(--pos-strong)]" : "text-fg";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {filled.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span className={`text-[11px] uppercase tracking-wide ${labelClass}`}>{label}</span>
          <strong className={`text-[13.5px] font-semibold ${valueClass}`}>{value}</strong>
        </div>
      ))}
    </div>
  );
};

// Only used to decide whether to render a Section at all (Section itself
// re-filters via FieldGrid) — avoids an empty bordered box for a step the
// user hasn't touched.
const hasAny = (items: FieldItem[]) => items.some(([, v]) => v && String(v).trim() !== "");

// One step's box: label header + its field grid. Renders nothing if every
// field in `items` is empty, so untouched steps don't leave a hollow box.
const Section = ({
  title,
  items,
  children,
}: {
  title: string;
  items?: FieldItem[];
  children?: React.ReactNode;
}) => {
  if (items && !hasAny(items) && !children) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line bg-paper">
      <div className="border-b border-line bg-elev px-4 py-2.5">
        <span className="section-label">{title}</span>
      </div>
      <div className="p-4">
        {items && <FieldGrid items={items} />}
        {children}
      </div>
    </div>
  );
};

// Read-only summary step: the pump model was already picked + confirmed after
// the Fluid step, so this just reviews the confirmed model and every spec
// configured along the way. No re-picking here.
const RecommendationStep = ({
  onPrevious,
  formData,
  onStepClick,
  projectId,
  projectCode,
  projectName,
  customerName,
}: Props) => {
  const { user } = useCurrentUser();
  const [recommendations, setRecommendations] = useState<PumpRecommendation[]>([]);
  const [inputEcho, setInputEcho] = useState<{ capacity: string; head: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getRecommendations(formData)
      .then((result) => {
        if (!cancelled) {
          setRecommendations(result.recommendations);
          setInputEcho(result.input);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Couldn't load the pump summary. Please check your connection and try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmedPump =
    recommendations.find((p) => p.model === formData.selectedModel) || null;

  // Prefer the confirmed model's own per-viscosity size; fall back to the
  // flat SIZE_BY_RANGE hint when the model isn't covered by the per-model
  // sheet (mostly L-variants). Lifted out of the card's render so the PDF
  // export below can reuse the exact same value.
  const cardSize = confirmedPump
    ? (() => {
        const col = SIZE_COLUMN_BY_RANGE[formData.viscosityRange as string];
        const perModel = col ? confirmedPump[col] : null;
        return perModel ?? sizeForViscosityRange(formData.viscosityRange);
      })()
    : null;

  // --- Field groups, one per wizard step, in wizard order ------------------

  const generalInfoItems: FieldItem[] = [
    ["Media / Application", formData.media],
    ["Capacity", formData.capacity ? `${formData.capacity} ${formData.capacityUnit || ""}`.trim() : ""],
    ["Head", formData.head ? `${formData.head} ${formData.headUnit || ""}`.trim() : ""],
    ["Temperature", formData.temperature ? `${formData.temperature} °C` : ""],
    ["pH", formData.ph],
    ["Specific Gravity", formData.sg],
    ["RPM Range", formData.rpmRange ? RPM_RANGE_LABELS[formData.rpmRange] ?? formData.rpmRange : ""],
  ];

  const fluidPropertiesItems: FieldItem[] = [
    ["Viscosity", formData.viscosity ? `${formData.viscosity} ${formData.viscosityUnit || ""}`.trim() : ""],
    ["Solids", formData.solidPercentage ? `${formData.solidPercentage}%` : ""],
    [
      "Particle Size",
      formData.solidSize
        ? `${formData.solidSize} mm${formData.solidType ? ` (${formData.solidType})` : ""}`
        : "",
    ],
  ];

  const operatingConditionsItems: FieldItem[] = [
    ["Pump Type", formData.pumpType],
    ["AG / BK", formData.agBk],
    ["Bearing Housing", formData.bearingHousing],
    ["Suction Housing", formData.suctionHousing],
    ["Joint Type", formData.jointType],
  ];

  const mocItems: FieldItem[] = [
    ["Bearing Housing MOC", withRemarks(formData.mocAiBearingHousing, formData.mocAiBearingHousingRemarks)],
    ["Base Plate MOC", withRemarks(formData.mocAiBasePlate, formData.mocAiBasePlateRemarks)],
    ["Tie Rod MOC", withRemarks(formData.mocAiTieRod, formData.mocAiTieRodRemarks)],
    ["Nut & Bolt MOC", withRemarks(formData.mocAiNutBolt, formData.mocAiNutBoltRemarks)],
    ["Pump Housing MOC", withRemarks(formData.mocAiPumpHousing, formData.mocAiPumpHousingRemarks)],
    ["Rotor MOC", withRemarks(formData.mocAiRotor, formData.mocAiRotorRemarks)],
    ["Shaft MOC", withRemarks(formData.mocAiShaft, formData.mocAiShaftRemarks)],
    ["Stator Rubber", withRemarks(formData.mocAiStatorRubber, formData.mocAiStatorRubberRemarks)],
  ];

  const sealingItems: FieldItem[] = [
    ["Sealing Type", formData.sealingType],
    ["Mechanical Seal Type", formData.sealingSubType],
  ];

  const motorRatingItems: FieldItem[] = [
    ["Drive Motor Rating", formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""],
  ];

  const driveCommonItems: FieldItem[] = [
    ["Drive System", formData.driveSystem],
    ["Motor RPM", formData.motorRPM],
  ];

  const isVBelt = formData.driveSystem === "V-Belt Drive";
  const isGeared = formData.driveSystem === "Geared Motor Drive/Gear Box + Motor";

  // The specific option actually picked on the Drive step — highlighted in
  // the report's positive/confirmed green, same convention as the MOC AI
  // recommendation cells, so the one real selection stands out from the
  // surrounding read-only spec fields.
  const vbeltSelectedItems: FieldItem[] = [
    ["V-Belt Groove", formData.driveVbeltGroove],
    ["Pump Pulley", formData.drivePumpPulley],
    ["Motor Pulley", formData.driveMotorPulley],
    ["Achieved Pump RPM", formData.driveVbeltRpm],
    ["Centre Distance", formData.driveCenterDistance],
    ["V-Belt No.", formData.driveVbeltNo],
  ];
  // Non-Standard pairs each rating-plate field with a % price uplift; for
  // Standard those percentages don't apply, so they're folded in only when set.
  const withPct = (value: unknown, pctValue: unknown): string => {
    const v = value ? String(value) : "";
    const p = pctValue ? String(pctValue) : "";
    if (!v) return "";
    return p ? `${v} (+${p}%)` : v;
  };
  const isNonStd = formData.driveStdNonStd === "Non-Standard";
  const vbeltInputItems: FieldItem[] = [
    ["Drive Motor Speed", formData.driveMotorSpeed ? `${formData.driveMotorSpeed} RPM` : ""],
    ["Drive Motor Make", formData.driveMotorMake],
    ["Motor Mounting", formData.driveMotorMounting],
    ["Std / Non-Std", formData.driveStdNonStd],
    // Efficiency has no % uplift — it selects the motor type, not the price.
    ["Efficiency", formData.driveMotorEfficiency],
    [
      "Protection",
      isNonStd
        ? withPct(formData.driveMotorProtection, formData.driveMotorProtectionPct)
        : formData.driveMotorProtection,
    ],
    [
      "Frequency",
      isNonStd
        ? withPct(formData.driveMotorFrequency, formData.driveMotorFrequencyPct)
        : formData.driveMotorFrequency,
    ],
    [
      "Voltage",
      isNonStd
        ? withPct(formData.driveMotorVoltage, formData.driveMotorVoltagePct)
        : formData.driveMotorVoltage,
    ],
    ["Starter Type", formData.driveStarterType],
    ["Power Supply", formData.drivePowerSupply],
  ];

  // The motor actually picked from the motor master — surfaced in its own
  // highlighted box, mirroring the "Selected V-Belt / Gearbox Option" design
  // so the two confirmed selections read the same way.
  const motorSelectedItems: FieldItem[] = [
    ["Motor Make", formData.driveMotorMake],
    ["Motor Frame Size", formData.driveMotorFrameSize],
    ["Motor Rating (kW)", formData.driveMotorKw],
    ["Motor Type", formData.driveMotorEfficiency],
    ["LP Price", formData.driveMotorLpPrice],
    ["Final Price", formData.driveMotorFinalPrice],
    // Standard motors have no uplift, so the uplifted figure would just repeat
    // Final Price — only Non-Standard gets the extra (increased) price row.
    ...(isNonStd
      ? ([
          ["Final Non-Standard Price", formData.driveMotorPriceUplifted],
        ] as FieldItem[])
      : []),
  ];

  const gearedSelectedItems: FieldItem[] = [
    ["Gearbox Source", formData.gearboxSource],
    ["Gearbox Model", formData.gearboxModel],
    ["Gearbox Output RPM", formData.gearboxOutputRpm],
    ["Gearbox Service Factor", formData.gearboxServiceFactor],
    ["Gearbox Rate", formData.gearboxRatePerNos],
  ];
  const gearedInputItems: FieldItem[] = [
    ["Configuration", formData.gearedConfigType],
    ["Gear Box Shaft Type", formData.gearBoxType],
    ["GB Type", formData.gbConstructionType],
    ["Gear Box Mounting", formData.gearBoxMounting],
    ["Coupling", formData.driveCoupling],
    ["ASF Range", formData.asfRange],
  ];

  const driveSelectedItems = isVBelt ? vbeltSelectedItems : isGeared ? gearedSelectedItems : [];
  // The motor/rating-plate inputs (vbeltInputItems) apply to every drive
  // system now — not just V-Belt — so they always show, with the geared-only
  // gearbox configuration fields appended when that drive type is chosen.
  const driveInputItems: FieldItem[] = isGeared
    ? [...gearedInputItems, ...vbeltInputItems]
    : vbeltInputItems;
  const driveHasAnything =
    hasAny(driveCommonItems) ||
    hasAny(driveSelectedItems) ||
    hasAny(driveInputItems) ||
    hasAny(motorSelectedItems);

  // Mirrors PumpDetailsCard's own displayed rows — kept as a flat field list
  // here too so the PDF export (which can't render that component directly)
  // shows exactly the same "Pump Selection" facts.
  const pumpFields: FieldItem[] = confirmedPump
    ? [
        ["Pump Model", confirmedPump.model],
        ["Stage", confirmedPump.stage != null ? String(confirmedPump.stage) : ""],
        ["Pump Type", formData.pumpType],
        ["AG / BK", formData.agBk],
        ["Pump RPM (VOLE max–min)", confirmedPump.rpmRange],
        ["Nearest Charted Head", `${confirmedPump.headMwc} MWC`],
        ["VOLE Min–Max", `${confirmedPump.voleMin}–${confirmedPump.voleMax}%`],
        ["Mechanical Efficiency", `${confirmedPump.mechEff}%`],
        ["Suction & Discharge Size", cardSize !== null ? String(cardSize) : ""],
        ["Sealing Type", sealingShort(formData.sealingType) || ""],
        ["Testing Status", confirmedPump.isTested ? "Tested" : "Not Tested"],
        ["Testing Remarks", confirmedPump.testingRemarks || ""],
      ]
    : [];

  // Same section list the on-screen boxes render — single source of truth
  // for what "Confirm Pump Selection" bakes into the saved PDF.
  const pdfSections: SelectionSummaryPdfSection[] = [
    { title: "General Information", items: generalInfoItems },
    { title: "Fluid Properties", items: fluidPropertiesItems },
    { title: "Operating Conditions", items: operatingConditionsItems },
    { title: "MOC & Elastomer", items: mocItems },
    { title: "Sealing Details", items: sealingItems },
    { title: "Motor Rating", items: motorRatingItems },
    { title: "Drive Details", items: [...driveCommonItems, ...driveInputItems] },
    {
      title: `Selected ${isVBelt ? "V-Belt" : "Gearbox"} Option`,
      items: driveSelectedItems,
      highlight: true,
    },
    {
      title: "Selected Motor",
      items: motorSelectedItems,
      highlight: true,
    },
  ];

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmSelection = async () => {
    if (!confirmedPump || !projectId) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const { filename, bytes } = await downloadSelectionSummaryPdf({
        projectCode: projectCode || "",
        projectName,
        customerName,
        pumpFields,
        sections: pdfSections,
        generatedBy: user?.name || user?.email || undefined,
      });
      await uploadFinalReport(projectId, filename, bytes);
      // Structured mirror of the same data, for the Reports list's
      // click-to-view summary — best-effort, doesn't block on the PDF
      // upload above having already succeeded.
      await saveReportSummary(projectId, { pumpFields, sections: pdfSections }).catch(() => {});
      setConfirmed(true);
    } catch {
      setConfirmError("Couldn't generate/save the report. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="step-container">
      <Stepper currentStep={8} maxStep={formData.wizardMaxStep} onStepClick={onStepClick} />

      <div className="step-card">
        <h2>Selection Summary</h2>

        <p>
          Review your confirmed pump and its configuration. Go back to any step to
          change something.
          {inputEcho && (
            <>
              {" "}
              (Capacity: <strong>{inputEcho.capacity}</strong>, Head:{" "}
              <strong>{inputEcho.head}</strong>)
            </>
          )}
        </p>

        {isLoading && <p>Loading summary…</p>}

        {error && <p className="error-message">{error}</p>}

        {!isLoading && !error && !confirmedPump && (
          <p>
            No confirmed pump model found for these inputs. Go back and confirm a model
            in the recommendation panel.
          </p>
        )}

        {!isLoading && !error && confirmedPump && (
          <>
            {/* Pump selection at the very top — the anchor of the report. */}
            <PumpDetailsCard
              pump={confirmedPump}
              size={cardSize}
              pumpType={formData.pumpType}
              agBk={formData.agBk}
              sealingType={formData.sealingType}
              stage={confirmedPump.stage}
            />

            <Section title="General Information" items={generalInfoItems} />
            <Section title="Fluid Properties" items={fluidPropertiesItems} />
            <Section title="Operating Conditions" items={operatingConditionsItems} />
            <Section title="MOC & Elastomer" items={mocItems} />
            <Section title="Sealing Details" items={sealingItems} />
            <Section title="Motor Rating" items={motorRatingItems} />

            {driveHasAnything && (
              <div className="mt-4 overflow-hidden rounded-lg border border-line bg-paper">
                <div className="border-b border-line bg-elev px-4 py-2.5">
                  <span className="section-label">Drive Details</span>
                </div>
                <div className="p-4">
                  <FieldGrid items={driveCommonItems} />

                  {hasAny(driveInputItems) && (
                    <div className={hasAny(driveCommonItems) ? "mt-4" : ""}>
                      <FieldGrid items={driveInputItems} />
                    </div>
                  )}

                  {hasAny(driveSelectedItems) && (
                    <div className="mt-4 rounded-md border-2 border-pos bg-[var(--pos-soft)] p-3">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-[var(--pos-strong)]">
                        Selected {isVBelt ? "V-Belt" : "Gearbox"} Option
                      </span>
                      <FieldGrid items={driveSelectedItems} tone="pos" />
                    </div>
                  )}

                  {hasAny(motorSelectedItems) && (
                    <div className="mt-4 rounded-md border-2 border-pos bg-[var(--pos-soft)] p-3">
                      <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-[var(--pos-strong)]">
                        Selected Motor
                      </span>
                      <FieldGrid items={motorSelectedItems} tone="pos" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {confirmError && <p className="error-message">{confirmError}</p>}
        {confirmed && (
          <p className="mt-2 text-[13px] text-pos">
            Report generated and saved — see it on the Reports page.
          </p>
        )}

        <div className="step-actions">
          <button onClick={onPrevious}>Previous</button>

          <button
            disabled={!confirmedPump || !projectId || confirming}
            onClick={handleConfirmSelection}
            title={!projectId ? "No project open" : undefined}
          >
            {confirming
              ? "Generating report…"
              : confirmed
                ? "Regenerate Report"
                : "Confirm Pump Selection"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecommendationStep;
