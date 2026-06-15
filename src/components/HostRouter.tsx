import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ADMIN_HOSTS = [
  "admin.tpsssecurity.com",
  "portal.tpsssecurity.com",
  "tpsssecurity-df78797f.pages.dev",
  "tpss-security-sandbox.pages.dev",
];
const PUBLIC_HOSTS = ["www.tpsssecurity.com", "tpsssecurity.com"];

/**
 * Hostname-based routing.
 * - On admin/portal hosts: only /login and /app/* are valid; everything else → /login
 * - On www.tpsssecurity.com (or apex): show marketing site
 * - On preview/staging/localhost: no-op (so editor preview works normally)
 */
export default function HostRouter() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    const path = location.pathname;

    const isAdmin = ADMIN_HOSTS.includes(host);
    const isPublic = PUBLIC_HOSTS.includes(host);

    if (isAdmin) {
      const isInternal = path === "/login" || path === "/forgot-password" || path === "/reset-password" || path.startsWith("/app");
      if (!isInternal) {
        navigate("/login", { replace: true });
      }
      return;
    }

    if (isPublic) {
      // Marketing site — redirect app paths to portal subdomain
      if (path.startsWith("/app") || path === "/login") {
        window.location.href = "https://portal.tpsssecurity.com" + path;
      }
      return;
    }

    // Preview / localhost / other — no redirect
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}