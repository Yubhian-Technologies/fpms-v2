import axios, { AxiosHeaders } from "axios";

// In production (Vercel), VITE_BACKEND_URL is empty → use relative paths so
// Vercel's /api/* rewrite forwards requests to the serverless function on the
// same domain. In local dev, fall back to the local Express server.
const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");

console.log("[API Config] Backend URL:", backendUrl);

export const api = axios.create({
  baseURL: backendUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);
  config.headers = headers;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    console.log("[API Request] Token found, setting Authorization header");
  } else {
    console.warn("[API Request] ⚠️ NO TOKEN FOUND in localStorage");
    console.log(
      "[API Request] Available localStorage keys:",
      Object.keys(localStorage),
    );
  }

  // Add user info to headers for simplified auth
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      headers.set("x-user-id", user.uid || user.id || "");
      headers.set("x-user-email", user.email || "");
      headers.set("x-user-name", user.name || user.displayName || "");
      headers.set("x-user-role", user.role || "faculty");
      headers.set("x-college", user.college || "");
      headers.set("x-department", user.department || "");
      console.log("[API Request] User headers set:", {
        role: user.role,
        email: user.email,
        id: user.uid || user.id,
      });
    } catch (e) {
      console.error("Failed to parse user data:", e);
    }
  } else {
    console.warn("[API Request] ⚠️ NO USER found in localStorage");
  }

  console.log("[API Request] Final headers:", config.headers);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("🔴 [API] 401 Unauthorized - Auth failed");
      console.log("Token in localStorage:", !!localStorage.getItem("token"));
      console.log("User in localStorage:", !!localStorage.getItem("user"));
    }
    return Promise.reject(error);
  },
);
