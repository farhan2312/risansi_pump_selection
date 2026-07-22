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
  temperature: string;
  sg: string;
  ph: string;
  viscosity: string;
  viscosityUnit: string;
  viscosityRange: string;
  rpmRange?: string; // manual RPM band filter: low/medium/high/vhigh
  selectedModel?: string; // pump pinned by the user; persists across steps
  solidPercentage: string;
  solidSize: string;
  pumpType: string;
  bearingHousing: string;
  suctionHousing: string;
  jointType: string;
  driveSystem: string;
  sealingType: string;
  sealingSubType?: string; // MSA / SCG / DCG — Mechanical Seal only
  motorMake?: string;
  gearboxMake?: string;
  motorRPM?: string;
  gearBoxType?: string; // HISO / SISO — Geared Motor Drive only
  gearBoxMounting?: string; // Foot Mount B3 / Flange Mount B5 / Foot cum Flange B35 — Geared Motor Drive only
  asfRange?: string; // Application Service Factor band — Geared Motor Drive only
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
}
