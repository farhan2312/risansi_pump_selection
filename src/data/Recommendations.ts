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

// Output shape — matches what RecommendationTable / PumpDetailsCard render
export interface PumpRecommendation {
  id: number;
  recommendationId?: string;
  model: string;
  rpm: string;
  /** "2 RPMs as per VE" — VE_max..VE_min, e.g. "249–302". Falls back to rpm. */
  rpmRange?: string;
  flow: string;
  head: string;
  bearingHousing: string;
  suctionHousing: string;
  jointType: string;
  sealingType: string;
  moc: string;
  suctionSize: string;
  deliverySize: string;
  motor: string;
  driveSystem: string;
  score: string;
  availability: string;
  tested: string;
  reportNo: string;
  rejectionReasons?: string[];
  /** True if this is the model the user pinned on an earlier step — may or
   * may not also be the current best match (index 0). */
  isSelected?: boolean;
}
