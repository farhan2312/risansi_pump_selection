"use client";

import "./GeneralInformationStep.css";
import Stepper from "./Stepper";
import { useEffect, useState } from "react";
import { getRecommendations } from "../../services/recommendationService";
import { SIZE_COLUMN_BY_RANGE, sizeForViscosityRange } from "../../lib/suction-discharge-size";
import { phDisplay, temperatureDisplay, viscosityDisplay } from "../../lib/fluid-inputs";
import {
  downloadSelectionSummaryPdf,
  type SelectionSummaryPdfSection,
} from "../../lib/selection-summary-pdf";
import { getReportSummary, saveReportSummary, uploadFinalReport } from "../../services/reportsService";
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
  /** The tag being edited. Kept for parity with other steps; not used yet. */
  tagId?: string;
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
  tagId,
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

  // Values are computed at the INPUT duty head (the engine's duty-point row),
  // not the head card the user clicked — motor rating / drive / report all key
  // off the entered head, so the summary matches them.
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

  // These two lists mirror what each wizard step actually collects — see
  // GeneralInformationStep / FluidPropertiesStep. Temperature and pH belong to
  // the Fluid step (they were moved there), not General Information.
  // --- Quotation-format field groups (single liquid), mirroring the Risansi
  // technical-quotation layout: Liquid Parameters, Material of Construction,
  // Sealing Type, Pump Details, Drive Systems.

  const liquidParametersItems: FieldItem[] = [
    ["Liquid / Application", formData.media],
    ["Type of Pump", formData.pumpType],
    ["Pump Model", confirmedPump ? confirmedPump.model : ""],
    ["Capacity", formData.capacity ? `${formData.capacity} ${formData.capacityUnit || ""}`.trim() : ""],
    ["Head", formData.head ? `${formData.head} ${formData.headUnit || ""}`.trim() : ""],
    ["Specific Gravity", formData.sg],
    ["pH", phDisplay(formData)],
    ["Temperature", temperatureDisplay(formData)],
    ["Viscosity", viscosityDisplay(formData)],
    ["Viscosity Range", formData.viscosityRange ? `${formData.viscosityRange} cP` : ""],
    ["Solids", formData.solidPercentage ? `${formData.solidPercentage}%` : ""],
    [
      "Particle Size",
      formData.solidSize
        ? `${formData.solidSize} mm${formData.solidType ? ` (${formData.solidType})` : ""}`
        : "",
    ],
    ["AG / BK", formData.agBk],
    ["RPM Range", formData.rpmRange ? RPM_RANGE_LABELS[formData.rpmRange] ?? formData.rpmRange : ""],
  ];

  const materialOfConstructionItems: FieldItem[] = [
    ["Bearing Housing", withRemarks(formData.mocAiBearingHousing, formData.mocAiBearingHousingRemarks)],
    ["Pump Housing", withRemarks(formData.mocAiPumpHousing, formData.mocAiPumpHousingRemarks)],
    ["Shaft", withRemarks(formData.mocAiShaft, formData.mocAiShaftRemarks)],
    ["Rotor", withRemarks(formData.mocAiRotor, formData.mocAiRotorRemarks)],
    ["Rubber Stator", withRemarks(formData.mocAiStatorRubber, formData.mocAiStatorRubberRemarks)],
    ["Stator Sleeve", withRemarks(formData.mocAiStatorSleeve, formData.mocAiStatorSleeveRemarks)],
    // Only one plate applies per pump type; FieldGrid drops the empty one.
    ["Base Plate", withRemarks(formData.mocAiBasePlate, formData.mocAiBasePlateRemarks)],
    ["Mounting Plate", withRemarks(formData.mocAiMountingPlate, formData.mocAiMountingPlateRemarks)],
    ["Tie Rod", withRemarks(formData.mocAiTieRod, formData.mocAiTieRodRemarks)],
    ["Nut & Bolt", withRemarks(formData.mocAiNutBolt, formData.mocAiNutBoltRemarks)],
  ];

  const pumpDetailsItems: FieldItem[] = confirmedPump
    ? [
        ["Suction & Discharge Size", cardSize !== null ? String(cardSize) : ""],
        ["Pump Speed (RPM)", confirmedPump.rpmRange],
        ["Pump Stage", confirmedPump.stage != null ? String(confirmedPump.stage) : ""],
        [
          "VOLE Min–Max",
          confirmedPump.voleMin != null && confirmedPump.voleMax != null
            ? `${confirmedPump.voleMin}–${confirmedPump.voleMax}%`
            : "",
        ],
        ["Mechanical Efficiency", confirmedPump.mechEff != null ? `${confirmedPump.mechEff}%` : ""],
        ["Bearing Housing (Type)", formData.bearingHousing],
        ["Suction Housing", formData.suctionHousing],
        ["Joint Type", formData.jointType],
      ]
    : [];

  const sealingItems: FieldItem[] = [
    ["Sealing Type", formData.sealingType],
    // Mechanical Seal detail (empty rows are dropped by FieldGrid, so only the
    // fields relevant to the chosen arrangement show).
    ["Mechanical Seal Type", formData.sealingSubType],
    ["Seal MOC", formData.mechSealMoc],
    ["Seal Face", formData.mechSealFace],
    ["Seal Make", formData.mechSealMake],
    // Gland Packing detail.
    ["Gland Packing Type", formData.glandPackingType],
    ["Gland Packing Make", formData.glandPackingMake],
  ];

  const motorRatingItems: FieldItem[] = [
    ["Drive Motor Rating", formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""],
  ];

  const driveCommonItems: FieldItem[] = [
    ["Drive System", formData.driveSystem],
    ["Motor RPM", formData.motorRPM],
    ["Drive Motor Rating", formData.driveMotorKw ? `${formData.driveMotorKw} kW` : ""],
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
    ["GB Type", formData.gbConstructionType],
    ["Gear Box Shaft Type", formData.gearBoxType],
    ["Gear Box Mounting", formData.gearBoxMounting],
    ["Coupling", formData.driveCoupling],
    // Only populated when a real coupling is present; FieldGrid drops empties.
    ["Coupling Type", formData.couplingType],
    ["Coupling Make", formData.couplingMake],
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

  // Pump data now lives in the Liquid Parameters + Pump Details sections
  // (quotation layout), so there's no separate top "Pump Selection" block.
  const pumpFields: FieldItem[] = [];

  // Same section list the on-screen boxes render — single source of truth
  // for what "Confirm Pump Selection" bakes into the saved PDF.
  const pdfSections: SelectionSummaryPdfSection[] = [
    { title: "Liquid Parameters", items: liquidParametersItems },
    { title: "Material of Construction", items: materialOfConstructionItems },
    { title: "Sealing Type", items: sealingItems },
    { title: "Pump Details", items: pumpDetailsItems },
    { title: "Drive Systems", items: [...driveCommonItems, ...driveInputItems] },
    {
      title: `Selected ${isVBelt ? "V-Belt" : "Gearbox"} Option`,
      items: driveSelectedItems,
      highlight: true,
    },
    // Motor type & rating are already carried in Drive Systems above, so no
    // separate "Selected Motor" section in the PDF.
  ];

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Persist the "confirmed" (green summary) state across reloads: if this tag
  // already has a saved report summary, the selection was confirmed on an
  // earlier visit, so start green rather than waiting for another click.
  useEffect(() => {
    if (!tagId) return;
    let cancelled = false;
    getReportSummary(tagId)
      .then((summary) => {
        if (!cancelled && summary) setConfirmed(true);
      })
      .catch(() => {
        // No summary / fetch error — leave unconfirmed; the button still works.
      });
    return () => {
      cancelled = true;
    };
  }, [tagId]);

  const handleConfirmSelection = async () => {
    // Reports live on the tag now (a project can carry N tags, each with its
    // own final report). The Confirm button is gated on projectId AND tagId
    // - if we have a project open but no tag id (legacy handoff), the server
    // wouldn't know which tag's row to write.
    if (!confirmedPump || !projectId || !tagId) return;
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
      await uploadFinalReport(tagId, filename, bytes);
      // Structured mirror of the same data, for the Reports list's
      // click-to-view summary — best-effort, doesn't block on the PDF
      // upload above having already succeeded.
      await saveReportSummary(tagId, { pumpFields, sections: pdfSections }).catch(() => {});
      setConfirmed(true);
    } catch {
      setConfirmError("Couldn't generate/save the report. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="step-container">
      <Stepper
        currentStep={8}
        maxStep={formData.wizardMaxStep}
        onStepClick={onStepClick}
        finalCompleted={confirmed}
      />

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
            <Section title="Liquid Parameters" items={liquidParametersItems} />
            <Section title="Material of Construction" items={materialOfConstructionItems} />
            <Section title="Sealing Type" items={sealingItems} />
            <Section title="Pump Details" items={pumpDetailsItems} />

            {driveHasAnything && (
              <div className="mt-4 overflow-hidden rounded-lg border border-line bg-paper">
                <div className="border-b border-line bg-elev px-4 py-2.5">
                  <span className="section-label">Drive Systems</span>
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
            disabled={!confirmedPump || !projectId || !tagId || confirming}
            onClick={handleConfirmSelection}
            title={
              !projectId
                ? "No project open"
                : !tagId
                  ? "No tag open - reports are per-tag; open a tag from the Projects page"
                  : undefined
            }
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
