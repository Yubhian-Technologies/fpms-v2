import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRoleLabel(role?: string): string {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "principle" ||
    normalized === "principal" ||
    normalized === "admin"
  ) {
    return "Principal";
  }

  if (
    normalized === "vice principle" ||
    normalized === "vice principal" ||
    normalized === "vice-principal" ||
    normalized === "viceprincipal"
  ) {
    return "Vice Principal";
  }

  if (
    normalized === "internal committee" ||
    normalized === "internal commitee"
  ) {
    return "Internal Committee";
  }

  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
}

export function resolveEvidenceLink(value?: string | null): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^(https?:\/\/|ftp:\/\/|mailto:|tel:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  if (/^www\./i.test(raw)) {
    return `https://${raw}`;
  }

  // Accept bare domains like example.com/path and promote to https URL.
  if (/^[^\s]+\.[^\s]{2,}(\/[^\s]*)?$/i.test(raw)) {
    return `https://${raw}`;
  }

  // Keep text evidence navigable without falling back to a relative app URL.
  if (/\s/.test(raw)) {
    return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
  }

  return `https://${raw}`;
}
