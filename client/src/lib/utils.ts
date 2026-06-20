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

  if (normalized === "hod") return "HOD";
  if (normalized === "dean") return "Dean";
  if (normalized === "faculty") return "Faculty";
  if (normalized === "committee" || normalized === "commitee") return "Committee";

  const ACRONYMS = new Set(["t&p", "iqac", "r&d", "hod", "it"]);
  const capitalize = (w: string) =>
    ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  return role
    ? role
        .split(/[\s_]+/)
        .map(capitalize)
        .join(" ")
    : "";
}

// Returns the confirmed score for a submission only after faculty accepts or
// an appeal is resolved. All earlier statuses (submitted, reviewed, appealed)
// are not yet final and should not count toward the displayed score.
export function getConfirmedScore(sub: {
  status?: string | null;
  finalScore?: number | null;
}): number {
  if (sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved" || sub.status === "appeal-expired") {
    return Number(sub.finalScore ?? 0);
  }
  return 0;
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
