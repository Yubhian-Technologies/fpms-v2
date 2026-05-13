import axios, { AxiosHeaders } from "axios";

// In production (Vercel), VITE_BACKEND_URL is empty → use relative paths so
// Vercel's /api/* rewrite forwards requests to the serverless function on the
// same domain. In local dev, fall back to the local Express server.
const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");


export const api = axios.create({
  baseURL: backendUrl,
});

// ── Warmup ping ──────────────────────────────────────────────────────────────
// Vercel serverless functions go cold after ~5 min of inactivity.
// When the user returns to the tab, ping /api/health to wake the function
// before real data requests are fired, preventing cold-start 5xx failures.
let warmupTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWarmup() {
  if (warmupTimer) clearTimeout(warmupTimer);
  // Small delay so the ping fires after the browser tab regains focus
  warmupTimer = setTimeout(() => {
    axios.get(`${backendUrl}/api/health`).catch(() => {});
    warmupTimer = null;
  }, 300);
}

// Ping once on initial load and again every time the user returns to the tab
scheduleWarmup();
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleWarmup();
  });
}
// ─────────────────────────────────────────────────────────────────────────────

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
    } catch (e) {
      console.error("Failed to parse user data:", e);
    }
  }

  return config;
});

// Retry once on network errors / 5xx — catches cold-start transient failures
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as typeof error.config & { _retried?: boolean };
    const status = error.response?.status;

    // Retry once on 502/503/504 (gateway errors during cold start) or no response
    if (!config._retried && (!error.response || status === 502 || status === 503 || status === 504)) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 1500));
      return api(config);
    }

    if (status === 401) {
      localStorage.clear();
      delete api.defaults.headers.common["Authorization"];
      window.location.replace("/login?reason=session_expired");
      return new Promise(() => {});
    }

    return Promise.reject(error);
  },
);
