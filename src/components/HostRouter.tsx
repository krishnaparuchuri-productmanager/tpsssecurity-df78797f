import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ADMIN_HOST = "admin.tpsssecurity.com";
const PUBLIC_HOSTS = ["www.tpsssecurity.com", "tpsssecurity.com"];

/**
 * Hostname-based routing.
 * - On admin.tpsssecurity.com: only /login and /app/* are valid; everything else → /login
 * - On www.tpsssecurity.com (or apex): /login and /app/* bounce over to admin subdomain
 * - On preview/staging/localhost: no-op (so editor preview works normally)
 */
export default function HostRouter() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    const path = location.pathname;

    const isAdmin = host === ADMIN_HOST;
    const isPublic = PUBLIC_HOSTS.includes(host);

    if (isAdmin) {
      const isInternal = path === "/login" || path.startsWith("/app");
      if (!isInternal) {
        navigate("/login", { replace: true });
      }
      return;
    }

    if (isPublic) {
      const isInternal = path === "/login" || path.startsWith("/app");
      if (isInternal) {
        window.location.replace(
          `https://${ADMIN_HOST}${path}${location.search}${location.hash}`
        );
      }
      return;
    }

    // Preview / lovable.app / localhost / other — no redirect
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
