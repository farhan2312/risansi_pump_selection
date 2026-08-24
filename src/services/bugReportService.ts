import apiClient from "./apiClient";

export type BugReportType = "bug" | "feature";
export type BugReportSeverity = "Low" | "Medium" | "High" | "Critical";
export type BugReportStatus = "Open" | "In progress" | "Resolved" | "Closed";

// Full row as returned by GET /api/bug-reports (system_admin / Bug Tracker) —
// never includes the raw screenshot bytes; fetch those via
// getBugReportScreenshotUrl() when screenshotFileName is set.
export interface BugReportRow {
  id: string;
  type: BugReportType;
  title: string;
  description: string | null;
  severity: BugReportSeverity;
  page: string | null;
  status: BugReportStatus;
  screenshotFileName: string | null;
  screenshotMimeType: string | null;
  screenshotFileSize: number | null;
  reportedBy: string | null;
  reportedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBugReportInput {
  type: BugReportType;
  title: string;
  description: string;
  severity: BugReportSeverity;
  page: string;
  /** data: URL (e.g. from FileReader or a clipboard paste) — decoded server-side. */
  screenshotDataUrl?: string;
  screenshotFileName?: string;
}

export const createBugReport = async (
  input: CreateBugReportInput
): Promise<Pick<BugReportRow, "id" | "type" | "title" | "description" | "severity" | "page" | "status" | "createdAt">> => {
  const { data } = await apiClient.post("/bug-reports", input);
  return data;
};

/** system_admin only — the Bug Tracker page's list. */
export const listBugReports = async (): Promise<BugReportRow[]> => {
  const { data } = await apiClient.get<BugReportRow[]>("/bug-reports");
  return data;
};

/** system_admin only — triage action on the Bug Tracker page. */
export const updateBugReportStatus = async (
  id: string,
  status: BugReportStatus
): Promise<{ id: string; status: BugReportStatus; updatedAt: string }> => {
  const { data } = await apiClient.patch(`/bug-reports/${id}`, { status });
  return data;
};

/** Relative URL for a report's screenshot (viewable inline via <img src=...>);
 * the browser sends the session cookie automatically since this is same-origin. */
export const getBugReportScreenshotUrl = (id: string): string => `/api/bug-reports/${id}/screenshot`;

export interface BugNotification {
  id: string;
  title: string;
  status: BugReportStatus;
  updatedAt: string;
}

/** The caller's own unread status-change notifications, for the top-bar bell. */
export const getBugNotifications = async (): Promise<{ count: number; items: BugNotification[] }> => {
  const { data } = await apiClient.get("/bug-reports/notifications");
  return data;
};

/** Clears the caller's bell — omit `ids` to mark every unread notification read. */
export const markBugNotificationsRead = async (ids?: string[]): Promise<void> => {
  await apiClient.post("/bug-reports/notifications/read", ids ? { ids } : {});
};
