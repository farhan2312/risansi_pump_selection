import apiClient from "./apiClient";

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
  // Auth is via the httpOnly session cookie, sent automatically on this
  // same-origin request — no Authorization header needed.
  const { data } = await apiClient.post("/auth/change-password", {
    currentPassword,
    newPassword,
  });
  return data;
};

export const logout = async () => {
  await apiClient.post("/auth/logout");
};
