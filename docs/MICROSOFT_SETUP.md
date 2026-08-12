# Microsoft / SharePoint homepage cards API (Amplify + Lambda)

Amplify only hosts the static React app. `npm run api` stays on your PC.
For the live site, deploy the SharePoint cards API to AWS Lambda and point the
frontend at it with **environment values** — never commit secrets or a hard-coded
Function URL into source.

The homepage (`HomePage`) loads `{ cards: [...] }` from `/api/tv-cards` the same
way main does for TV display: SharePoint JSON → Lambda → browser, with a bundled
seed fallback and a light `/meta` poll so lobby screens pick up edits.

## What this branch ships

| Piece | Role |
|-------|------|
| `server/sharepoint.js` | Graph ROPC → homepage cards + image proxy |
| `server/handler.js` | Lambda Function URL entry (`handler.handler`) |
| `server/localDev.js` | Same routes locally via `npm run api` |
| `scripts/deploy-lambda.ps1` | Zip + `update-function-code` |
| `src/services/tvCardsService.ts` | Client fetch / parse / media URL helpers |
| `src/data/homepage-cards.seed.json` | Offline first paint if API is down |
| `window.INTRANET_API_BASE_URL` | Runtime API origin (injected at Amplify build) |

Routes:

- `GET /api/tv-cards` → `{ "cards": [ ... ] }`
- `GET /api/tv-cards/meta`
- `GET /api/images/:driveItemId`
- `GET /api/images/by-url?url=`

## 1. Entra ID app (once)

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → app used for automation (or create one).
2. **Authentication** → enable **Allow public client flows** (required for ROPC).
3. **API permissions** → Microsoft Graph **delegated**:
   - `Files.Read.All`
   - `Sites.Read.All`
   - Grant **admin consent**.
4. Note **Directory (tenant) ID** and **Application (client) ID**.
5. Use a dedicated automation user that can read the SharePoint library (not end-user passwords in git).

ROPC can be blocked by Conditional Access (`AADSTS530031`). If token calls fail from Lambda, fix CA / use an allowed path with IT — that is not an Amplify frontend issue.

## 2. Local API (optional)

```powershell
copy server\.env.example server\.env
# fill MICROSOFT_* and TV_API_PUBLIC_BASE=http://localhost:3001
npm run api
curl http://localhost:3001/api/tv-cards
```

Do **not** put `MICROSOFT_PASSWORD` in Amplify env or the frontend.

## 3. Create the Lambda

1. AWS → **Lambda** → **Create function** → **Node.js 20.x**.
2. Handler: `handler.handler`.
3. Package from repo root (or use the script after the function exists):

```powershell
Compress-Archive -Path server\handler.js,server\sharepoint.js `
  -DestinationPath $env:TEMP\sw-intranet-api.zip -Force
```

Upload the zip (or run `npm run deploy:lambda -- -FunctionName YOUR_FUNCTION -Region YOUR_REGION`).

Node 18+ has global `fetch` — no npm deps required for the SharePoint path.

### Environment variables (Lambda only)

| Name | Value |
|------|--------|
| `MICROSOFT_TENANT_ID` | Your Entra tenant ID |
| `MICROSOFT_CLIENT_ID` | Public client app ID |
| `MICROSOFT_USERNAME` | Automation user UPN |
| `MICROSOFT_PASSWORD` | Automation password (Secrets Manager preferred) |
| `TV_API_PUBLIC_BASE` | Set **after** Function URL (origin only, no trailing slash) |

Optional overrides:

| Name | Purpose |
|------|---------|
| `TV_SHAREPOINT_DRIVE_ID` | Drive id for cards / Default Images |
| `TV_HOMEPAGE_CARDS_ITEM_ID` | Drive item id of homepage cards JSON |
| `DEFAULT_IMAGES_FOLDER_PATH` | e.g. `General/intranet/Default Images` |

Aliases accepted by `sharepoint.js`: `POWERBI_TENANT_ID` / `TENANT_ID`, `POWERBI_CLIENT_ID` / `CLIENT_ID`, `POWERBI_USERNAME` / `POWERBI_PASSWORD`.

## 4. Function URL

1. Lambda → **Configuration** → **Function URL** → Create.
2. Auth: `NONE` for a first internal test (lock down later).
3. CORS: allow your Amplify origin, or `*` temporarily.
4. Copy the URL, e.g. `https://xxxx.lambda-url.us-east-2.on.aws`.
5. Set Lambda env `TV_API_PUBLIC_BASE` to that **origin** (no trailing slash) and save.
   Image URLs inside `/api/tv-cards` are built from this value.

## 5. Smoke test

```powershell
curl "https://YOUR_FUNCTION_URL/api/tv-cards"
curl "https://YOUR_FUNCTION_URL/api/tv-cards/meta"
```

Expect `{ "cards": [ ... ] }` with `title`, `bullets`, `imageUrl`, `order`. Open an `imageUrl` (should be under `/api/images/...`).

## 6. Point Amplify at the API (dynamic — no hard-coded URL in git)

### Option A — Amplify environment variable (recommended)

1. Amplify Console → your app/branch → **Environment variables**:
   - `INTRANET_API_BASE_URL` = `https://xxxx.lambda-url.us-east-2.on.aws` (no trailing slash)
2. `amplify.yml` writes `public/api-config.js` at build time from that value.
3. Redeploy the branch. `HomePage` reads `TV_CARDS_API_URL` derived from that.

### Option B — Amplify rewrite (relative `/api/*`)

Hosting → **Rewrites and redirects**:

| Source | Target | Type |
|--------|--------|------|
| `/api/<*>` | `https://YOUR_FUNCTION_URL/api/<*>` | **200** (rewrite) |

Place this **above** the SPA rule `/<*>` → `/index.html`.

Leave `INTRANET_API_BASE_URL` empty so the browser calls same-origin `/api/...`.

Still set Lambda `TV_API_PUBLIC_BASE` to the Function URL origin so **image** links in the JSON resolve correctly (or to your Amplify origin if images are also rewritten).

## 7. Frontend helpers

`src/authConfig.ts`:

- `INTRANET_API_BASE_URL` — from `window.INTRANET_API_BASE_URL` / `api-config.js`
- `TV_CARDS_API_URL` — `${base}/api/tv-cards` (localhost → `:3001` when developing)

`src/services/tvCardsService.ts` + `HomePage` load cards, normalize media URLs, and poll `/meta` every 20s.

## Security checklist

- Never put `MICROSOFT_PASSWORD` in Amplify frontend env or git.
- Rotate any password that was pasted into chat, tickets, or docs.
- Prefer AWS Secrets Manager + Lambda env from secrets over plain env long-term.
- Tighten Function URL auth after the smoke test.

## Related

- Power BI service principal / embed: `POWERBI_SETUP.md` (separate; not used for cards on this branch).
