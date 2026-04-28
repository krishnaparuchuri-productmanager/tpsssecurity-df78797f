# Separate Admin Subdomain from Marketing Site

## Problem
Both `www.tpsssecurity.com` and `admin.tpsssecurity.com` currently serve the same app. Visiting `admin.tpsssecurity.com` loads the marketing homepage instead of the login page, because Lovable serves the same project on every connected domain.

## Goal
Make each subdomain feel like its own dedicated site:
- **`admin.tpsssecurity.com`** → Internal portal only (login + `/app/*`). Root `/` redirects to login.
- **`www.tpsssecurity.com`** → Public marketing site only. Internal routes redirect to admin subdomain.

## How It Works (Technical)
Create a small `HostRouter` wrapper that runs once on app load and inspects `window.location.hostname`:

```text
                ┌─────────────────────────────┐
   Request ───▶ │  HostRouter (client-side)   │
                └─────────────────────────────┘
                  │                       │
       hostname = admin.*           hostname = www.* / apex
                  │                       │
   path = "/"  ──▶ redirect /login    path starts with /login
   path = "/app/*" ──▶ allow              or /app/* ──▶ redirect
   path = "/" or marketing ──▶              to admin.tpsssecurity.com
        redirect /login                 else ──▶ allow (marketing)
```

Preview/lovable.app domains: behave normally (no redirects) so testing in the editor still works.

## Changes

1. **Create `src/components/HostRouter.tsx`**
   - Reads `window.location.hostname` once on mount
   - Defines: `ADMIN_HOST = "admin.tpsssecurity.com"`, `PUBLIC_HOSTS = ["www.tpsssecurity.com", "tpsssecurity.com"]`
   - On admin host: if path is `/` or anything not under `/login` or `/app`, redirect to `/login`
   - On public host: if path starts with `/login` or `/app`, redirect (full page) to `https://admin.tpsssecurity.com{path}`
   - On preview/staging hosts (`*.lovable.app`, `localhost`): no-op
   - Returns `null` (just performs side effect)

2. **Wire into `src/App.tsx`**
   - Mount `<HostRouter />` inside `<BrowserRouter>` so it can read the current path via `useLocation`
   - Place it above `<Routes>` so it runs before route matching

3. **No changes** to existing routes, auth, or marketing components.

## After Deploy — User Experience
- Type `admin.tpsssecurity.com` → instantly lands on login page ✅
- Type `www.tpsssecurity.com` → marketing site (unchanged) ✅
- Type `www.tpsssecurity.com/login` → bounces to `admin.tpsssecurity.com/login` ✅
- Preview URL still works for development/testing ✅

## Important: Publish Required
After implementation, you must click **Publish → Update** for the changes to go live on both custom domains. The preview URL will reflect changes immediately.
