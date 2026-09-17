import apiClient from "./apiClient";
import type { DashboardData } from "../lib/dashboard-shared";

export type { DashboardData, DashboardEnquiry, DashboardTag } from "../lib/dashboard-shared";

/** Everything the Dashboard shows. `from` / `to` are ISO instants; `mine`
 *  limits it to enquiries the signed-in user created. */
export const getDashboard = async (params: {
  from?: string;
  to?: string;
  mine?: boolean;
}): Promise<DashboardData> => {
  const { data } = await apiClient.get<DashboardData>("/dashboard", {
    params: {
      from: params.from || undefined,
      to: params.to || undefined,
      mine: params.mine ? 1 : undefined,
    },
  });
  return data;
};
