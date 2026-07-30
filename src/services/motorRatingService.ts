import apiClient from "./apiClient";
import type { PumpSelectionFormData } from "../data/Recommendations";

export interface MotorRating {
  model: string;
  headMwc: number;
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
    sg: formData.sg,
  });
  return data;
};
