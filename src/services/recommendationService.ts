import apiClient from "./apiClient";
import type {
  PumpRecommendation,
  PumpSelectionFormData,
} from "../data/Recommendations";

type RecommendationsResponse = {
  selectionId: string;
  recommendations: PumpRecommendation[];
  /** True if a selectedModel was sent but is no longer a feasible candidate
   * at the current duty point (e.g. the user changed inputs enough that it
   * no longer fits) — the pick was dropped and results are the plain top-N. */
  pinFellOut?: boolean;
};

export const getRecommendations = async (
  formData: PumpSelectionFormData
): Promise<RecommendationsResponse> => {
  const { data } = await apiClient.post<RecommendationsResponse>(
    "/recommendations",
    formData
  );
  return data;
};

/** Live wizard preview — same engine, but the server does NOT persist a
 * selection/recommendation row (?preview=1). Used by the panel that refreshes
 * as the user fills in each step.
 *
 * `limit` must match how many results the caller actually displays — a pinned
 * (selectedModel) pump is only guaranteed to appear within the returned set,
 * so a caller showing 3 cards must ask for limit 3, not rely on slicing a
 * larger response client-side (the pin could rank 4th/5th and get cut off). */
export const previewRecommendations = async (
  formData: PumpSelectionFormData,
  signal?: AbortSignal,
  limit?: number
): Promise<RecommendationsResponse> => {
  const { data } = await apiClient.post<RecommendationsResponse>(
    "/recommendations?preview=1",
    { ...formData, limit },
    { signal }
  );
  return data;
};

export type ReportField = {
  label: string;
  value: string | number | null;
  available: boolean;
  note: string | null;
  /** AI-generated (Claude) suggestion for fields with no source master data.
   * Distinct from `value` — never tested/calculated, always flagged as such. */
  aiSuggestion?: string | null;
};

export type ReportSection = {
  title: string;
  fields: ReportField[];
};

export type SelectionReport = {
  recommendationId: string;
  model: string;
  mocCodeUsed: string;
  sections: ReportSection[];
};

export const getSelectionReport = async (
  recommendationId: string
): Promise<SelectionReport> => {
  const { data } = await apiClient.get<SelectionReport>(
    `/recommendations/${recommendationId}/report`
  );
  return data;
};
