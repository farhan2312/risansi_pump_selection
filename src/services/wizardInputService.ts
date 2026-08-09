import apiClient from "./apiClient";

// Matches the [table] URL segments in /api/wizard-input/[table]/route.ts —
// one autosave table per wizard step (MOC+Sealing merged, Motor Rating +
// Drive-common merged, one table per drive system). See schema.ts for the
// full column lists and split rationale.
export type WizardInputTable =
  | "general-info"
  | "fluid-properties"
  | "operating-conditions"
  | "moc-sealing"
  | "motor-drive"
  | "drive-direct"
  | "drive-vbelt"
  | "drive-geared";

/** Loads the autosaved state for one wizard-input table + project. Returns
 * null if nothing has been saved yet for it — not an error state. */
export const getWizardInput = async (
  table: WizardInputTable,
  projectId: string
): Promise<Record<string, unknown> | null> => {
  try {
    const { data } = await apiClient.get<Record<string, unknown>>(`/wizard-input/${table}`, {
      params: { projectId },
    });
    return data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
};

/** Upserts a slice of autosaved wizard state for one table + project.
 * `fields` is whatever subset of that table's columns is currently known —
 * extra/unknown keys are ignored server-side. */
export const saveWizardInput = async (
  table: WizardInputTable,
  projectId: string,
  fields: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const { data } = await apiClient.put<Record<string, unknown>>(`/wizard-input/${table}`, {
    projectId,
    ...fields,
  });
  return data;
};

/** Uploads the generated MOC PDF report's raw bytes so a saved copy lives
 * alongside the project (moc_sealing_input.document), not just the browser
 * download. Raw binary body (not JSON) — see
 * /api/wizard-input/[table]/document/route.ts. */
export const uploadMocDocument = async (
  projectId: string,
  filename: string,
  bytes: ArrayBuffer
): Promise<void> => {
  await apiClient.post("/wizard-input/moc-sealing/document", bytes, {
    params: { projectId, filename },
    headers: { "Content-Type": "application/pdf" },
  });
};
