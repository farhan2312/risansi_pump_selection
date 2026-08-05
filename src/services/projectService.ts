import apiClient from "./apiClient";

// Matches projectToDict() in lib/api.ts — raw snake_case columns plus the
// joined creator display name.
export interface ProjectRecord {
  id: string;
  project_code: string;
  name: string | null;
  customer_name: string | null;
  client_code: string | null;
  industry: string | null;
  remarks: string | null;
  status: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export const listProjects = async (): Promise<ProjectRecord[]> => {
  const { data } = await apiClient.get<ProjectRecord[]>("/projects");
  return data;
};

/** Fetches a single project, for validating a stashed sessionStorage
 * selection is still real (e.g. wasn't deleted since it was picked). Returns
 * null on 404 — not an error state. */
export const getProject = async (id: string): Promise<ProjectRecord | null> => {
  try {
    const { data } = await apiClient.get<ProjectRecord>(`/projects/${id}`);
    return data;
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return null;
    throw err;
  }
};

export interface CreateProjectInput {
  name: string;
  clientCode: string;
  industry: string;
}

export const createProject = async (
  input: CreateProjectInput
): Promise<ProjectRecord> => {
  const { data } = await apiClient.post<ProjectRecord>("/projects", input);
  return data;
};

// Any of these may be sent; only the provided keys are updated server-side.
export interface UpdateProjectInput {
  name?: string;
  customerName?: string;
  clientCode?: string;
  industry?: string;
  status?: string;
  remarks?: string;
}

export const updateProject = async (
  id: string,
  input: UpdateProjectInput
): Promise<ProjectRecord> => {
  const { data } = await apiClient.patch<ProjectRecord>(`/projects/${id}`, input);
  return data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};
