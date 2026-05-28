import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/api/api";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

type Role =
  | "committee"
  | "internal committee"
  | "principle"
  | "vice principle"
  | "hod"
  | "dean"
  | "faculty"
  | "superadmin"
  | "viewer";

interface User {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  role: Role;
  level?: number;
  college?: string;
  department?: string;
  designation?: string;
  designationTarget?: string;
  hasPhd?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  setDemoUser: (role: Role) => void;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (storedUser && token) {
      const parsed: User = JSON.parse(storedUser);
      setUser(parsed);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Self-heal: if principle has no college stored, fetch it from server
      const isPrinciple =
        parsed.role === "principle" || parsed.role === ("admin" as any);
      if (isPrinciple && !parsed.college) {
        api
          .get("/api/admin/college-details")
          .then((res) => {
            const college = res.data?.data?.name || "";
            if (college) {
              const updated = { ...parsed, college };
              localStorage.setItem("user", JSON.stringify(updated));
              setUser(updated);
            }
          })
          .catch(() => {});
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<User | null> => {
    try {
      // Try unified login first (fastest)
      const unified = await api.post("/api/committee/unified-login", {
        email,
        password,
      });
      if (unified.data?.success) {
        localStorage.setItem("token", unified.data.token);
        localStorage.setItem("user", JSON.stringify(unified.data.user));

        api.defaults.headers.common["Authorization"] =
          `Bearer ${unified.data.token}`;
        setUser(unified.data.user);

        return unified.data.user;
      }
    } catch (err) {
      // If unified login fails, continue to role-specific endpoints
    }

    // Try specific role endpoints only if unified login fails
    const endpoints = [
      { role: "faculty", url: "/api/faculty/login" },
      { role: "hod", url: "/api/hod/login" },
      { role: "dean", url: "/api/dean/login" },
      { role: "admin", url: "/api/admin/login" },
      { role: "committee", url: "/api/committee/login" },
    ];

    for (const ep of endpoints) {
      try {
        const res = await api.post(ep.url, { email, password });
        if (res.data.success) {
          const userWithCollege = {
            ...res.data.user,
            college: res.data.user?.college ?? "",
          };
          res.data.user = userWithCollege;
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("user", JSON.stringify(res.data.user));

          api.defaults.headers.common["Authorization"] =
            `Bearer ${res.data.token}`;
          setUser(res.data.user);

          return res.data.user;
        }
      } catch (err) {
        // Continue to next endpoint
        continue;
      }
    }

    return null;
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase());
  };

  const logout = () => {
    localStorage.clear();
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  const setDemoUser = (role: Role) => {
    const demoUser: User = {
      id: "demo-" + role,
      uid: "demo-" + role,
      name: role === "superadmin" ? "Super Admin" : "Demo User",
      email: `${role}@demo.com`,
      role: role,
      college:
        role === "hod" || role === "faculty" || role === "dean"
          ? "Vishnu Institute of Technology"
          : "",
      department: role === "hod" || role === "faculty" ? "CSE" : "",
    };
    localStorage.setItem("user", JSON.stringify(demoUser));
    localStorage.setItem("token", "demo-token-" + role);
    api.defaults.headers.common["Authorization"] = `Bearer demo-token-${role}`;
    setUser(demoUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setDemoUser,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
