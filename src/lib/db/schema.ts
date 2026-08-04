/**
 * Drizzle mapping of the live Postgres schema, ported from the old
 * azure-functions/shared/models.py. This app only queries the DB, it does not
 * run migrations against it — the column names/types here must match the
 * already-deployed schema exactly.
 *
 * Only the tables the sales portal needs are mapped (the testing-portal tables
 * — test_requisitions, pump_test_reports, pump_test_report_points, test_reports
 * — live with that portal's own migration when it is ported).
 *
 * Note: `pg` returns NUMERIC columns as strings. Read them through the `toNum`
 * helper in the engine rather than assuming they are already numbers.
 */
import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// This project uses `users_pump`, a fork of the shared `users` table (seeded
// once from it). `users` stays owned by the testing portal — we never touch it.
// Export name kept as `users` so all call sites read/write users_pump unchanged.
export const users = pgTable("users_pump", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).default("user"),
  status: varchar("status", { length: 20 }).default("pending"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectCode: varchar("project_code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  clientCode: varchar("client_code", { length: 100 }),
  industry: varchar("industry", { length: 255 }),
  remarks: text("remarks"),
  status: varchar("status", { length: 50 }).default("In Progress"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

// Autosaved wizard state for the pump-selection form, one row per project
// (unique projectId — a project has a single in-progress selection). Covers
// steps 1-4 only (General Info / Fluid Properties / Operating Conditions /
// Sealing) so the form can restore itself after a refresh; later steps
// (MOC/Motor Rating/Drive/Recommendation) are re-derived live from the media
// and duty point, not persisted here. Columns mirror PumpSelectionFormData's
// field names/types exactly (values are the raw strings the wizard's
// <input>/<select> elements produce) so rows can be spread directly into
// formData with no remapping.
export const pumpSelectionInput = pgTable("pump_selection_input", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),

  // Step 1 — General Information
  capacity: varchar("capacity", { length: 50 }),
  capacityUnit: varchar("capacity_unit", { length: 20 }),
  head: varchar("head", { length: 50 }),
  headUnit: varchar("head_unit", { length: 20 }),
  media: varchar("media", { length: 255 }),
  temperature: varchar("temperature", { length: 50 }),
  temperatureRaw: varchar("temperature_raw", { length: 50 }),
  temperatureUnit: varchar("temperature_unit", { length: 5 }),
  sg: varchar("sg", { length: 50 }),
  ph: varchar("ph", { length: 50 }),
  rpmRange: varchar("rpm_range", { length: 20 }),
  selectedModel: varchar("selected_model", { length: 100 }),
  modelConfirmed: boolean("model_confirmed").default(false),

  // Step 2 — Fluid Properties
  viscosity: varchar("viscosity", { length: 50 }),
  viscosityUnit: varchar("viscosity_unit", { length: 20 }),
  viscosityRange: varchar("viscosity_range", { length: 20 }),
  viscosityCp: varchar("viscosity_cp", { length: 50 }),
  solidPercentage: varchar("solid_percentage", { length: 50 }),
  solidSize: varchar("solid_size", { length: 50 }),
  solidType: varchar("solid_type", { length: 20 }),

  // Step 3 — Operating Conditions
  pumpType: varchar("pump_type", { length: 50 }),
  agBk: varchar("ag_bk", { length: 20 }),
  bearingHousing: varchar("bearing_housing", { length: 50 }),
  suctionHousing: varchar("suction_housing", { length: 50 }),
  jointType: varchar("joint_type", { length: 50 }),

  // Step 4 — Sealing Details
  sealingType: varchar("sealing_type", { length: 30 }),
  sealingSubType: varchar("sealing_sub_type", { length: 10 }),

  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

// One row per (model, head) data point — originally an exact mirror of
// `src/assets/pump_model_master.xlsx` (540 rows / 53 models). In that source
// file, qth/minKwExisting/minStartingKwAt1Kg/minKwTested/minKwToBeTested are
// merged cells spanning every head-row of a model (one value governs the
// whole model, not just its head=0 row) — the DB carries that value on every
// row of the model, not just the first, to preserve that meaning. Consumed by
// `findCandidates` in recommendation-engine.ts.
//
// Since seeding: `4H48/50` and `2H48/50` were each split into separate
// `*48`/`*50` models (identical performance data duplicated onto each) per
// user request — neither combined name exists anymore. And hardSolidMm/
// softSolidMm were added from `solid.xlsx` (max hard/soft solid particle size
// the model can pass, in mm) — that source only covers the straight H*/4H*
// model families, not 2H*/L-variant/Barrel models, and not every H*/4H* model
// either (e.g. H48 has no entry) — those rows are NULL.
//
// `stage` (1/2/4/8) is the pump's stage count, derived purely from the model
// name: a leading digit+H prefix (2H/4H/8H…) IS the stage number; a bare
// "H…" prefix (no leading digit) = 1. No 8-stage models exist in this table
// yet. The two Barrel* models have no "H" prefix at all but were classified
// stage 1 too — their own charted head range (0-60) matches the single-stage
// band and there's no 2Barrel/4Barrel counterpart.
export const pumpModelMaster = pgTable(
  "pump_model_master",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    model: varchar("model", { length: 100 }).notNull(),
    headMwc: numeric("head_mwc", { precision: 10, scale: 2 }).notNull(),
    voleMin: numeric("vole_min", { precision: 10, scale: 2 }),
    voleMax: numeric("vole_max", { precision: 10, scale: 2 }),
    mechEff: numeric("mech_eff", { precision: 10, scale: 2 }),
    qth: numeric("qth", { precision: 10, scale: 4 }),
    minKwExisting: numeric("min_kw_existing", { precision: 10, scale: 2 }),
    minStartingKwAt1Kg: numeric("min_starting_kw_at_1kg", { precision: 10, scale: 2 }),
    minKwTested: numeric("min_kw_tested", { precision: 10, scale: 2 }),
    minKwToBeTested: numeric("min_kw_to_be_tested", { precision: 10, scale: 2 }),
    testingRemarks: text("testing_remarks"),
    hardSolidMm: numeric("hard_solid_mm", { precision: 6, scale: 2 }),
    softSolidMm: numeric("soft_solid_mm", { precision: 6, scale: 2 }),
    stage: integer("stage"),
    // Suction/discharge pipe size (inches) per viscosity band, sourced from
    // Model_vs_Viscosity_vs_Size.xlsx. The source is one row per model with 5
    // viscosity columns (0-1000, 1000-3000, 3000-5000, 5000-10000, >10000 cP);
    // stored here on every head-row of the model (same value across a model's
    // rows — same forward-fill pattern as qth/minKwTested). NULL means the
    // model isn't covered by that source sheet.
    sizeVisc0To1000In: numeric("size_visc_0_1000_in", { precision: 6, scale: 2 }),
    sizeVisc1000To3000In: numeric("size_visc_1000_3000_in", { precision: 6, scale: 2 }),
    sizeVisc3000To5000In: numeric("size_visc_3000_5000_in", { precision: 6, scale: 2 }),
    sizeVisc5000To10000In: numeric("size_visc_5000_10000_in", { precision: 6, scale: 2 }),
    sizeViscGt10000In: numeric("size_visc_gt_10000_in", { precision: 6, scale: 2 }),
  },
);

// MOC (Material of Construction) recommendation per media, from
// PCP_MOC_Selection_Sugar_NonSugar.pdf. Despite the filename, that PDF only
// contains the "Non-Sugar Industry Media" table (190 rows) — no Sugar-industry
// section exists in it. `industry` is included so Sugar rows can be added
// later without a schema change; right now every row has industry='Non-Sugar'.
// pH and Temp were given as ranges in the source ("1-2", "20-60") — split into
// min/max per request. Some source cells aren't a plain numeric range (e.g.
// "<1", "N/A", "Variable") — phRaw/tempRaw keep the original text and
// min/max are null in those cases rather than guessed.
export const mocRecommendation = pgTable(
  "moc_recommendation",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    industry: varchar("industry", { length: 20 }).notNull().default("Non-Sugar"),
    sNo: integer("s_no").notNull(),
    media: varchar("media", { length: 255 }).notNull(),
    phMin: numeric("ph_min", { precision: 5, scale: 2 }),
    phMax: numeric("ph_max", { precision: 5, scale: 2 }),
    phRaw: varchar("ph_raw", { length: 20 }),
    tempMin: numeric("temp_min", { precision: 6, scale: 2 }),
    tempMax: numeric("temp_max", { precision: 6, scale: 2 }),
    tempRaw: varchar("temp_raw", { length: 20 }),
    solidPct: numeric("solid_pct", { precision: 5, scale: 2 }),
    abrasive: varchar("abrasive", { length: 20 }),
    corrosive: varchar("corrosive", { length: 20 }),
    minAcceptableMoc: varchar("min_acceptable_moc", { length: 10 }),
    recommendedMoc: varchar("recommended_moc", { length: 10 }),
    elastomer: varchar("elastomer", { length: 50 }),
    remarks: text("remarks"),
    // "MS" (Mechanical Seal) or "GD" (Gland Packing) — derived (not from the
    // source MOC PDFs, which have no seal column) from corrosive severity,
    // temperature, and hazard/flammability cues in the media/remarks per
    // API 682 (ISO 21049) seal-selection guidance: mechanical seals for
    // corrosive (High/Very High), high-temp (>100°C), or hazardous/toxic/
    // flammable duty; gland packing otherwise.
    sealType: varchar("seal_type", { length: 10 }),
  },
);

// MOC nomenclature — decomposes each 4-letter MOC code (e.g. "AAAN", "BBBE")
// into the material used for each of the 11 metal pump components plus the
// stator rubber. Sourced from MOC_D.xlsx: 6 metal-prefix blocks × 5 rubber
// suffixes (N/E/V/F/X = Nitrile/EPDM/Viton/FG Nitrile/Other Rubber) = 30 rows.
// Given a code (e.g. from moc_recommendation.recommended_moc), the app looks
// this up in one query to show/print the full material breakdown for a pump.
// Material cells preserve the source sheet's slash-separated alternatives
// (e.g. "CI / MS", "EN-19 / EN-8") — those are meaningful engineering options,
// not a formatting choice, and must not be split.
export const mocNomenclature = pgTable("moc_nomenclature", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  mocCode: varchar("moc_code", { length: 4 }).notNull().unique(),
  prefix: varchar("prefix", { length: 3 }).notNull(),
  rubberSuffix: varchar("rubber_suffix", { length: 1 }).notNull(),
  suffixSrNo: integer("suffix_sr_no").notNull(),
  pumpHousing: varchar("pump_housing", { length: 50 }).notNull(),
  shaft: varchar("shaft", { length: 50 }).notNull(),
  rotor: varchar("rotor", { length: 50 }).notNull(),
  cRod: varchar("c_rod", { length: 50 }).notNull(),
  shd: varchar("shd", { length: 50 }).notNull(),
  slv: varchar("slv", { length: 50 }).notNull(),
  bush: varchar("bush", { length: 50 }).notNull(),
  hPin: varchar("h_pin", { length: 50 }).notNull(),
  pin: varchar("pin", { length: 50 }).notNull(),
  protector: varchar("protector", { length: 50 }).notNull(),
  holder: varchar("holder", { length: 50 }).notNull(),
  statorRubber: varchar("stator_rubber", { length: 50 }).notNull(),
});

// V-belt/pulley drive selection, from "pulley v belt master.xlsx". Two tables
// mirroring the sheet's own nested structure — a parent "motor option" row
// (model × motor RPM × HP/KW tier, with grooves + shaft dimensions) and child
// "belt band" rows (up to 8 per parent, one per target pump-speed band —
// 180/220/260/300/340/380/420/480 RPM — giving the pulley pair, actual
// achieved RPM, center distance, and V-belt spec for that band). Not every
// parent has all 8 bands — larger-HP motors have fewer (5-6), which is
// genuine source data, not a gap.
//
// `model` is normalized to match pump_model_master (source writes "H-15",
// stored as "H15"). Coverage: only 26 of pump_model_master's 30 single-stage
// models — missing H70L3, H80L6, and both Barrel* models — and no 2H*/4H*
// coverage at all (V-belt drive appears to only be offered for single-stage
// pumps in this catalog). `grooves` (1A/1B/2A/2B/3B/3C/4D/5D) and `vBelt`
// (~50-150) are stored as opaque reference values — their exact engineering
// meaning (belt profile/groove count, pitch length, etc.) wasn't confirmed.
export const pulleyMotorOption = pgTable(
  "pulley_motor_option",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    model: varchar("model", { length: 100 }).notNull(),
    motorRpm: integer("motor_rpm").notNull(),
    srNo: integer("sr_no").notNull(),
    motorHp: numeric("motor_hp", { precision: 6, scale: 2 }),
    motorKw: numeric("motor_kw", { precision: 6, scale: 2 }),
    maxCapAt60Mwc: numeric("max_cap_at_60mwc", { precision: 10, scale: 2 }),
    grooves: varchar("grooves", { length: 10 }),
    pumpShaftDia: numeric("pump_shaft_dia", { precision: 6, scale: 2 }),
    pumpShaftLength: numeric("pump_shaft_length", { precision: 6, scale: 2 }),
    motorShaftDia: numeric("motor_shaft_dia", { precision: 6, scale: 2 }),
    motorShaftLength: numeric("motor_shaft_length", { precision: 6, scale: 2 }),
  },
);

export const pulleyBeltOption = pgTable(
  "pulley_belt_option",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pulleyMotorOptionId: uuid("pulley_motor_option_id")
      .notNull()
      .references(() => pulleyMotorOption.id, { onDelete: "cascade" }),
    targetRpm: integer("target_rpm").notNull(),
    pmpPulley: numeric("pmp_pulley", { precision: 6, scale: 2 }),
    mtrPulley: numeric("mtr_pulley", { precision: 6, scale: 2 }),
    actualRpm: numeric("actual_rpm", { precision: 8, scale: 2 }),
    centerDistance: numeric("center_distance", { precision: 8, scale: 2 }),
    vBelt: numeric("v_belt", { precision: 8, scale: 2 }),
  },
);

// Gearbox selection masters from "pblptlgearBox.xlsx" — three side-by-side
// tables in the source sheet (PBL / PTL / Top Gear), each row-grouped by a
// shared "Power Rating" (merged cell spanning that power tier's rows across
// all three blocks). Mirrored as three separate tables since each block has
// its own independent set of (output RPM, model) options for that power —
// a row in one block existing doesn't imply a matching row exists in another
// ("-" placeholders in the source mean "no option here," and are dropped
// rather than stored). powerRatingRaw preserves the source label verbatim
// (e.g. "0.55kw", "22.00KW" — inconsistent casing/spacing in the sheet
// itself); powerRatingKw is the parsed numeric value for filtering/joining.
// Column builders are stateful per Drizzle table, so each table needs its own
// fresh set of column definitions — a shared object literal passed to
// multiple pgTable() calls would attach the same builder instances to three
// different tables.
const gearboxColumns = () => ({
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  powerRatingRaw: varchar("power_rating_raw", { length: 20 }).notNull(),
  powerRatingKw: numeric("power_rating_kw", { precision: 8, scale: 3 }),
  outputRpm: numeric("output_rpm", { precision: 8, scale: 2 }).notNull(),
  model: varchar("model", { length: 50 }).notNull(),
  gearBoxType: varchar("gear_box_type", { length: 50 }),
  serviceFactor: numeric("service_factor", { precision: 6, scale: 2 }),
  ratePerNos: numeric("rate_per_nos", { precision: 12, scale: 2 }),
});

export const pblGearbox = pgTable("pbl_gearbox", gearboxColumns());
export const ptlGearbox = pgTable("ptl_gearbox", gearboxColumns());
export const topGearGearbox = pgTable("top_gear_gearbox", gearboxColumns());

// Standard motor rating (KW ↔ HP) reference, from "MOTOR RATING.xlsx" — 25
// rows, one KW value per row with its standard HP equivalent. kw is unique.
export const motorRating = pgTable("motor_rating", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kw: numeric("kw", { precision: 8, scale: 3 }).notNull().unique(),
  hp: numeric("hp", { precision: 8, scale: 2 }).notNull(),
});

/*export const performanceCurve = pgTable("performance_curve", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  model: varchar("model", { length: 100 }).notNull(),
  pumpFamily: varchar("pump_family", { length: 20 }).default("PCP"),
  headMwc: numeric("head_mwc", { precision: 10, scale: 2 }),
  veMin: numeric("ve_min", { precision: 6, scale: 2 }),
  veMax: numeric("ve_max", { precision: 6, scale: 2 }),
  mechEfficiency: numeric("mech_efficiency", { precision: 6, scale: 2 }),
  isTested: boolean("is_tested").default(false),
});

export const veCorrection = pgTable("ve_correction", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  pumpFamily: varchar("pump_family", { length: 20 }).default("PCP"),
  viscosityMin: numeric("viscosity_min", { precision: 12, scale: 2 }),
  viscosityMax: numeric("viscosity_max", { precision: 12, scale: 2 }),
  veCorrection: numeric("ve_correction", { precision: 6, scale: 4 }),
});

export const motorMaster = pgTable("motor_master", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kw: numeric("kw", { precision: 10, scale: 2 }),
  hp: numeric("hp", { precision: 10, scale: 2 }),
  rpm: integer("rpm"),
});

export const suctionVelocity = pgTable("suction_velocity", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  mediaType: varchar("media_type", { length: 50 }),
  recommendedVelocity: numeric("recommended_velocity", { precision: 6, scale: 2 }),
});

export const mechanicalSealChart = pgTable("mechanical_seal_chart", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  media: varchar("media", { length: 255 }),
  sealType: varchar("seal_type", { length: 255 }),
});

export const mocMaster = pgTable("moc_master", {
  mocCode: varchar("moc_code", { length: 20 }).primaryKey(),
  pumpHousing: varchar("pump_housing", { length: 100 }),
  shaft: varchar("shaft", { length: 100 }),
  rotor: varchar("rotor", { length: 100 }),
  cRod: varchar("c_rod", { length: 100 }),
  shd: varchar("shd", { length: 100 }),
  slv: varchar("slv", { length: 100 }),
  bush: varchar("bush", { length: 100 }),
  hPin: varchar("h_pin", { length: 100 }),
  pin: varchar("pin", { length: 100 }),
  protector: varchar("protector", { length: 100 }),
  holder: varchar("holder", { length: 100 }),
  statorRubber: varchar("stator_rubber", { length: 100 }),
});

export const mocSelectionGuide = pgTable("moc_selection_guide", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceType: varchar("service_type", { length: 100 }),
  casingMoc: varchar("casing_moc", { length: 255 }),
  rotorMoc: varchar("rotor_moc", { length: 255 }),
  statorMaterial: varchar("stator_material", { length: 255 }),
});

export const sealingSelectionRule = pgTable("sealing_selection_rule", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  condition: varchar("condition", { length: 255 }),
  recommendation: varchar("recommendation", { length: 20 }),
});

export const standardMotorKw = pgTable("standard_motor_kw", {
  kw: numeric("kw", { precision: 10, scale: 2 }).primaryKey(),
});

export const rpmBandMaster = pgTable("rpm_band_master", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  applicationClass: varchar("application_class", { length: 255 }),
  viscosityMin: numeric("viscosity_min", { precision: 12, scale: 2 }),
  viscosityMax: numeric("viscosity_max", { precision: 12, scale: 2 }),
  maxSolidPct: numeric("max_solid_pct", { precision: 5, scale: 2 }),
  rpmMin: integer("rpm_min"),
  rpmMax: integer("rpm_max"),
});

export const pumpSelections = pgTable("pump_selections", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: uuid("project_id"),
  projectName: varchar("project_name", { length: 255 }),
  customerName: varchar("customer_name", { length: 255 }),
  capacity: varchar("capacity", { length: 50 }),
  capacityUnit: varchar("capacity_unit", { length: 20 }),
  head: varchar("head", { length: 50 }),
  headUnit: varchar("head_unit", { length: 20 }),
  media: varchar("media", { length: 255 }),
  temperature: varchar("temperature", { length: 50 }),
  sg: varchar("sg", { length: 50 }),
  ph: varchar("ph", { length: 50 }),
  viscosity: varchar("viscosity", { length: 50 }),
  viscosityUnit: varchar("viscosity_unit", { length: 20 }),
  viscosityRange: varchar("viscosity_range", { length: 50 }),
  solidPercentage: varchar("solid_percentage", { length: 50 }),
  solidSize: varchar("solid_size", { length: 50 }),
  pumpType: varchar("pump_type", { length: 100 }),
  bearingHousing: varchar("bearing_housing", { length: 100 }),
  suctionHousing: varchar("suction_housing", { length: 100 }),
  jointType: varchar("joint_type", { length: 100 }),
  driveSystem: varchar("drive_system", { length: 100 }),
  sealingType: varchar("sealing_type", { length: 100 }),
  motorMake: varchar("motor_make", { length: 100 }),
  gearboxMake: varchar("gearbox_make", { length: 100 }),
  motorRpm: varchar("motor_rpm", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

export const pumpRecommendations = pgTable("pump_recommendations", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  selectionId: uuid("selection_id"),
  model: varchar("model", { length: 100 }),
  rpm: varchar("rpm", { length: 50 }),
  flow: varchar("flow", { length: 50 }),
  head: varchar("head", { length: 50 }),
  bearingHousing: varchar("bearing_housing", { length: 100 }),
  suctionHousing: varchar("suction_housing", { length: 100 }),
  jointType: varchar("joint_type", { length: 100 }),
  sealingType: varchar("sealing_type", { length: 100 }),
  moc: varchar("moc", { length: 100 }),
  suctionSize: varchar("suction_size", { length: 50 }),
  deliverySize: varchar("delivery_size", { length: 50 }),
  motor: varchar("motor", { length: 100 }),
  driveSystem: varchar("drive_system", { length: 100 }),
  score: varchar("score", { length: 20 }),
  availability: varchar("availability", { length: 50 }),
  tested: varchar("tested", { length: 50 }),
  reportNo: varchar("report_no", { length: 100 }),
  rejectionReasons: text("rejection_reasons").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()),
});

// media_types (growable media/application list) was dropped — the wizard's
// Media/Application dropdown now sources from moc_recommendation.media
// instead (see /api/moc-recommendation/media route), which is curated
// reference data rather than something the wizard grows.
*/
