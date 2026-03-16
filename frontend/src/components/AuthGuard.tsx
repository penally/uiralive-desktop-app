import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Film, LogOut } from "lucide-react";

/** Routes that don't require auth */
const PUBLIC_PATHS = ["/login", "/error"];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, canAccessContent, logout } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isPublic) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessContent) {
    return (
      <div className="min-h-screen bg-[var(--theme-content)] text-[var(--theme-foreground)] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto">
            <Film className="w-10 h-10 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Account Pending Approval</h1>
            <p className="text-white/60">
              Your account has been created successfully. A staff member needs to approve your account before you can watch content.
            </p>
          </div>
          <p className="text-white/40 text-sm">
            You will be able to browse and watch once your account is approved. Please check back later.
          </p>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
