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

export const users = pgTable("users", {
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

export const pumpModelMaster = pgTable("pump_model_master", {
  model: varchar("model", { length: 100 }).primaryKey(),
  pumpFamily: varchar("pump_family", { length: 20 }).default("PCP"),
  capacityMin: numeric("capacity_min", { precision: 10, scale: 2 }),
  capacityMax: numeric("capacity_max", { precision: 10, scale: 2 }),
  headMin: numeric("head_min", { precision: 10, scale: 2 }),
  headMax: numeric("head_max", { precision: 10, scale: 2 }),
  rpmMin: integer("rpm_min"),
  rpmMax: integer("rpm_max"),
  maxSolidPct: numeric("max_solid_pct", { precision: 5, scale: 2 }),
  qTheoretical: numeric("q_theoretical", { precision: 10, scale: 4 }),
  minKwTested: numeric("min_kw_tested", { precision: 10, scale: 2 }),
  minKwCalculated: numeric("min_kw_calculated", { precision: 10, scale: 2 }),
  minKwSource: varchar("min_kw_source", { length: 20 }),
});

export const performanceCurve = pgTable("performance_curve", {
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

// Growable media/application list for the pump-selection wizard — unlike the
// tables above, this one was created by this app (id/created_at have real
// Postgres-side defaults: gen_random_uuid()/now(), plus a case-insensitive
// unique index on name so "Chemical" and "chemical" can't both exist).
export const mediaTypes = pgTable("media_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
