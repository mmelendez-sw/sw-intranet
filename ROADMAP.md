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
| Monthly Term Sheet Leaderboard | Live Salesforce counts via the Lambda (5-minute cache); last month's winner and a year-to-date top 5 underneath (`/api/salesforce/term-sheet-history`, 15-minute cache) |
| Deal-closed banner | Home page, everyone: Proprietary deals whose `Current_Investment_Date__c` is today, with a personal line for the closing AM (`/api/salesforce/closed-today`, 5-minute cache). Dismissing hides those deals for the day |
| Work anniversaries and new-hire welcomes | In Announcements, from Entra `employeeHireDate` (welcomes run 8 days from the start date). Only people with a hire date in Entra appear |
| Reports page | Power BI links, elite/include/exclude rules, **★ My Reports** favourites (synced through the user's OneDrive, `Apps/Symphony Intranet/report-favorites.json`) |
| IT ticket form | "Report IT Issue" opens a form (category, priority, attachments) sent via Graph to the support address in Site Settings |
| Employee Directory | `/directory`, live Graph users with photos |
| Lead Generation | Graph `sendMail` with photos |
| ICEMAN usage | Panel at the bottom of `/iceman` for `ICEMAN_ADMIN_ALLOWLIST`: runs, sites and people over 30 days, from the `[iceman]` CloudWatch lines via Logs Insights (`/api/iceman/usage`). Role policy `iceman-usage` (`scripts/iceman-usage-policy.json`) is attached |
| ICEMAN | Nearmap batch imagery → Excel (15 rows, 1.5× centred views at 320×240). Coordinates are typed or pasted into a table (Excel rows, Google Maps pairs, optional site name, map check per row); .csv/.xlsx upload is the second tab. Estimated progress bar while it runs. Open to the underwriting/origination group |
| Site usage (editor analytics) | `/usage` for `ANALYTICS_VIEWER_ALLOWLIST` (the editor allowlist): opens and distinct people per page, report, quick link, card link, sidebar link and search pick over 7/30/90 days, plus reports and quick links nobody opened. Each click POSTs `/api/analytics/event`, which logs an `[analytics]` line; `/api/analytics/summary` adds them up via Logs Insights (10-minute cache). Counts only on the page; emails stay in CloudWatch |
| Dark mode | Per-user toggle; `npm run check:dark` flags new colours with no dark override |
| Header search | Ctrl+K / ⌘K: pages, reports (same visibility rules), quick links, people (opens `/directory?q=`) |
| Salesforce integration password | Never expires: permission set `Intranet_Integration_Password_Never_Expires` (only `automationuser@symphonywireless.com`) and `SF_PASSWORD_EXPIRY_DAYS=0` on the Lambda, so the admin warning now shows only on a failed sign-in (2026-10-28) |
| Salesforce admin warning | Banner for mmelendez, htolani, vasmar when the integration sign-in fails or the password is within 14 days of `SF_PASSWORD_EXPIRY_DAYS` (`/api/salesforce/health`) |
| Unit tests and CI | Vitest (`npm test`, ~430 tests) and `.github/workflows/ci.yml` (typecheck, tests, `check:dark`, both builds) on every push and PR; checks only, never deploys |
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
| Org chart | Built from the directory (`/manager`, `/directReports`). On hold: reporting lines live in TriNet and may not be set in Entra; check how many users have a manager first | ~1 week |
| PWA ("Add to Home Screen") | Manifest exists; needs a service worker | 2–3 days |
| My Pipeline card | Mockup on `/dev`; needs `/api/salesforce/my-pipeline` | 2–3 days |
| Hire dates in Entra | Anniversaries cover only the ~26 of 82 people with `employeeHireDate` set; HR to backfill | — |

**Backlog:** push notifications, Spanish (i18n).

---

## Technical debt

| Item | Priority | Notes |
|---|---|---|
| `Calendars.Read` still on the app registration | Low | No longer requested at login; remove it from the app registration's API permissions in Entra to finish |
| `Sites.ReadWrite.All` for every user | Low | Delegated and admin-consented, so tokens carry it whether or not it's requested, and `Files.ReadWrite.All` already allows file writes. Users are still limited by their SharePoint site permissions. Narrowing it means app-registration changes in Entra, not code |
| `TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` not set on `sw-intranet-api` | Low | The Lambda's SharePoint image routes would fail; nothing visible uses them today |

---

## Definition of done

- [ ] Works on desktop Chrome, Edge, Firefox and Safari
- [ ] Works on iOS Safari and Android Chrome / Brave
- [ ] Editor-only controls are hidden from non-editors
- [ ] Falls back gracefully when SharePoint or the Lambda is unreachable
- [ ] Light and dark mode both checked; `npm run check:dark` passes
- [ ] `npm run typecheck` and `npm test` pass (CI runs both)
- [ ] This roadmap is updated
