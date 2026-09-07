import apiClient from "./apiClient";
import type { StepApproval } from "../lib/approval";

/** Every approval row for a tag. Steps never ticked have no row yet, so the
 * list is sparse — callers fill the gaps with the Pending default. */
export const listStepApprovals = async (tagId: string): Promise<StepApproval[]> => {
  const { data } = await apiClient.get<StepApproval[]>("/step-approvals", {
    params: { tagId },
  });
  return data;
};

/** Tick or untick one step for approval. */
export const setStepApproval = async (
  tagId: string,
  step: number,
  selected: boolean,
): Promise<StepApproval> => {
  const { data } = await apiClient.put<StepApproval>("/step-approvals", {
    tagId,
    step,
    selected,
  });
  return data;
};

/** Send every ticked, still-Pending step for approval. Returns how many moved
 * plus the tag's full, updated approval list. */
export const sendStepApprovals = async (
  tagId: string,
): Promise<{ sent: number; approvals: StepApproval[] }> => {
  const { data } = await apiClient.post<{ sent: number; approvals: StepApproval[] }>(
    "/step-approvals",
    { tagId },
  );
  return data;
};
