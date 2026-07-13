import axios from "axios";

// The backend is now this same Next.js app's route handlers, served under
// /api on the same origin — so the default base URL is just "/api". Override
// with NEXT_PUBLIC_API_BASE_URL to point at a different deployment.
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

export default apiClient;
