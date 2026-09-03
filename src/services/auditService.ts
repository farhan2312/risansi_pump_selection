import apiClient from "./apiClient";

/** The four "last 24h" counters across the top of the Audit Log page. These
 * are always 24h, independent of the table's own date filter. */
export interface AuditSummary {
  logins24h: number;
  failed24h: number;
  activeUsers24h: number;
  actions24h: number;
}

/** One person's rolled-up usage over the selected range ("Usage by User"). */
export interface AuditUsageRow {
  email: string | null;
  role: string | null;
  actions: number;
  sessions: number;
  lastActive: string | null;
}

/** One recorded event (Activity / Logins & Sessions / Access Changes). */
export interface AuditEventRow {
  id: string;
  email: string | null;
  role: string | null;
  eventType: "login" | "login_failed" | "logout" | "action";
  action: string;
  entity: string | null;
  entityId: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string | null;
}

export interface AuditResponse {
  summary: AuditSummary;
  rows: AuditUsageRow[] | AuditEventRow[];
}

/** System-admin only; the route rejects anyone else with 403. */
export const getAuditLog = async (params: {
  tab: string;
  range: string;
  q?: string;
}): Promise<AuditResponse> => {
  const { data } = await apiClient.get<AuditResponse>("/admin/audit", { params });
  return data;
};
