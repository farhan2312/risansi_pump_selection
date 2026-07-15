import apiClient from "./apiClient";

export interface MediaType {
  id: string;
  name: string;
  created_at: string;
}

export const listMediaTypes = async (): Promise<MediaType[]> => {
  const { data } = await apiClient.get<MediaType[]>("/media-types");
  return data;
};

/** Adds a new media type — or, if one already exists with the same name
 * (case-insensitive), returns that existing row instead of duplicating it. */
export const createMediaType = async (name: string): Promise<MediaType> => {
  const { data } = await apiClient.post<MediaType>("/media-types", { name });
  return data;
};
