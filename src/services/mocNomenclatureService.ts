import apiClient from "./apiClient";

// Mirrors the moc_nomenclature row (Drizzle camelCase). Material fields keep
// the source sheet's slash-separated engineering alternatives (e.g. "CI / MS",
// "EN-19 / EN-8") verbatim.
export interface MocNomenclatureRow {
  id: string;
  mocCode: string;
  prefix: string;
  rubberSuffix: string;
  suffixSrNo: number;
  pumpHousing: string;
  shaft: string;
  rotor: string;
  cRod: string;
  shd: string;
  slv: string;
  bush: string;
  hPin: string;
  pin: string;
  protector: string;
  holder: string;
  statorRubber: string;
}

/** Looks up the full material breakdown for a 4-letter MOC code (e.g. "AAAN",
 * "BBBE"). Returns null if the code isn't in the nomenclature — used when the
 * user hasn't finished picking both MOC + Rubber yet, not an error. */
export const lookupMocNomenclature = async (
  code: string
): Promise<MocNomenclatureRow | null> => {
  try {
    const { data } = await apiClient.get<MocNomenclatureRow>("/moc-nomenclature", {
      params: { code },
    });
    return data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
};
