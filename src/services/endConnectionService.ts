import apiClient from "./apiClient";

/** End Connection options for the Fluid step, from end_connection_master. */
export const listEndConnections = async (): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>("/end-connections");
  return data;
};

/** Adds a value typed into "Other" so it is available to everyone afterwards.
 *  Returns the stored value (an existing one when it already exists, whatever
 *  its case) and the updated list. */
export const addEndConnection = async (value: string): Promise<{ value: string; options: string[] }> => {
  const { data } = await apiClient.post<{ value: string; options: string[] }>("/end-connections", { value });
  return data;
};
