import apiClient from "./apiClient";

// Mirrors the pump_selection_input row (Drizzle camelCase) — steps 1-4 of the
// wizard, autosaved per project so the form can restore itself after a refresh.
export interface PumpSelectionInputRow {
  id: string;
  projectId: string;
  capacity: string | null;
  capacityUnit: string | null;
  head: string | null;
  headUnit: string | null;
  media: string | null;
  temperature: string | null;
  temperatureRaw: string | null;
  temperatureUnit: string | null;
  sg: string | null;
  ph: string | null;
  rpmRange: string | null;
  selectedModel: string | null;
  modelConfirmed: boolean | null;
  viscosity: string | null;
  viscosityUnit: string | null;
  viscosityRange: string | null;
  viscosityCp: string | null;
  solidPercentage: string | null;
  solidSize: string | null;
  solidType: string | null;
  pumpType: string | null;
  agBk: string | null;
  bearingHousing: string | null;
  suctionHousing: string | null;
  jointType: string | null;
  sealingType: string | null;
  sealingSubType: string | null;
}

/** Loads the autosaved wizard state for a project. Returns null if nothing has
 * been saved yet for it — not an error state. */
export const getPumpSelectionInput = async (
  projectId: string
): Promise<PumpSelectionInputRow | null> => {
  try {
    const { data } = await apiClient.get<PumpSelectionInputRow>("/pump-selection-input", {
      params: { projectId },
    });
    return data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
};

/** Upserts the autosaved wizard state for a project. `fields` is whatever
 * subset of the step 1-4 form data is currently known — extra/unknown keys are
 * ignored server-side. */
export const savePumpSelectionInput = async (
  projectId: string,
  fields: Record<string, unknown>
): Promise<PumpSelectionInputRow> => {
  const { data } = await apiClient.put<PumpSelectionInputRow>("/pump-selection-input", {
    projectId,
    ...fields,
  });
  return data;
};
