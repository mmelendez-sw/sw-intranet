# Symphony Towers Infrastructure — Intranet Roadmap

> **Branch:** `main` (Amplify production)
> **Last updated:** October 2026
> **Stack:** React 18 · TypeScript · MSAL (Azure AD) · Microsoft Graph · SharePoint · AWS Amplify · AWS Lambda (`sw-intranet-api`, us-east-2)

---

## Shipped

| Feature | Notes |
|---|---|
| Azure AD login (MSAL) | Popup with redirect fallback for iOS, Android and Brave; Log in button on the welcome page |
| Weekly re-login | Sessions older than 7 days are cleared at startup (`/tv` exempt) |
| New-version prompt | Gold bar under the header when a newer deploy is live; next navigation loads it |
| Elite and editor roles | `IntranetExecs` / `IntranetEditors` groups; editors edit content in place, saved to SharePoint |
| Homepage cards, hero, announcements | SharePoint-backed; editors use the rich text editor |
| Rich text editor | Tiptap toolbar (bold, italic, underline, lists, links) for cards, announcements and sidebar sections; output sanitised with DOMPurify; loads only when an edit modal opens |
| Sidebar sections, quick links, site settings | Shared `IntranetSidebar` on every page |
| Birthdays | `birthdays.json`, matched against the live directory; gap notice for editors |
| Monthly Term Sheet Leaderboard | Live Salesforce counts via the Lambda (5-minute cache) |
| Reports page | Power BI links, elite/include/exclude rules, **★ My Reports** favourites (synced through the user's OneDrive, `Apps/Symphony Intranet/report-favorites.json`) |
| IT ticket form | "Report IT Issue" opens a form (category, priority, attachments) sent via Graph to the support address in Site Settings |
| Employee Directory | `/directory`, live Graph users with photos |
| Lead Generation | Graph `sendMail` with photos |
| ICEMAN | Nearmap batch imagery → Excel (15 rows, 1.5× centred views at 320×240). Coordinates are typed or pasted into a table (Excel rows, Google Maps pairs, optional site name, map check per row); .csv/.xlsx upload is the second tab. Estimated progress bar while it runs. Open to the underwriting/origination group |
| Dark mode | Per-user toggle; `npm run check:dark` flags new colours with no dark override |
| Header search | Ctrl+K / ⌘K: pages, reports (same visibility rules), quick links, people (opens `/directory?q=`) |
| Salesforce admin warning | Banner for mmelendez, htolani, vasmar when the integration sign-in fails or the password is within 14 days of `SF_PASSWORD_EXPIRY_DAYS` (`/api/salesforce/health`) |
| Icons | Font Awesome Free (solid) bundled from npm; the old kit script is gone |

**Separate branch:** the office TV display runs from `serena-tv-dev` — don't touch it without asking.

---

## In progress

### ICEMAN rollout
- Full 15-row test run (time, workbook size, image quality).
- The underwriting and origination group is in `ICEMAN_ALLOWLIST` (`src/authConfig.ts`) and the Lambda's default list (`server/handler.ts`). Keep both in step; setting `ICEMAN_ALLOWED_EMAILS` on the Lambda overrides the default.

---

## Next up

| Feature | Value | Effort |
|---|---|---|
| Shared company calendar | Company-wide events from a SharePoint list | 3–4 days |
| Document library browser | Browse SharePoint files in the intranet | 3–5 days |
| Org chart | Built from the directory (`/manager`, `/directReports`) | ~1 week |
| PWA ("Add to Home Screen") | Manifest exists; needs a service worker | 2–3 days |
| Editor analytics | Which reports and cards get used | ~1 week |
| Work anniversaries | Same pattern as birthdays | 1–2 days |
| Leaderboard history | Last month's winners / year to date | 1–2 days |
| New-hire welcome card | Replaces manual hide/show edits for onboarding | 1–2 days |
| ICEMAN usage view | Who ran it and how many sites (from the `[iceman]` logs) | 1–2 days |
| My Pipeline card + deal-closed banner | Mockup on `mockup/ethan-pipeline` (local only); needs `/api/salesforce/my-pipeline` and a closed-today route | 2–3 days |

**Backlog:** push notifications, Spanish (i18n).

---

## Technical debt

| Item | Priority | Notes |
|---|---|---|
| `Calendars.Read` still requested at login | Medium | The calendar was removed; drop the scope |
| `Sites.ReadWrite.All` for every user | Medium | Only editors write; request write access on demand |
| Lead Generation token refresh uses a popup | Medium | Can fail silently on Android; the header login already handles this |
| `TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` not set on `sw-intranet-api` | Low | The Lambda's SharePoint image routes would fail; nothing visible uses them today |
| Unit tests and CI | Medium | `intranet-tests-refactor` has vitest tests and PR checks that never reached `main` |
| Salesforce integration password expiry | High | Set "Password Never Expires" on that user's profile (it broke the leaderboard on 2026-10-19), then set `SF_PASSWORD_EXPIRY_DAYS=0` on the Lambda. The admin banner warns until then |

---

## Definition of done

- [ ] Works on desktop Chrome, Edge, Firefox and Safari
- [ ] Works on iOS Safari and Android Chrome / Brave
- [ ] Editor-only controls are hidden from non-editors
- [ ] Falls back gracefully when SharePoint or the Lambda is unreachable
- [ ] Light and dark mode both checked; `npm run check:dark` passes
- [ ] `npx tsc --noEmit -p .` (and `-p server` for Lambda changes) passes
- [ ] This roadmap is updated
