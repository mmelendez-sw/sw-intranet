# Company Progress + Lambda API (serena-tv-dev)

How this branch is wired after Lambda creation, and what to do next.

## What's already done

| Piece | Status |
|--------|--------|
| Lambda `sw-intranet-api` (us-east-2) | Created |
| Handler | `handler.handler` |
| Timeout | 15s |
| Function URL | `https://coc6leb5vo5ljujvoqcjozkocy0ihyan.lambda-url.us-east-2.on.aws/` |
| Code upload | `npm run deploy:lambda` |
| Amplify `/api/*` rewrite | In `amplify.yml` → Function URL |
| Frontend Power BI URL | Relative `/api/powerbi/embed-token` in prod (not localhost) |
| Office TV `/` | **Static** company progress image (unchanged) |
| Live Power BI + Salesforce gauges | **`/tv`** route (`TvCompanyProgress.tsx`) |
| Azure ROPC | Same app + automation account; runs in Lambda |

## Route map (do not break the lobby TV)

| URL | What it shows |
|-----|----------------|
| `/` | Hardcoded report imagery — keep this for the office TV |
| `/tv` | Live Power BI embed + Salesforce gauges via Lambda |

## Frontend pointing at the API (step 3 — done)

`src/services/powerbiService.ts` resolves the embed-token URL as:

1. `window.INTRANET_API_BASE_URL` if set
2. Else `http://localhost:3001/...` on localhost
3. Else `/api/powerbi/embed-token` (Amplify proxies to Lambda)

Salesforce on `/tv` uses the same pattern for `/api/salesforce/current-investments`.

You do **not** need to hardcode the Function URL in the frontend when the Amplify rewrite is present.

## Homepage embed (step 4 — adjusted)

Live Power BI is **not** re-enabled on `/` (so the lobby TV stays stable).
Use **`/tv`** for the live embed instead.

## Azure (step 5 — unchanged)

Same ROPC / Salesforceautomation setup as local. Credentials live on the **Lambda** environment variables, not in Amplify build env.

## Lambda env vars (confirm in Console)

**Configuration → Environment variables** on `sw-intranet-api`:

```
POWERBI_TENANT_ID
POWERBI_CLIENT_ID
POWERBI_USERNAME
POWERBI_PASSWORD
POWERBI_REPORT_ID
POWERBI_WORKSPACE_ID

SF_USERNAME
SF_PASSWORD
SF_SECURITY_TOKEN   # optional
SF_DOMAIN           # optional
```

## Commands you'll reuse

```powershell
# From repo root (serena-tv-dev)
$env:AWS_PAGER = ''   # avoid -- More -- pager
aws sts get-caller-identity --region us-east-2
npm run deploy:lambda

# Local API
npm run api

# Smoke-test Lambda directly
curl https://coc6leb5vo5ljujvoqcjozkocy0ihyan.lambda-url.us-east-2.on.aws/api/salesforce/current-investments
curl "https://coc6leb5vo5ljujvoqcjozkocy0ihyan.lambda-url.us-east-2.on.aws/api/powerbi/embed-token"
```

## After this push

1. Wait for Amplify build on `serena-tv-dev` to succeed.
2. Confirm office TV still loads **`/`** with the static image.
3. Open **`https://<your-amplify-host>/tv`** and verify live Power BI + gauges.
4. If `/tv` errors, check Lambda logs (Monitor → Logs) and env vars.

## Security note

Do not commit `server/.env` or paste access keys / passwords into chat or tickets. Rotate any credentials that were exposed in terminal output.