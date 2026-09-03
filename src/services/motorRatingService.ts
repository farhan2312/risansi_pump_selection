import apiClient from "./apiClient";
import type { PumpSelectionFormData } from "../data/Recommendations";

export interface MotorRating {
  model: string;
  /** Charted head the ME / Min-KW-tested lookup came from. */
  headMwc: number;
  /** Duty head (MWC) actually used in the BKW formula - the entered head. */
  dutyHeadMwc: number;
  mechEff: number;
  bkw: number | null;
  motorKw: number | null;
  minKwTested: number | null;
  kwOptions: number[];
  recommendedKw: number | null;
  exceedsMinTested: boolean;
}

/** Motor Rating KW calculation for the confirmed model at the duty point. */
export const getMotorRating = async (
  formData: PumpSelectionFormData
): Promise<MotorRating> => {
  const { data } = await apiClient.post<MotorRating>("/motor-rating", {
    model: formData.selectedModel,
    capacity: formData.capacity,
    capacityUnit: formData.capacityUnit,
    head: formData.head,
    headUnit: formData.headUnit,
    // Charted head picked for this model - sources ME / Min KW tested so the
    // step matches the card the pump was chosen from.
    selectedHead: formData.selectedHead,
    sg: formData.sg,
  });
  return data;
};
