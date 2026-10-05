# ICEMAN Lambda setup (manual, AWS console)

ICEMAN: an allowlisted user uploads a CSV/XLSX of coordinates → a Lambda fetches two
north-oblique Nearmap tiles per row (close + far) → returns an `.xlsx` with the
thumbnails embedded.

| Item | Value |
|------|-------|
| Route | `POST /api/iceman/generate?max_rows=500&close_m=35&far_m=300` |
| Body | `multipart/form-data`, file field **`file`** (`.csv` / `.xlsx`) |
| Response | `.xlsx` attachment (base64 body, `isBase64Encoded: true`) |
| Handler | `handler.handler` (`server/handler.ts` → `server/iceman.ts`) |
| Secret | `NEARMAP_API_KEY` — Lambda env only, never Amplify frontend env |

---

## Current production layout (as of Oct 2026) — do not disturb

Amplify rewrites are **app-wide** (every branch shares them) and live in the
**Amplify console** (Hosting → Rewrites and redirects). The `customRules` block in
`amplify.yml` is not what production uses.

| Path | Goes to | Used by |
|------|---------|---------|
| `/api/<*>` (catch-all) | `sw-intranet-api` Function URL | `serena-tv-dev` Power BI embed (no auth), Salesforce current-investments |
| (direct, hardcoded URL) | `sw-intranet-screen-api` Function URL | TV cards / images |
| `/*` | `/index.html` | SPA |

`sw-intranet-api` is a small hand-deployed handler (Power BI + current-investments
only) — **not** this repo's `server/handler.ts`. Deploying this repo to it would
replace live code, so `deploy-lambda.ps1` refuses that function name unless
`-ConfirmProduction` is passed.

ICEMAN therefore gets its **own** Lambda and, when ready, **one** extra rewrite
inserted above the catch-all. `/api/iceman/*` returns 404 today, so adding that rule
changes nothing that currently works.

---

## Step 1 — Create the function

Lambda console (region **us-east-2**) → **Create function** → Author from scratch:

| Setting | Value |
|---------|-------|
| Name | `sw-intranet-iceman` |
| Runtime | Node.js 22.x |
| Architecture | x86_64 |
| Execution role | Create a new role with basic Lambda permissions (CloudWatch Logs only) |

Then:

1. **Code → Runtime settings → Edit** → Handler: `handler.handler`
2. **Configuration → General configuration → Edit**
   - Memory: **1024 MB**
   - Timeout: **5 min** to start (max 15 min)
3. **Configuration → Concurrency → Edit** → Reserved concurrency: **2**
   (caps runaway Nearmap spend and keeps ICEMAN from starving other functions)
4. **Configuration → Environment variables → Edit** → `NEARMAP_API_KEY` = your key

ICEMAN needs no other env vars.

## Step 2 — Function URL

**Configuration → Function URL → Create function URL**

| Setting | Value |
|---------|-------|
| Auth type | **AWS_IAM** while testing (only signed requests from your AWS user work) |
| Invoke mode | BUFFERED |
| CORS | leave off — the browser will reach it through Amplify (same origin) |

Copy the origin, e.g. `https://xxxx.lambda-url.us-east-2.on.aws` (no trailing slash).

> Why AWS_IAM first: with `NONE`, anyone who finds the URL can spend Nearmap credits.
> The UI allowlist (`ICEMAN_ALLOWLIST` in `src/authConfig.ts`) does not protect the
> Lambda. Switch to `NONE` only when server-side token checks land and you add the
> Amplify rewrite (Step 5).

## Step 3 — Deploy code from this repo

Prereqs: AWS CLI configured for account `332441963654`, `npm ci` done.

```powershell
npm run deploy:lambda -- -FunctionName sw-intranet-iceman -Region us-east-2
```

The script compiles `server/*.ts`, stages `server/dist` + runtime deps, uploads the
zip, and waits until the update reports **Successful**. (The bundle currently also
contains the other routes; they stay inert without their env vars.)

## Step 4 — Smoke test the Function URL directly

With `AWS_IAM` auth, sign the request with your AWS keys (curl ≥ 7.75):

```powershell
$k = aws configure get aws_access_key_id; $s = aws configure get aws_secret_access_key
$u = "https://YOUR_FUNCTION_URL"

# Expect 405 (route exists, wrong method)
curl.exe -i --aws-sigv4 "aws:amz:us-east-2:lambda" --user "${k}:${s}" "$u/api/iceman/generate"

# Real upload, 5 rows
curl.exe -o iceman-out.xlsx --aws-sigv4 "aws:amz:us-east-2:lambda" --user "${k}:${s}" `
  -F "file=@C:\path\to\coords.csv" "$u/api/iceman/generate?max_rows=5"
```

| Result | Meaning |
|--------|---------|
| 405 / 400 JSON `{ "error": ... }` | Route deployed |
| `.xlsx` downloads | Working end to end |
| 500 `Missing required env var: NEARMAP_API_KEY` | Step 1.4 not saved |
| 403 | Request not signed / wrong keys |
| Status column notes, blank images | No Nearmap coverage or bad key |

Sample CSV:

```csv
lat,lng,site
40.7128,-74.0060,Example NYC
```

Local alternative (no AWS): put `NEARMAP_API_KEY=...` in `server/.env`, run
`npm run tv-api` and `npm start`; webpack proxies `/api/iceman` to `localhost:3001`.

## Step 5 — Wire Amplify (separate go-ahead; app-wide change)

Only after Steps 1–4 pass. In Amplify console → **Hosting → Rewrites and redirects
→ Manage**:

1. Save a copy of the current rules first (or `aws amplify get-app --app-id
   d2ryoyr4gox6p1 --query app.customRules > amplify-rules-backup.json`).
2. Add **one** rule at the **very top**, above `/api/<*>`:

   | Source | Target | Type |
   |--------|--------|------|
   | `/api/iceman/<*>` | `https://YOUR_ICEMAN_FUNCTION_URL/api/iceman/<*>` | 200 (Rewrite) |

3. Leave every other rule untouched and in order.
4. Switch the ICEMAN Function URL auth type to `NONE` (Amplify can't sign requests).

Rollback: delete that one rule (or re-apply the backup).

---

## Known limits of the current synchronous design

| Limit | Effect |
|-------|--------|
| Amplify proxy timeout ≈ 30 s | Through Amplify, roughly 50–100 rows max (rows are fetched 4 at a time) |
| Function URL buffered payload 6 MB | Responses over ~6 MB fail (~300 rows of thumbnails); uploads over 6 MB fail |
| Lambda max 15 min | Hard ceiling when calling the Function URL directly |

Planned fix (not built yet): async jobs — upload → `jobId` → the Lambda processes in
the background → poll for progress → download from a pre-signed S3 link. Extra
console steps for that phase: an S3 bucket (block public access, 7-day expiry
lifecycle rule), and adding `s3:GetObject`/`s3:PutObject` on that bucket plus
`lambda:InvokeFunction` on itself to the function's role.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/api/iceman/...` → 404 on the site | No ICEMAN rewrite yet, so the catch-all sends it to `sw-intranet-api` | Step 5 |
| 504 through Amplify | File too large for the ~30 s proxy timeout | Fewer rows, or call the Function URL directly |
| Timeout in CloudWatch | Function timeout too low | Raise timeout (Step 1.2) |
| 429 / throttled | Reserved concurrency 2 already in use | Wait, or raise it |
| Tab not visible | Not signed in as an allowlisted email | `ICEMAN_ALLOWLIST` in `src/authConfig.ts` |

Logs: CloudWatch → `/aws/lambda/sw-intranet-iceman`.

## Related code

| Path | Role |
|------|------|
| `server/iceman.ts` | Nearmap fetch (4 rows in flight, retry on 429/5xx) + XLSX build |
| `server/multipart.ts` | Multipart upload parsing |
| `server/handler.ts` | Route wiring |
| `scripts/deploy-lambda.ps1` | Build, zip, update-function-code, wait |
| `src/components/Iceman.tsx` | Upload UI |
| `src/config/icemanLimits.ts` | Distance/row limits shared with the UI (a test checks they match the server) |
