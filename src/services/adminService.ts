import apiClient from "./apiClient";

// Matches the raw snake_case shape returned by userToDict() in the /users route
// handlers — /users and /users/{id} keep the generic snake_case convention
// (like /projects), not the hand-built camelCase shape /auth/login uses.
// Admin-only enforcement is via requireSystemAdmin() server-side, using the
// httpOnly session cookie sent automatically on these same-origin requests.
export type UserRole = "user" | "admin" | "system_admin";
export type UserStatus = "pending" | "active" | "rejected" | "deactivated";

export interface PendingUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/** Every user regardless of status — backs the Users & Access page. */
export const listAllUsers = async (): Promise<PendingUser[]> => {
  const { data } = await apiClient.get<PendingUser[]>("/users");
  return data;
};

export const reviewUser = async (
  userId: string,
  status: "active" | "rejected"
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, {
    status,
  });
  return data;
};

/** Directly creates an already-active user (skips the request/approve flow —
 * a system admin vouching for the account up front). */
export const createUser = async (input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<PendingUser> => {
  const { data } = await apiClient.post<PendingUser>("/users", input);
  return data;
};

/** Any of these may be sent; only the provided keys are updated server-side.
 * Covers editing name/role and deactivating/reactivating/rejecting an
 * existing user, not just the original pending-request review. */
export const updateUser = async (
  userId: string,
  input: { name?: string; role?: UserRole; status?: "active" | "rejected" | "deactivated" }
): Promise<PendingUser> => {
  const { data } = await apiClient.patch<PendingUser>(`/users/${userId}`, input);
  return data;
};

export const deleteUser = async (userId: string): Promise<void> => {
  await apiClient.delete(`/users/${userId}`);
};
