// Shared types for the pump selection / recommendation engine.
// Mirrors the Postgres master tables (see docs / backend masters sheet).

export interface PumpModelMaster {
  model: string;
  capacityMin: number;
  capacityMax: number;
  headMin: number;
  headMax: number;
  rpmMin: number;
  rpmMax: number;
  maxSolidPct: number;
}

export interface PerformanceCurvePoint {
  model: string;
  rpm: number;
  capacity: number; // m3/hr at this rpm
  head: number; // MWC at this rpm
  ve: number; // volumetric efficiency (0-1)
  efficiency: number; // mechanical efficiency (0-1)
}

export interface VECorrectionRow {
  viscosityMin: number;
  viscosityMax: number | null; // null = open ended
  veCorrection: number;
}

export interface MotorMasterRow {
  kw: number;
  hp: number;
  rpm: number;
}

export interface SuctionVelocityRow {
  mediaType: "Clean Liquid" | "Viscous Liquid" | "Slurry";
  recommendedVelocity: number; // m/s
}

export interface SealChartRow {
  media: string;
  sealType: string;
}

export interface MastersData {
  pumpModels: PumpModelMaster[];
  performanceCurve: PerformanceCurvePoint[];
  veCorrection: VECorrectionRow[];
  motors: MotorMasterRow[];
  suctionVelocity: SuctionVelocityRow[];
  mechanicalSeal: SealChartRow[];
}

// Raw wizard form input (values arrive as strings from <input>/<select>)
export interface PumpSelectionFormData {
  projectName: string;
  customerName: string;
  capacity: string;
  capacityUnit: string;
  head: string;
  headUnit: string;
  media: string;
  temperature: string; // canonical Celsius (derived from temperatureRaw + temperatureUnit)
  temperatureRaw?: string;
  temperatureUnit?: string; // "C" | "F" | "K"
  sg: string;
  ph: string;
  viscosity: string;
  viscosityUnit: string;
  viscosityRange: string;
  viscosityCp?: string; // canonical cP value (cP = cSt × SG when entered in cSt)
  rpmRange?: string; // manual RPM band filter: low/medium/high/vhigh
  selectedModel?: string; // pump picked by the user; persists across steps
  modelConfirmed?: boolean; // true once the picked model is confirmed (gates advancing past Fluid)
  solidPercentage: string;
  solidSize: string;
  solidType?: string; // "Hard Solid" | "Soft Solid" — only relevant when solids > 0
  pumpType: string;
  agBk?: string; // AG / BK feed option — only set when viscosity > 10000 cP
  bearingHousing: string;
  suctionHousing: string;
  jointType: string;
  driveSystem: string;
  sealingType: string;
  sealingSubType?: string; // MSA / SCG / DCG — Mechanical Seal only
  /** Free-text extras the client supplied that no wizard field covers
   * (chemical composition, special service notes). Appended to the MOC AI
   * prompt as a "Client requirements" block. */
  clientRequirements?: string;
  /** Wizard progress: last step visited, and the furthest step ever reached
   * (steps below it stay ticked in the stepper). Persisted on general_info. */
  wizardStep?: number;
  wizardMaxStep?: number;
  motorMake?: string;
  gearboxMake?: string;
  motorRPM?: string;
  gearBoxType?: string; // HISO / SISO — Geared Motor Drive only
  gearedConfigType?: string; // "Geared Motor" | "Gear Box + Motor" — cascades mounting + coupling below
  gbConstructionType?: string; // IN LINE HELICAL / PLANTERY — Geared Motor Drive only
  gearBoxMounting?: string; // Foot Mount B3 (Gear Box + Motor) / Flange Mount B5 / Foot cum Flange B35 (Geared Motor) — cascades on gearedConfigType
  driveCoupling?: string; // derived from gearedConfigType: "Drive Coupling + Driven Coupling" (Gear Box + Motor) / "Driven Coupling" (Geared Motor)
  asfRange?: string; // Application Service Factor band — Geared Motor Drive only
  // Gearbox drive recommendation (manual pick from PBL/PTL/Top Gear masters,
  // screened by RPM window ±20% + Motor KW; narrowed by ASF Range + GB Type)
  gearboxSource?: string; // "PBL" | "PTL" | "Top Gear" — which master the pick came from
  gearboxModel?: string;
  gearboxOutputRpm?: string;
  gearboxServiceFactor?: string;
  gearboxRatePerNos?: string;
  /** Gearbox card picked, then explicitly confirmed. */
  gearboxConfirmed?: boolean;
  // Per-component MOC (manual selection, optionally seeded from the AI
  // recommendation panel) — non-wettable components
  mocAiBearingHousing?: string;
  mocAiBearingHousingRemarks?: string;
  mocAiBasePlate?: string;
  mocAiBasePlateRemarks?: string;
  mocAiTieRod?: string;
  mocAiTieRodRemarks?: string;
  mocAiNutBolt?: string;
  mocAiNutBoltRemarks?: string;
  // Wettable casting components
  mocAiPumpHousing?: string;
  mocAiPumpHousingRemarks?: string;
  mocAiRotor?: string;
  mocAiRotorRemarks?: string;
  mocAiShaft?: string;
  mocAiShaftRemarks?: string;
  // Elastomer
  mocAiStatorRubber?: string;
  mocAiStatorRubberRemarks?: string;
  // The AI's own recommendation, persisted in full so the whole post-
  // generation panel rebuilds on reload — distinct from the manual
  // mocAi<Component> picks above, which are never auto-filled from these.
  mocAiProvider?: string; // "anthropic" (legacy rows may hold "gemini")
  mocAiSuggestedBearingHousing?: string;
  mocAiSuggestedBasePlate?: string;
  mocAiSuggestedTieRod?: string;
  mocAiSuggestedNutBolt?: string;
  mocAiSuggestedPumpHousing?: string;
  mocAiSuggestedRotor?: string;
  mocAiSuggestedShaft?: string;
  mocAiSuggestedStatorRubber?: string;
  mocAiSuggestedSummary?: string;
  mocAiSuggestedAlternatives?: string;
  mocAiSuggestedSealRecommendation?: string;
  mocAiSuggestedSealRationale?: string;
  mocAiGeneratedAt?: string;
  driveMotorKw?: string; // final drive motor rating (KW) chosen on the Motor Rating step
  // V-Belt drive recommendation (Drive step, only when Drive System = V-Belt Drive)
  driveVbeltGroove?: string;
  drivePumpPulley?: string;
  driveMotorPulley?: string;
  driveVbeltRpm?: string; // recommended (or next-best) achieved pump RPM
  driveCenterDistance?: string;
  driveVbeltNo?: string;
  /** Belt card picked, then explicitly confirmed (select-then-confirm gate). */
  vbeltConfirmed?: boolean;
  // Drive System inputs (shown for every drive system)
  driveMotorSpeed?: string; // motor nameplate speed (RPM) — manual, defaults from motorRPM
  driveMotorMake?: string; // BBL / Havells / CGL / ABB / Siemens / Other
  driveMotorMounting?: string; // Foot (B3) / Flange (B5) / Foot cum Flange (B35)
  driveStdNonStd?: string; // Standard / Non-Standard — gates the fields below
  /** Motor efficiency (IE) class — filters the motor_master candidates by
   * motor_type rather than adding to the price. */
  driveMotorEfficiency?: string; // "IE2" / "IE3"
  driveMotorProtection?: string; // free text, e.g. "IP55"
  driveMotorFrequency?: string; // free text, e.g. "50 Hz"
  driveMotorVoltage?: string; // free text, e.g. "415 V"
  // Non-Standard only — % price uplifts, summed then applied once to the
  // selected motor's final price. No efficiency % by design (see above).
  driveMotorProtectionPct?: string;
  driveMotorFrequencyPct?: string;
  driveMotorVoltagePct?: string;
  // Motor picked from the motor_master candidate cards
  driveMotorFrameSize?: string;
  driveMotorLpPrice?: string;
  driveMotorFinalPrice?: string;
  driveMotorPriceUplifted?: string; // finalPrice x (1 + total uplift %)
  /** Motor card picked, then explicitly confirmed. */
  driveMotorConfirmed?: boolean;
  driveStarterType?: string; // Star-Delta / DOL
  drivePowerSupply?: string; // Single Phase / Three Phase
}

// Output shape — matches what RecommendationTable / PumpDetailsCard render.
// Step-3 model screening only: capacity/head -> every pump_model_master model
// that satisfies the duty point. No MOC/sealing/suction-sizing/drive/motor
// fields yet (their master tables don't exist); no score/ranking either,
// since selection is manual (see recommendation-engine.ts findCandidates).
export interface PumpRecommendation {
  id: number;
  model: string;
  /** Nearest charted head point (in pump_model_master) to the input duty head. */
  headMwc: number;
  voleMin: number;
  voleMax: number;
  mechEff: number;
  qth: number;
  isTested: boolean;
  testingRemarks: string | null;
  rpmAtVoleMin: number;
  rpmAtVoleMax: number;
  rpmClassAtVoleMin: string;
  rpmClassAtVoleMax: string;
  /** "VOLE MAX rpm–VOLE MIN rpm", e.g. "249–302". Falls back to a single value. */
  rpmRange: string;
  /** True if this is the model the user pinned on an earlier step. */
  isSelected?: boolean;
  /** Max hard-solid particle size this model can pass (mm), or null if unrecorded. */
  hardSolidMm: number | null;
  /** Max soft-solid particle size this model can pass (mm), or null if unrecorded. */
  softSolidMm: number | null;
  /** Pump stage count (1/2/4/8) derived from the model name. */
  stage: number | null;
  /** Suction/discharge pipe sizes (inches) per viscosity band, sourced from
   * pump_model_master. NULL when this model isn't covered by the source sheet
   * (the flat SIZE_BY_RANGE fallback is used then). */
  sizeVisc0To1000In: number | null;
  sizeVisc1000To3000In: number | null;
  sizeVisc3000To5000In: number | null;
  sizeVisc5000To10000In: number | null;
  sizeViscGt10000In: number | null;
}
