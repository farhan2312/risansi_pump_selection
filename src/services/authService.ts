import apiClient from "./apiClient";
import { getToken } from "./session";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export const requestAccess = async (
  name: string,
  email: string,
  password: string
) => {
  const { data } = await apiClient.post("/access-requests", {
    name,
    email,
    password,
  });
  return data;
};

export const login = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const { data } = await apiClient.post<LoginResult>("/auth/login", {
    email,
    password,
  });
  return data;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
) => {
  const { data } = await apiClient.post(
    "/auth/change-password",
    { currentPassword, newPassword },
    { headers: { Authorization: `Bearer ${getToken()}` } }
  );
  return data;
};
