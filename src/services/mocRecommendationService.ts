import apiClient from "./apiClient";

/** Media / Application list sourced from the moc_recommendation reference
 * table (curated MOC selection data — Sugar + Non-Sugar industry media). */
export const listMocMedia = async (): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>("/moc-recommendation/media");
  return data;
};
