# ICEMAN Lambda setup checklist

Use this while creating the AWS Lambda that powers **ICEMAN** (`POST /api/iceman/generate`).

Frontend: authenticated users on the ICEMAN allowlist (`mmelendez@symphonyinfra.com`) upload CSV/XLSX → Lambda fetches two north-oblique Nearmap tiles (close + far ground coverage) → returns an `.xlsx` download.

---

## What this Lambda does

| Item | Value |
|------|--------|
| Route | `POST /api/iceman/generate?max_rows=500` |
| Body | `multipart/form-data` with field name **`file`** (`.csv` or `.xlsx`) |
| Response | `.xlsx` attachment (base64-encoded in Lambda) |
| Handler (AWS) | `handler.handler` |
| Code entry | `server/handler.ts` → `server/iceman.ts` |
| Secret | `NEARMAP_API_KEY` (Lambda env only — never Amplify frontend env) |

Repo deploy script: `npm run deploy:lambda -- -FunctionName YOUR_NAME -Region YOUR_REGION`

---

## Decision: one Lambda or a dedicated ICEMAN Lambda?

You already have (or will have) other `/api/*` backends. Amplify can only send each path to **one** target.

### Option A — Dedicated ICEMAN Lambda (recommended if another API already owns `/api/<*>`)

Create a **new** function just for ICEMAN. In Amplify, add a **specific** rewrite **above** any catch-all `/api/<*>`:

| Source | Target | Type |
|--------|--------|------|
| `/api/iceman/<*>` | `https://YOUR_ICEMAN_FUNCTION_URL/api/iceman/<*>` | **200** (rewrite) |
| `/api/<*>` | `https://YOUR_EXISTING_API_URL/api/<*>` | **200** (rewrite) |
| `/<*>` | `/index.html` | **200** |

Order matters: **ICEMAN rule first**, then general `/api`, then SPA.

### Option B — Same Lambda as TV / Power BI / Salesforce

Put ICEMAN on the existing intranet API function (this repo’s `handler.ts` already includes the route). Point Amplify’s `/api/<*>` at that Function URL. Redeploy that function whenever ICEMAN code changes.

---

## Step 1 — Create the function (console)

1. AWS Console → **Lambda** → **Create function**
2. **Author from scratch**
3. Name: e.g. `sw-intranet-iceman-api` (or reuse `sw-intranet-api` for Option B)
4. Runtime: **Node.js 22.x** (or latest LTS offered)
5. Architecture: **x86_64**
6. Create function (default hello-world code is fine for now)

### Runtime settings

- **Code** → **Runtime settings** → Edit  
- **Handler:** `handler.handler`

### General configuration (important for batch Nearmap)

| Setting | Suggested | Why |
|---------|-----------|-----|
| **Timeout** | **5–15 minutes** (max 15) | Each row = coverage + 3 tiles + 0.2s delays |
| **Memory** | **1024 MB** (512 minimum) | Image resize + Excel build |
| Ephemeral storage | 512 MB default is fine | No disk cache required |

Do **not** leave timeout at 3 seconds.

---

## Step 2 — Environment variables

**Configuration** → **Environment variables** → Edit → add:

| Name | Value |
|------|--------|
| `NEARMAP_API_KEY` | Your Nearmap API key |

Optional (only if this same function also serves other routes):

| Name | Purpose |
|------|---------|
| `TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` | SharePoint TV cards |
| `POWERBI_*` | Power BI embed token |
| `SF_*` | Salesforce |

ICEMAN alone only needs `NEARMAP_API_KEY`.

---

## Step 3 — Function URL

1. **Configuration** → **Function URL** → **Create**
2. **Auth type:** `NONE` for first internal tests (lock down later if needed)
3. **CORS:**
   - Allow origins: your Amplify origin(s), or `*` for a first test
   - Allow methods: include **POST**, **OPTIONS**, **GET**
   - Allow headers: `content-type` (and `*` if unsure)
4. Save and copy the URL origin, e.g.  
   `https://xxxxxxxx.lambda-url.us-east-2.on.aws`  
   (**no** trailing slash, **no** `/api/...` path)

### Binary / large responses

ICEMAN returns an Excel file as base64. On Function URL this is usually fine when the handler sets `isBase64Encoded: true`.

If uploads fail with payload errors:

- Check Function URL / API limits
- Cap rows with `?max_rows=` (max **500** in code)
- Prefer smaller CSVs for first tests

---

## Step 4 — Deploy code from this repo

Prerequisites on your PC:

- AWS CLI configured (`aws configure` or SSO)
- Same account/region as the function
- Repo dependencies installed (`npm ci`)

From repo root:

```powershell
npm run deploy:lambda -- -FunctionName sw-intranet-iceman-api -Region us-east-2
```

What the script does:

1. Compiles `server/*.ts` → `server/dist`
2. Stages `handler.js` + deps (`busboy`, `exceljs`, `jimp`, `xlsx`, …)
3. Zips and runs `aws lambda update-function-code`

Wait until **Last update status** = **Successful** before testing.

---

## Step 5 — Smoke test (before Amplify)

```powershell
# Expect 400/405 without a file — proves the route exists (not 404)
curl.exe -i -X POST "https://YOUR_FUNCTION_URL/api/iceman/generate"

# Real upload
curl.exe -L -o iceman-out.xlsx `
  -F "file=@C:\path\to\coords.csv" `
  "https://YOUR_FUNCTION_URL/api/iceman/generate?max_rows=5"
```

Healthy signs:

- Missing file → JSON `{ "error": "..." }` with **400**
- Valid CSV with `lat`/`lng` → downloads `.xlsx`
- Missing `NEARMAP_API_KEY` → **500** mentioning that env var

Sample CSV:

```csv
lat,lng,site
40.7128,-74.0060,Example NYC
```

---

## Step 6 — Wire Amplify

Your current `amplify.yml` only has the SPA catch-all. Add API rewrites **above** `/<*>`.

### Dedicated ICEMAN Lambda (Option A)

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - .npm/**/*
  customHeaders:
    - pattern: '**/*'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=0, must-revalidate'
  customRules:
    # ICEMAN — must be ABOVE the general /api catch-all
    - source: '/api/iceman/<*>'
      target: 'https://YOUR_ICEMAN_FUNCTION_URL/api/iceman/<*>'
      status: '200'
    # Existing intranet APIs (TV / Power BI / etc.)
    - source: '/api/<*>'
      target: 'https://YOUR_EXISTING_API_FUNCTION_URL/api/<*>'
      status: '200'
    - source: '/<*>'
      target: '/index.html'
      status: '200'
```

Replace both Function URL origins (no trailing slash in the host part; keep `/api/...` as shown).

### Single shared Lambda (Option B)

```yaml
  customRules:
    - source: '/api/<*>'
      target: 'https://YOUR_SHARED_FUNCTION_URL/api/<*>'
      status: '200'
    - source: '/<*>'
      target: '/index.html'
      status: '200'
```

Then:

1. Commit/push `amplify.yml` (or paste the same rules in Amplify Console → **Hosting** → **Rewrites and redirects**)
2. Redeploy the Amplify branch
3. Hard-refresh the site → open **ICEMAN** → upload a small file

Browser Network tab should show:

- Request URL: `https://your-amplify-domain/api/iceman/generate?...`
- Status **200**
- Response type: Excel / octet-stream (download starts)

---

## Local development (optional)

```powershell
# server/.env
NEARMAP_API_KEY=your-key
API_PORT=3001

npm run tv-api
# other terminal
npm start
```

Webpack proxies `/api/iceman` → `http://localhost:3001`.

---

## UI access control (already in code)

| Check | Behavior |
|-------|----------|
| Header tab | Only if `userInfo.email` is in `ICEMAN_ALLOWLIST` |
| Route `/iceman` | Others redirected to `/` |
| Allowlist | `src/authConfig.ts` → `ICEMAN_ALLOWLIST` (currently `mmelendez@symphonyinfra.com`) |

This is **UI-only**. The Function URL is still callable if someone knows the URL. For production lock-down, add auth on the Function URL or an API Gateway authorizer later.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Amplify `/api/iceman/...` → **404** | Catch-all `/api/<*>` points at a Lambda **without** ICEMAN | Use Option A specific rewrite, or deploy ICEMAN onto the catch-all Lambda |
| **404** on Function URL directly | Code not deployed / wrong handler | Redeploy; confirm handler `handler.handler` |
| **500** `Missing required env var: NEARMAP_API_KEY` | Env not set | Add Lambda env var and save |
| **Timeout** | Timeout still 3s / too many rows | Raise timeout; use `max_rows=5` first |
| CORS errors in browser | Function URL CORS missing POST/OPTIONS | Edit Function URL CORS; allow your Amplify origin |
| Blank images / Status notes | No Nearmap coverage / bad key | Check key; verify lat/lng in covered area |
| Tab not visible | Not signed in as allowlisted email | Sign in as `mmelendez@symphonyinfra.com` |

CloudWatch: **/aws/lambda/`FunctionName`**

---

## Quick checklist

- [ ] Lambda created (Node 22.x)
- [ ] Handler = `handler.handler`
- [ ] Timeout ≥ 5 min, memory ≥ 512–1024 MB
- [ ] Env `NEARMAP_API_KEY` set
- [ ] Function URL created (CORS allows POST)
- [ ] `npm run deploy:lambda -- -FunctionName … -Region …`
- [ ] `curl` smoke test with a small CSV
- [ ] Amplify rewrite for `/api/iceman/<*>` (or shared `/api/<*>`) **above** SPA rule
- [ ] Amplify redeploy + hard refresh
- [ ] ICEMAN tab visible only for allowlisted user

---

## Related code

| Path | Role |
|------|------|
| `server/iceman.ts` | Nearmap + XLSX generation |
| `server/multipart.ts` | Multipart upload parsing |
| `server/handler.ts` | Route wiring |
| `scripts/deploy-lambda.ps1` | Zip + update-function-code |
| `src/components/Iceman.tsx` | Upload UI |
| `src/authConfig.ts` | `ICEMAN_ALLOWLIST` |
