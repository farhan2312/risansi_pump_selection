import apiClient from "./apiClient";
import type { TechDocConfig, TechDocData } from "../lib/tech-doc";

/** The enquiry's Technical Data Sheet data (confirmed tags, current wizard data). */
export const getEnquiryDocument = async (projectId: string): Promise<TechDocData> => {
  const { data } = await apiClient.get<TechDocData>("/enquiry-document", { params: { projectId } });
  return data;
};

/** Saves one drive group's sheet customisation (replace-all); returns it cleaned. */
export const saveEnquiryDocumentConfig = async (
  projectId: string,
  group: string,
  config: TechDocConfig,
): Promise<TechDocConfig> => {
  const { data } = await apiClient.put<{ config: TechDocConfig }>("/enquiry-document", { projectId, group, config });
  return data.config;
};
