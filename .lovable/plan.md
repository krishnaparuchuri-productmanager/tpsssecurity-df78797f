## Problem
On mobile, the admin sidebar opens in a Radix `Sheet` rendered through a portal at `document.body`. The portal escapes the `.app-shell` wrapper, so the scoped utilities (`.app-shell .bg-app-navy`, `.bg-app-saffron`, etc.) defined in `src/index.css` never apply. The sheet background defaults to near-white while `text-white` still applies, making every menu label invisible.

## Fix (single small CSS change, no component edits)

Edit `src/index.css` only — promote the app-shell color tokens and utilities so they work in portaled DOM as well:

1. Move the `--app-navy`, `--app-saffron`, `--app-bg`, `--app-surface`, `--app-border`, `--app-text`, `--app-text-muted` CSS variable definitions from `.app-shell { … }` to `:root { … }` (keep them additive — do not touch the existing public-site tokens).
2. Drop the `.app-shell` prefix from the utility class declarations so `.bg-app-navy`, `.text-app-navy`, `.bg-app-saffron`, `.bg-app-bg`, `.bg-app-surface`, `.border-app-border`, `.text-app-muted`, etc. become global utilities (still namespaced by the `app-` prefix, so no collision risk with the marketing site).
3. Additionally, on the mobile sheet variant of the sidebar specifically (`[data-mobile="true"]`), ensure the navy background is enforced even if a future class fights it — add a one-line rule:
   ```css
   [data-sidebar="sidebar"][data-mobile="true"] { background-color: hsl(var(--app-navy)); color: #fff; }
   ```
   This guarantees the mobile drawer always reads navy/white regardless of where it is portaled.

## Verification
- Open `/app/dashboard` on a mobile viewport (390px), tap the sidebar trigger → drawer opens with navy background and white menu items, matching the desktop sidebar.
- Confirm the public marketing site (`/`) is unchanged (it uses `text-navy`, `bg-navy`, `text-gold`, `bg-gold` — different utility names, untouched).
- Confirm desktop admin sidebar still renders correctly (rules become more permissive, never more restrictive).

## Files touched
- `src/index.css` — only file modified.
