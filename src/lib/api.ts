/**
 * Shared helpers for the route handlers — JSON responses and the snake_case
 * row serializers that match the old function_app.py `_row_to_dict` /
 * `_user_to_dict` conventions the frontend services still expect.
 */
import { NextResponse } from "next/server";

import type * as schema from "./db/schema";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400): NextResponse {
  return json({ error: message }, status);
}

type UserRow = typeof schema.users.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;
type SelectionRow = typeof schema.pumpSelections.$inferSelect;

/** Mirrors _user_to_dict(): raw snake_case columns, minus password_hash. */
export function userToDict(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    reviewed_by: u.reviewedBy,
    reviewed_at: u.reviewedAt,
    created_at: u.createdAt,
  };
}

/** Mirrors _row_to_dict(Project): raw snake_case columns, plus the creator's
 * display name (joined separately — projects.created_by is just a user id). */
export function projectToDict(p: ProjectRow, createdByName?: string | null) {
  return {
    id: p.id,
    project_code: p.projectCode,
    name: p.name,
    customer_name: p.customerName,
    client_code: p.clientCode,
    industry: p.industry,
    remarks: p.remarks,
    status: p.status,
    created_by: p.createdBy,
    created_by_name: createdByName ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

/** Mirrors _row_to_dict(PumpSelection): raw snake_case columns. */
export function selectionToDict(s: SelectionRow) {
  return {
    id: s.id,
    project_id: s.projectId,
    project_name: s.projectName,
    customer_name: s.customerName,
    capacity: s.capacity,
    capacity_unit: s.capacityUnit,
    head: s.head,
    head_unit: s.headUnit,
    media: s.media,
    temperature: s.temperature,
    sg: s.sg,
    ph: s.ph,
    viscosity: s.viscosity,
    viscosity_unit: s.viscosityUnit,
    viscosity_range: s.viscosityRange,
    solid_percentage: s.solidPercentage,
    solid_size: s.solidSize,
    pump_type: s.pumpType,
    bearing_housing: s.bearingHousing,
    suction_housing: s.suctionHousing,
    joint_type: s.jointType,
    drive_system: s.driveSystem,
    sealing_type: s.sealingType,
    motor_make: s.motorMake,
    gearbox_make: s.gearboxMake,
    motor_rpm: s.motorRpm,
    created_at: s.createdAt,
  };
}

export function toFloat(v: unknown, fallback = 0.0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isNaN(n) ? fallback : n;
}
