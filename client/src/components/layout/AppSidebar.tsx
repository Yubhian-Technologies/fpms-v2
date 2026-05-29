import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatRoleLabel } from "@/lib/utils";
import { api } from "@/api/api";
import vishnuLogo from "@/assets/vishnu.png";
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  ClipboardCheck,
  BarChart3,
  Briefcase,
  MessageSquare,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  KeyRound,
  UserCheck,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DynamicFormItem {
  id: string;
  formTitle: string;
  criteria: Array<{ id: string; criteriaName: string; order: number }>;
}

interface NavChild {
  title: string;
  href: string;
  isLoading?: boolean;
}

const normalizeRoleForAccess = (role?: string) => {
  const value = String(role || "")
    .trim()
    .toLowerCase();

  if (value.startsWith("dean")) return "dean";
  if (value === "principal" || value === "principle" || value === "admin") {
    return "principle";
  }
  if (
    value === "vice principal" ||
    value === "vice principle" ||
    value === "vice-principal" ||
    value === "viceprincipal"
  ) {
    return "vice principle";
  }

  if (value === "internal committee" || value === "internal commitee") {
    return "internal committee";
  }

  return value;
};

const getNavItems = (
  role: string,
  dynamicForms: DynamicFormItem[],
  isFormsLoading: boolean,
  isInternalCommittee?: boolean,
) => {
  const resolvedRole = normalizeRoleForAccess(role);
  const dynamicFpmsChildren = dynamicForms
    .flatMap((form) =>
      (Array.isArray(form.criteria) ? form.criteria : [])
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        .map((criteria) => ({
          title: criteria.criteriaName || form.formTitle,
          href: `/fpms/forms/${form.id}/criteria/${criteria.id}`,
        })),
    )
    .filter(
      (item, index, array) =>
        item.title &&
        array.findIndex(
          (entry) => entry.title === item.title && entry.href === item.href,
        ) === index,
    );

  const resolvedDynamicChildren: NavChild[] = isFormsLoading
    ? [{ title: "Loading sections...", href: "#", isLoading: true }]
    : dynamicFpmsChildren;

  const items = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/dashboard",
      roles: [
        "faculty",
        "hod",
        "committee",
        "internal committee",
        "principle",
        "dean",
        "vice principle",
        "viewer",
      ],
    },
    {
      icon: FileText,
      label: "Form Builder",
      href: "/superadmin/form-builder",
      roles: ["superadmin"],
    },
    {
      icon: Users,
      label: "Role Management",
      href: "/superadmin/roles",
      roles: ["superadmin"],
    },
    {
      icon: Building2,
      label: "Manage Colleges",
      href: "/superadmin/colleges",
      roles: ["superadmin"],
    },
    {
      icon: UserCheck,
      label: "Committee Member",
      href: "/superadmin/committee-member",
      roles: ["superadmin"],
    },
    {
      icon: FileText,
      label: "FPMS Form",
      roles: ["faculty", "internal committee", "hod", "dean", "principle", "vice principle"],
      isDropdown: true,
      dropdownId: "Dynamic FPMS Form",
      children: resolvedDynamicChildren,
    },
    {
      icon: MessageSquare,
      label: "My Submissions",
      href: "/submissions",
      roles: ["faculty", "internal committee", "hod", "dean"],
    },
    {
      icon: ClipboardCheck,
      label: "Add Dean",
      href: "/add-dean",
      roles: ["principle", "vice principle"],
    },
    {
      icon: ClipboardCheck,
      label: "Add HOD",
      href: "/add-hod",
      roles: ["principle", "vice principle"],
    },
    {
      icon: ClipboardCheck,
      label: "Add Internal Committee",
      href: "/add-internal-committee",
      roles: ["principle"],
    },
    {
      icon: ClipboardCheck,
      label: "Review Submissions",
      href: "/review",
      roles: ["hod", "internal committee", "dean", "vice principle", "principle"],
    },
    {
      icon: ClipboardCheck,
      label: "Review Appeals",
      href: "/appeal-review",
      roles: ["vice principle", "principle", "internal committee"],
    },
    {
      icon: BarChart3,
      label: "Reports",
      href: "/reports",
      roles: [""],
    },
    {
      icon: Briefcase,
      label: "Designations",
      href: "/designations",
      roles: ["principle"],
    },
    { icon: Users, label: "Faculty List", href: "/faculty", roles: ["hod"] },
    {
      icon: Building2,
      label: "Departments",
      href: "/departments",
      roles: ["principle"],
    },
    {
      icon: MessageSquare,
      label: "College",
      href: "/college",
      roles: ["committee"],
    },
    {
      icon: ClipboardCheck,
      label: "Add Principal",
      href: "/add",
      roles: ["committee"],
    },
    {
      icon: ClipboardCheck,
      label: "Add Vice Principal",
      href: "/add-vice-principal",
      roles: ["committee"],
    },
    {
      icon: UserCheck,
      label: "Add Viewer",
      href: "/add-viewer",
      roles: ["committee"],
    },
    // {
    //   icon: Settings,
    //   label: "Settings",
    //   href: "/settings",
    //   roles: ["committee"],
    // },
    {
      icon: ClipboardCheck,
      label: "Workflow Rules",
      href: "/workflow-rules",
      roles: ["principle", "vice principle"],
    },
    {
      icon: ClipboardCheck,
      label: "My Appeals",
      href: "/my-appeals",
      roles: ["faculty", "internal committee", "dean", "hod"],
    },
    {
      icon: KeyRound,
      label: "Change Password",
      href: "/change-password",
      roles: [
        "faculty",
        "hod",
        "committee",
        "internal committee",
        "principle",
        "dean",
        "vice principle",
        "superadmin",
        "viewer",
      ],
    },
  ];

  return items.filter(
    (item) =>
      (item.roles.includes(resolvedRole) || (isInternalCommittee && item.roles.includes("internal committee"))) &&
      (!item.isDropdown || (item.children && item.children.length > 0)),
  );
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [expandedDropdown, setExpandedDropdown] = useState<string | null>(null);
  const [dynamicForms, setDynamicForms] = useState<DynamicFormItem[]>([]);
  const [isFormsLoading, setIsFormsLoading] = useState(false);
  useEffect(() => {
    const fetchForms = async () => {
      if (!user?.role) {
        setDynamicForms([]);
        setIsFormsLoading(false);
        return;
      }

      try {
        setIsFormsLoading(true);
        const response = await api.get("/api/auth/forms");
        setDynamicForms(
          Array.isArray(response.data?.data) ? response.data.data : [],
        );
      } catch (error) {
        setDynamicForms([]);
      } finally {
        setIsFormsLoading(false);
      }
    };

    fetchForms();
  }, [user?.role]);

  if (!user) return null;

  const navItems = getNavItems(user.role, dynamicForms, isFormsLoading, user.internalCommittee);
  const shouldShowFullScreenLoader =
    isFormsLoading &&
    (["faculty", "hod", "dean", "principle", "internal committee"].includes(
      normalizeRoleForAccess(user.role),
    ) || Boolean(user.internalCommittee));

  const toggleDropdown = (dropdownId: string) => {
    setExpandedDropdown((current) =>
      current === dropdownId ? null : dropdownId,
    );
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const displayName = user.name || user.email;
  const avatarInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {shouldShowFullScreenLoader && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">Loading form sections...</span>
          </div>
        </div>
      )}

      <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col overflow-y-auto">
          {" "}
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
              <img
                src={vishnuLogo}
                alt="Vishnu Logo"
                className="h-full w-full rounded-md object-contain"
              />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-sidebar-foreground">
                FPMS
              </h1>
              <p className="text-xs text-sidebar-foreground/60">
                Performance System
              </p>
            </div>
          </div>
          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto hide-scrollbar">
            {" "}
            {navItems.map((item) => {
              const dropdownId = item.dropdownId || item.label;

              if (item.isDropdown) {
                const isOpen = expandedDropdown === dropdownId;

                const isAnyChildActive =
                  item.children?.some((child) =>
                    location.pathname.startsWith(child.href),
                  ) ?? false;

                return (
                  <div key={dropdownId} className="space-y-1">
                    <button
                      onClick={() => toggleDropdown(dropdownId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isAnyChildActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {isOpen && item.children && (
                      <div className="ml-8 space-y-1">
                        {item.children.map((child) => {
                          const isActive = location.pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              to={child.href}
                              onClick={(event) => {
                                if (child.isLoading) {
                                  event.preventDefault();
                                  return;
                                }
                                setExpandedDropdown(null);
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                isActive
                                  ? "bg-sidebar-primary/50 text-sidebar-primary-foreground"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                                child.isLoading &&
                                  "opacity-70 cursor-default pointer-events-auto",
                              )}
                            >
                              {child.isLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              <span>{child.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {/* User Info & Logout */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-medium">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">
                  {formatRoleLabel(user.role)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
