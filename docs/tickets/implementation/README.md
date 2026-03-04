# Implementation – Controller → Service → Repo

Mock microservice reference. Basic names, lots of mock API calls.

## Files

| File | Purpose |
|------|---------|
| `controller.ts` | HTTP layer – validate request, call service, format response |
| `service.ts` | Business logic – orchestrate repo, enforce rules |
| `repo.ts` | Data access – DB + external API calls (all mocked) |
| `routes.ts` | Wire controller handlers to paths |
| `types.ts` | Shared interfaces |
| `errors.ts` | Custom errors |
| `index.ts` | Exports |

## Flow

```
Request → Controller (validate) → Service (business logic) → Repo (data)
                ↓                         ↓                        ↓
         parse body/query          throw ValidationError      mockApi.get/post
         require params            throw NotFoundError        mockCacheGet/Set
         call service              call repo.*                mockAiSummarize
         format response           return result              mockAuditLog
```

## Endpoints

| Method | Path | Handler |
|--------|------|---------|
| GET | /health | health |
| GET | /records | list |
| GET | /records/search | search |
| GET | /records/:id | getById |
| GET | /records/:id/audit | getAudit |
| POST | /records | create |
| POST | /records/:id/summarize | summarize |
| PATCH | /records/:id | update |
| DELETE | /records/:id | remove |

## Mock API Calls (in repo)

- `mockApi.get/post/patch/delete` – generic HTTP client
- `mockAuthValidate` – auth service
- `mockConfigGet` – config/feature flags
- `mockCacheGet/Set` – cache service
- `mockMetricsInc` – metrics
- `mockAiSummarize` – AI inference
- `mockAuditLog` – audit service

## Wiring (Express)

```typescript
import express from 'express';
import { routes, controller } from './implementation';

const app = express();
app.use(express.json());

for (const r of routes) {
  app[r.method.toLowerCase()](r.path, async (req, res, next) => {
    try {
      await r.handler(req, res);
    } catch (err) {
      controller.handleError(err, res);
    }
  });
}
```
