import apiClient from "./apiClient";

// Matches the raw snake_case shape returned by userToDict() in the /users route
// handlers — /users and /users/{id} keep the generic snake_case convention
// (like /projects), not the hand-built camelCase shape /auth/login uses.
// Admin-only enforcement is via requireAdmin() server-side, using the
// httpOnly session cookie sent automatically on these same-origin requests.
export interface PendingUser {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  status: "pending" | "active" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const listPendingUsers = async (): Promise<PendingUser[]> => {
  const { data } = await apiClient.get<PendingUser[]>("/users", {
    params: { status: "pending" },
  });
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
