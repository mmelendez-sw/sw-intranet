# Ticket 1: Clinical Summary API

**Ticket:** Add POST /api/clinical-summaries to generate an AI summary from a clinical note. Accept note text, return structured summary with chief complaint, assessment, and plan.

**Priority:** High | **Estimate:** 3–5 hours

---

## Acceptance Criteria

- [ ] POST accepts `{ noteText: string }` (max 10,000 chars)
- [ ] Returns `{ summary: { chiefComplaint, assessment, plan }, modelVersion: string }`
- [ ] Invalid/missing input returns 400 with validation errors
- [ ] Rate limit: 10 requests/minute per user (mention in discussion)

---

## Step-by-Step Walkthrough

### 1. Find Existing Patterns

- Look for `routes/` or `api/` – how are routes structured?
- Find a similar POST endpoint (e.g. `/api/notes` or `/api/documents`)
- Check for validation middleware (Zod, Joi)
- See how AI/inference is called elsewhere (if any)

### 2. Define Types

```typescript
interface ClinicalSummaryRequest {
  noteText: string;
}

interface ClinicalSummary {
  chiefComplaint: string;
  assessment: string;
  plan: string;
}

interface ClinicalSummaryResponse {
  summary: ClinicalSummary;
  modelVersion: string;
}
```

### 3. Add Validation

- `noteText`: required, string, max 10,000 chars, trim whitespace
- Reject empty or whitespace-only

### 4. Service Layer

- `ClinicalSummaryService.generateSummary(noteText)` 
- Call AI model (mock for now if no model wired)
- Return structured summary

### 5. Route Handler

- Validate body → call service → return 201 with summary
- Catch service errors, map to appropriate status codes

### 6. Things to mention

- "I'm capping input at 10K chars to avoid token limits and abuse."
- "We could add async processing if summarization takes >5s."
- "PHI in logs – we should avoid logging raw note text."
- "Model version in response helps with debugging and compliance."

---

## Full Implementation

See [`implementation/`](./implementation/) – controller → service → repo with mock API calls.
