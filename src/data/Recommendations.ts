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
  solidPercentage: string;
  solidSize: string;
  pumpType: string;
  bearingHousing: string;
  suctionHousing: string;
  jointType: string;
  driveSystem: string;
  sealingType: string;
  motorMake?: string;
  gearboxMake?: string;
  motorRPM?: string;
}

// Output shape — matches what RecommendationTable / PumpDetailsCard render
export interface PumpRecommendation {
  id: number;
  recommendationId?: string;
  model: string;
  rpm: string;
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
}
