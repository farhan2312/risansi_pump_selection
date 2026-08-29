import apiClient from "./apiClient";

// A tag is a distinct pump-selection run under one enquiry. `liquid` mirrors
// general_info_input.media and `pump_type` mirrors operating_conditions_input.
// pump_type - both are read-only, coming straight from the tag's own wizard.
export interface TagRecord {
  id: string;
  project_id: string;
  name: string;
  /** Lifecycle for this tag: Pending / In Progress / Completed. Flipped by
   *  the wizard as the user progresses through this tag's own steps. */
  status: string;
  liquid: string | null;
  pump_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const listTags = async (projectId: string): Promise<TagRecord[]> => {
  const { data } = await apiClient.get<TagRecord[]>("/enquiry-tags", {
    params: { projectId },
  });
  return data;
};

export const createTag = async (
  projectId: string,
  name: string,
): Promise<TagRecord> => {
  const { data } = await apiClient.post<TagRecord>("/enquiry-tags", {
    projectId,
    name,
  });
  return data;
};

export const renameTag = async (tagId: string, name: string): Promise<TagRecord> => {
  const { data } = await apiClient.patch<TagRecord>(`/enquiry-tags/${tagId}`, {
    name,
  });
  return data;
};

/** Refuses on the last remaining tag for a project (server-side 409). */
export const deleteTag = async (tagId: string): Promise<void> => {
  await apiClient.delete(`/enquiry-tags/${tagId}`);
};
