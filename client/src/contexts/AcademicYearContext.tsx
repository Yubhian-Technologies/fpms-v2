import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setViewedAcademicYear } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

export interface AcademicYear {
  id: string;
  status: "active" | "closed";
}

interface AcademicYearContextType {
  currentYear: string;
  years: AcademicYear[];
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  /** Viewing a closed year — everything is read-only */
  isHistory: boolean;
  /** Records have been tagged with their year; year switching is available */
  backfilled: boolean;
  reload: () => Promise<void>;
}

// Shown until the server answers; matches the server's legacy year
const DEFAULT_YEAR = "2025-26";
const STORAGE_KEY = "fpms.selectedAcademicYear";

// "2025-26" → "2025 – 2026" (report headers)
export const formatAcademicYearLong = (year: string) => {
  const start = Number(String(year).slice(0, 4));
  return Number.isFinite(start) ? `${start} – ${start + 1}` : year;
};

const readStoredYear = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeYear = (year: string | null) => {
  try {
    if (year) localStorage.setItem(STORAGE_KEY, year);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — selection just won't persist */
  }
};

const AcademicYearContext = createContext<AcademicYearContextType>({
  currentYear: DEFAULT_YEAR,
  years: [{ id: DEFAULT_YEAR, status: "active" }],
  selectedYear: DEFAULT_YEAR,
  setSelectedYear: () => {},
  isHistory: false,
  backfilled: false,
  reload: async () => {},
});

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentYear, setCurrentYear] = useState(DEFAULT_YEAR);
  const [years, setYears] = useState<AcademicYear[]>([{ id: DEFAULT_YEAR, status: "active" }]);
  const [backfilled, setBackfilled] = useState(false);
  // A past year the user deliberately picked; null = follow the current year.
  // (Defaulting to a fixed year here used to leave fresh browsers stuck in
  // last year's read-only history once a new year started.)
  const [chosenYear, setChosenYear] = useState<string | null>(() => readStoredYear());
  const [yearsLoaded, setYearsLoaded] = useState(false);
  const selectedYear =
    chosenYear && chosenYear !== currentYear && years.some((y) => y.id === chosenYear) ? chosenYear : currentYear;

  const reload = useCallback(async () => {
    try {
      const res = await api.get("/api/academic-years", { params: { year: "" } });
      const data = res.data?.data;
      if (!data?.current) return;
      setCurrentYear(data.current);
      setYears(data.years?.length ? data.years : [{ id: data.current, status: "active" }]);
      setBackfilled(Boolean(data.backfilled));
      setYearsLoaded(true);
    } catch {
      /* keep defaults — the app behaves as single-year */
    }
  }, []);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  const isHistory = selectedYear !== currentYear;

  // A saved choice equal to the current year is no choice at all — drop it so it
  // doesn't become a stale history view after the next year starts
  useEffect(() => {
    if (yearsLoaded && chosenYear === currentYear) {
      setChosenYear(null);
      storeYear(null);
    }
  }, [yearsLoaded, chosenYear, currentYear]);

  // Keep the API client in sync before children fetch
  setViewedAcademicYear(isHistory ? selectedYear : null);

  const setSelectedYear = useCallback(
    (year: string) => {
      setChosenYear(year === currentYear ? null : year);
      storeYear(year === currentYear ? null : year);
      setViewedAcademicYear(year === currentYear ? null : year);
      queryClient.invalidateQueries();
    },
    [currentYear, queryClient],
  );

  const value = useMemo(
    () => ({ currentYear, years, selectedYear, setSelectedYear, isHistory, backfilled, reload }),
    [currentYear, years, selectedYear, setSelectedYear, isHistory, backfilled, reload],
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export const useAcademicYear = () => useContext(AcademicYearContext);
