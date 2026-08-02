import apiClient from "./apiClient";

// Mirrors the pump_model_master row (Drizzle camelCase; pg NUMERIC columns come
// back as strings). Admin-only — enforced server-side via requireAdmin using
// the httpOnly session cookie sent automatically on these same-origin calls.
export interface PumpModelRow {
  id: string;
  model: string;
  headMwc: string;
  voleMin: string | null;
  voleMax: string | null;
  mechEff: string | null;
  qth: string | null;
  minKwExisting: string | null;
  minStartingKwAt1Kg: string | null;
  minKwTested: string | null;
  minKwToBeTested: string | null;
  testingRemarks: string | null;
  hardSolidMm: string | null;
  softSolidMm: string | null;
  /** integer column — pg returns this as a real number, not a string like the numeric columns above. */
  stage: number | null;
}

export type PumpModelPatch = Partial<Omit<PumpModelRow, "id">>;

export const listPumpModelRows = async (): Promise<PumpModelRow[]> => {
  const { data } = await apiClient.get<PumpModelRow[]>("/pump-model-master");
  return data;
};

// Same fields as the PATCH shape — model + headMwc are required server-side,
// everything else is optional. Values arrive as the raw strings from the
// form's <input> elements (numeric fields become NULL server-side when blank).
export type PumpModelInsert = Partial<Omit<PumpModelRow, "id">> & {
  model: string;
  headMwc: string;
};

export const createPumpModelRow = async (
  values: PumpModelInsert
): Promise<PumpModelRow> => {
  const { data } = await apiClient.post<PumpModelRow>("/pump-model-master", values);
  return data;
};

export const updatePumpModelRow = async (
  id: string,
  patch: PumpModelPatch
): Promise<PumpModelRow> => {
  const { data } = await apiClient.patch<PumpModelRow>(`/pump-model-master/${id}`, patch);
  return data;
};

export const deletePumpModelRow = async (id: string): Promise<void> => {
  await apiClient.delete(`/pump-model-master/${id}`);
};

// Distinct solid-capacity values from pump_model_master, split by type.
// Consumed by the Fluid Properties step's Solid Size dropdown — the engine
// filters models on an EXACT match against these values, so a free-text
// input would silently exclude every model.
export interface SolidSizesResponse {
  hard: number[];
  soft: number[];
}

export const listSolidSizes = async (): Promise<SolidSizesResponse> => {
  const { data } = await apiClient.get<SolidSizesResponse>(
    "/pump-model-master/solid-sizes"
  );
  return data;
};
