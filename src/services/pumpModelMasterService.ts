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
