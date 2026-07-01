# Symphony Towers Infrastructure — Intranet Roadmap

> **Branch:** `main-edit`  
> **Last updated:** March 2026  
> **Stack:** React 18 · TypeScript · MSAL (Azure AD) · Microsoft Graph API · AWS Amplify · SharePoint

---

## Current State (v1.0 — Shipped)

| Feature | Status | Notes |
|---|---|---|
| Azure AD login (MSAL) | ✅ | Popup with redirect fallback; Android/Brave fixed |
| Elite group gate (`IntranetExecs`) | ✅ | 24-hr localStorage cache, retry logic |
| Homepage — 6 content cards | ✅ | Hardcoded defaults, SharePoint-backed when edited |
| Homepage — sidebar sections | ✅ | HR Updates, IT Updates, Exciting News, Holiday Photos |
| Reports page — Power BI link table | ✅ | Elite vs. standard split; per-user email exclusions |
| Lead Generation page | ✅ | Graph `sendMail` integration |
| Editor role (`IntranetEditors` group) | ✅ | Pencil-icon inline editing, SharePoint persistence |
| Image upload in card editor | ✅ | Drag-and-drop to SharePoint `IntranetImages/` folder |
| Mobile auth — iOS Safari | ✅ | Redirect fallback on popup failure |
| Mobile auth — Android / Brave | ✅ | Always-redirect flow, navigator.brave detection |
| AWS Amplify deployment | ✅ | SPA rewrite rule, `npm run build` → `dist/` |

---

## Phase 1 — Intranet Essentials (v1.1) — *This sprint*

> **Goal:** Turn the app from a styled landing page into a working intranet hub.

### 1.1 · Site-wide Alert Banner ✅ Implemented
- Editors push a dismissible org-wide alert from the header
- Types: `info`, `warning`, `success`, `error`
- Optional CTA link
- Dismissed per-session in `sessionStorage`
- Stored in `contentService` key `"site-alert"`

### 1.2 · Employee Directory ✅ Implemented
- `/directory` route, accessible to all authenticated users
- Pulls `displayName`, `jobTitle`, `department`, `mail` from Graph `/users`
- Per-card avatar photo from Graph `/users/{id}/photo/$value`
- Live search/filter by name or department
- Requires `User.ReadBasic.All` scope (admin consent)

### 1.3 · Announcements Feed ✅ Implemented
- Collapsible announcements strip at the top of the homepage
- Each announcement: title, body, date, active toggle
- Editors add/edit/remove via existing pencil-icon modal pattern
- Stored in `contentService` key `"announcements"`

### 1.4 · Microsoft Calendar Integration ✅ Implemented
- `Calendar.tsx` rewritten to show user's upcoming Outlook events via Graph
- Sidebar date-picker highlights days with events
- Requires `Calendars.Read` scope (user consent only, no admin needed)

---

## Phase 2 — Productivity Layer (v1.2) — *Next sprint*

> **Goal:** Replace manual workarounds with proper intranet tooling.

### 2.1 · WYSIWYG Rich Text Editor
- Replace raw `<textarea>` in card/sidebar edit modals with a proper rich text editor
- **Recommended library:** [Tiptap](https://tiptap.dev/) (MIT, no server required)
- Outputs clean HTML stored in SharePoint as today; zero data model change
- Unblocks non-technical editors who can't write `<a href>` by hand
- **Effort:** 2–3 days

### 2.2 · IT Ticket Submission
- Replace `mailto:Symphony_Tech@symphonywireless.com` button with an inline form
- Fields: Category, Subject, Description, Priority, Attachment
- Submits via Graph `sendMail` (same pattern as Lead Generation)
- Optional: auto-CC the submitting user
- **Effort:** 1–2 days

### 2.3 · Document Library Browser
- Browse SharePoint document libraries directly in the intranet
- Replaces scattered SharePoint deep-links in sidebar
- Graph `/drives/{id}/root/children` with breadcrumb navigation
- Download / preview PDFs and images inline
- **Effort:** 3–5 days

### 2.4 · Report Favoriting
- Users can star reports they use frequently
- Stars stored in `localStorage` per user (no backend needed)
- "My Reports" section pinned to top of the reports table
- **Effort:** 1 day

### 2.5 · Mobile PWA Improvements
- Add `manifest.json` and service worker for "Add to Home Screen"
- Offline fallback page (cached shell)
- Push notification permission prompt (for alert banner delivery)
- **Effort:** 2–3 days

---

## Phase 3 — Advanced Features (v2.0) — *Backlog*

> **Goal:** Make the intranet a strategic communications and operations platform.

### 3.1 · Org Chart Visualization
- Interactive org chart built from Graph `/users/{id}/directReports` and `/users/{id}/manager`
- Click a node to see profile card
- Export to PNG
- **Effort:** 1 week
- **Dependency:** `User.Read.All` scope (admin consent)

### 3.2 · Push Notifications
- When editors publish a new alert or announcement, subscribed users receive a browser push notification
- Requires a backend to store Web Push subscriptions (serverless Lambda on Amplify)
- **Effort:** 1–2 weeks
- **Dependency:** Amplify Functions setup

### 3.3 · Analytics Dashboard (Editors Only)
- Track which reports are clicked, which cards are viewed longest
- Lightweight event logging to SharePoint list via Graph
- Dashboard page at `/analytics` gated to editors
- **Effort:** 1 week

### 3.4 · SharePoint Shared Company Calendar
- Replace personal Outlook calendar with a shared org-wide event calendar
- Events managed by HR/admins in SharePoint; displayed on the intranet
- Graph `/sites/{id}/lists/{calendarListId}/items`
- **Effort:** 3–4 days

### 3.5 · Dark Mode
- CSS custom properties already in `global.css` ready for theme switching
- Toggle stored in `localStorage`
- Respects `prefers-color-scheme` media query by default
- **Effort:** 2 days

### 3.6 · Multi-language Support (i18n)
- English baseline with Spanish secondary (common in telecom infrastructure)
- `react-i18next` library
- Language preference stored per user in SharePoint user profile
- **Effort:** 1–2 weeks (translation time dominates)

---

## Technical Debt

| Item | Priority | Notes |
|---|---|---|
| Remove all `console.log` debug statements from `App.tsx` | High | Left from group-check debugging |
| Replace `window.*` debug helpers in `App.tsx` | High | `debugGroups`, `forceEliteCheck`, etc. — production risk |
| Deduplicate `EditModal` component | Medium | Defined separately in `HomePage.tsx` and `Reports.tsx` — extract to `src/components/EditModal.tsx` |
| `ReportSection.tsx` is unused | Low | Delete or wire to a route |
| `HRPage.tsx` imported but route shows placeholder | Low | Implement or remove import |
| `Sites.ReadWrite.All` for all users | Medium | Scope down to `Sites.Read.All` for non-editors; acquire write scope on demand |
| Token retry uses `acquireTokenPopup` in `authConfig.ts` | Medium | Fails silently on Android; replace with redirect fallback |

---

## Scope & Permission Reference

| Scope | Who needs it | Admin consent? | Used for |
|---|---|---|---|
| `User.Read` | All | No | Login, user profile |
| `GroupMember.Read.All` | All | Yes | Elite + editor group checks |
| `Mail.Send` | All | No | Lead gen emails, IT tickets |
| `Sites.ReadWrite.All` | All | Yes | Read/write SharePoint content |
| `User.ReadBasic.All` | All | Yes | Employee Directory |
| `Calendars.Read` | All | No | Personal Outlook calendar events |

---

## Definition of Done

- [ ] Feature works on desktop Chrome, Edge, Firefox, Safari
- [ ] Feature works on iOS Safari and Android Chrome / Brave
- [ ] Editor-only controls are invisible to non-editor authenticated users
- [ ] Content falls back gracefully if SharePoint is unreachable
- [ ] No new TypeScript linter errors introduced
- [ ] Feature is documented in this roadmap with status updated to ✅
