import apiClient from "./apiClient";

/** Media / Application options for the General Information dropdown, from
 * the media_list reference table (industry + media only — no MOC
 * recommendation data). */
export const listMedia = async (): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>("/media-list");
  return data;
};

/** Adds a media a user typed manually via "Other" so it's available in the
 * dropdown for everyone afterwards. A repeat of an existing media is a
 * no-op server-side (upsert on the unique media column). */
export const addMedia = async (media: string): Promise<void> => {
  await apiClient.post("/media-list", { media });
};
