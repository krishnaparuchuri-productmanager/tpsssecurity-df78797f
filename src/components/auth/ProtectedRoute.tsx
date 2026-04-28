import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface Props {
  requireRoles?: AppRole[];
  requireScreen?: string;
}

export default function ProtectedRoute({ requireRoles, requireScreen }: Props) {
  const { user, role, profile, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (profile && profile.is_active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold">Account deactivated</h2>
          <p className="text-muted-foreground text-sm">
            Your account has been deactivated. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-xl font-semibold">No role assigned</h2>
          <p className="text-muted-foreground text-sm">
            Your account exists but no role has been assigned yet. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (requireRoles && !requireRoles.includes(role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (requireScreen && !can(requireScreen, "can_view")) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
